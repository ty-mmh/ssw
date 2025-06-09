// public/js/modules/crypto.js
;(function () {
  'use strict'
  const spaceKeys = new Map()
  const passphraseCache = new Map()
  const str2ab = (str) => new TextEncoder().encode(str)
  const ab2b64 = (buffer) =>
    btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
  const b642ab = (b64) =>
    new Uint8Array(
      atob(b64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    )
  const generateDeterministicKey = async (spaceId, passphrase) => {
    if (!passphrase)
      throw new Error('決定的キーの導出にはパスフレーズが必要です。')
    const seedData = str2ab(`secure-chat-v2:${spaceId}:${passphrase}`)
    const saltBuffer = await crypto.subtle.digest('SHA-256', seedData)
    const baseKeyMaterial = str2ab(`${spaceId}:${passphrase}`)
    const baseKey = await crypto.subtle.importKey(
      'raw',
      baseKeyMaterial,
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }
  const encryptDeterministically = async (data, deterministicKey) => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const dataBuffer = typeof data === 'string' ? str2ab(data) : data
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      deterministicKey,
      dataBuffer,
    )
    return {
      encryptedBuffer: encryptedBuffer, // [修正] Base64にせずBufferを返す
      iv: iv, // [修正] Bufferを返す
    }
  }
  
  const decryptDeterministically = async (
    encryptedDataB64,
    ivB64,
    deterministicKey,
    asString = true,
  ) => {
    const encryptedBuffer = b642ab(encryptedDataB64);
    const ivArray = b642ab(ivB64);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      deterministicKey,
      encryptedBuffer,
    )
    return asString
      ? new TextDecoder().decode(decryptedBuffer)
      : decryptedBuffer
  }
  
  const derivePairwiseSecret = async (myPrivateKey, peerPublicKeyJWK) => {
    const peerPublicKey = await crypto.subtle.importKey('jwk', peerPublicKeyJWK, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    return await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublicKey }, myPrivateKey, 256);
  }

  window.Crypto = {
    isSupported: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
    b642ab: b642ab,

    async getOrCreateSpaceKey(spaceId, passphrase) {
      if (spaceKeys.has(spaceId)) return spaceKeys.get(spaceId).sharedKey
      if (!passphrase) passphrase = passphraseCache.get(spaceId);
      if (!passphrase) throw new Error('キー生成のためのパスフレーズがありません。');
      
      const key = await generateDeterministicKey(spaceId, passphrase)
      spaceKeys.set(spaceId, { sharedKey: key, type: 'deterministic' })
      passphraseCache.set(spaceId, passphrase);
      return key
    },
    async deriveSecureSessionKey(spaceId, activeSessionIds) {
      // ... (この関数に変更なし)
      const myPrivateKey = window.KeyExchangeManager.getMyPrivateKey()
      const mySessionId = window.SessionManager.getCurrentSession()?.sessionId
      if (!myPrivateKey || !mySessionId)
        throw new Error('自身のキーまたはセッション情報が不足。')
      const peerSessionIds = activeSessionIds.filter((id) => id !== mySessionId)
      const secrets = await Promise.all(
        peerSessionIds.map((peerId) => {
          const peerPublicKeyJWK = window.KeyExchangeManager.getPeerPublicKey(
            spaceId,
            peerId,
          )
          if (!peerPublicKeyJWK)
            throw new Error(
              `ピア[${peerId.substring(0, 8)}]の公開鍵が見つかりません。`,
            )
          return derivePairwiseSecret(myPrivateKey, peerPublicKeyJWK)
        }),
      )
      const peerIdToSecret = new Map(
        peerSessionIds.map((id, i) => [id, secrets[i]]),
      )
      const sortedSecrets = [...peerIdToSecret.keys()]
        .sort()
        .map((id) => peerIdToSecret.get(id))
      const totalLength = sortedSecrets.reduce(
        (sum, s) => sum + s.byteLength,
        0,
      )
      const combinedSecrets = new Uint8Array(totalLength)
      let offset = 0
      for (const secret of sortedSecrets) {
        combinedSecrets.set(new Uint8Array(secret), offset)
        offset += secret.byteLength
      }
      const keyMaterial = await crypto.subtle.digest('SHA-256', combinedSecrets)
      return await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    },

    // [修正] テキストメッセージ専用の暗号化関数
    async encryptMessage(message, spaceId, activeSessionIds, passphrase) {
      const deterministicKey = await this.getOrCreateSpaceKey(spaceId, passphrase)
      const { encryptedBuffer, iv } = await encryptDeterministically(message, deterministicKey)
      
      const fallbackData = {
          encryptedData: ab2b64(encryptedBuffer),
          iv: ab2b64(iv),
      };

      if (activeSessionIds.length <= 1)
        return { type: 'deterministic', ...fallbackData }
      
      const payloadToEncrypt = JSON.stringify({ type: 'deterministic', ...fallbackData });
      const sessionKey = await this.deriveSecureSessionKey(spaceId, activeSessionIds);
      const { encryptedBuffer: finalEncryptedBuffer, iv: finalIv } = await encryptDeterministically(payloadToEncrypt, sessionKey);

      return {
        type: 'hybrid',
        encryptedData: ab2b64(finalEncryptedBuffer),
        iv: ab2b64(finalIv),
        algorithm: 'AES-GCM-256',
        sessionParticipants: activeSessionIds,
        fallbackData: fallbackData,
      }
    },
    
    // [新規] ファイル専用の暗号化関数
    async encryptFile(fileBuffer, spaceId, passphrase) {
        const deterministicKey = await this.getOrCreateSpaceKey(spaceId, passphrase);
        const { encryptedBuffer, iv } = await encryptDeterministically(fileBuffer, deterministicKey);

        // DBに保存するペイロードには、復号に必要なIVのみ（Base64で）格納
        const payloadForDb = {
            type: 'file_deterministic', // ファイル用の新しいタイプ
            iv: ab2b64(iv)
        };
        
        return {
            encryptedFileBuffer: encryptedBuffer, // アップロード用の暗号化済みバイナリ
            payloadForDb: payloadForDb // DB保存用のペイロード
        };
    },
    
    // [修正] decryptMessageWithFallbackはテキスト専用
    async decryptMessageWithFallback(payload, spaceId) {
        // ... (この関数は前回の修正から変更なし)
        const deterministicKey = await this.getOrCreateSpaceKey(spaceId, passphraseCache.get(spaceId));
        if (payload.type === 'hybrid') {
          try {
            const sessionKey = await this.deriveSecureSessionKey(spaceId, payload.sessionParticipants);
            const decryptedPayloadJson = await decryptDeterministically(payload.encryptedData, payload.iv, sessionKey, true);
            const innerPayload = JSON.parse(decryptedPayloadJson);
            return await decryptDeterministically(innerPayload.encryptedData, innerPayload.iv, deterministicKey, true);
          } catch (hybridError) {
            console.warn('ハイブリッド復号化に失敗。フォールバックします。', hybridError.message);
            return await decryptDeterministically(payload.fallbackData.encryptedData, payload.fallbackData.iv, deterministicKey, true);
          }
        } else {
          return await decryptDeterministically(payload.encryptedData, payload.iv, deterministicKey, true);
        }
    },

    async decryptFile(encryptedFileBuffer, payload, spaceId) {
        const deterministicKey = await this.getOrCreateSpaceKey(spaceId, passphraseCache.get(spaceId));
        const iv = payload.iv; // ファイル用のペイロードから直接ivを取得
        if (!iv) throw new Error('復号化に必要なIVがペイロード内に見つかりません。');
        
        const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b642ab(iv) }, deterministicKey, encryptedFileBuffer);
        return decryptedBuffer;
    },

    forceCleanupSpaceKey: function (spaceId) {
      spaceKeys.delete(spaceId);
      passphraseCache.delete(spaceId);
    },
    _clearCache: function () {
      spaceKeys.clear();
      passphraseCache.clear();
    },
  }
})()