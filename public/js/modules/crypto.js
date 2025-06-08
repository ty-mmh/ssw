;(function () {
  'use strict'
  window.Crypto = {
    _clearCache: function () {
      this.spaceKeys.clear()
      this.passphraseCache.clear()
    },
    spaceKeys: new Map(),
    passphraseCache: new Map(),
    isSupported:
      typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
    str2ab: (str) => new TextEncoder().encode(str),
    ab2b64: (buffer) =>
      btoa(String.fromCharCode.apply(null, new Uint8Array(buffer))),
    b642ab: (b64) =>
      new Uint8Array(
        atob(b64)
          .split('')
          .map((c) => c.charCodeAt(0)),
      ),
    generateDeterministicKey: async function (spaceId, passphrase) {
      if (!passphrase)
        throw new Error('決定的キーの導出にはパスフレーズが必要です。')
      const seedData = this.str2ab(`secure-chat-v2:${spaceId}:${passphrase}`)
      const saltBuffer = await crypto.subtle.digest('SHA-256', seedData)
      const baseKeyMaterial = this.str2ab(`${spaceId}:${passphrase}`)
      const baseKey = await crypto.subtle.importKey(
        'raw',
        baseKeyMaterial,
        'PBKDF2',
        false,
        ['deriveKey'],
      )
      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    },
    encryptDeterministically: async function (message, deterministicKey) {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const data = this.str2ab(message)
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        deterministicKey,
        data,
      )
      return {
        encryptedData: this.ab2b64(encryptedBuffer),
        iv: this.ab2b64(iv),
        algorithm: 'AES-GCM-256',
      }
    },
    decryptDeterministically: async function (
      encryptedData,
      iv,
      deterministicKey,
    ) {
      const encrypted = this.b642ab(encryptedData)
      const ivArray = this.b642ab(iv)
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivArray },
        deterministicKey,
        encrypted,
      )
      return new TextDecoder().decode(decryptedBuffer)
    },
    derivePairwiseSecret: async function (myPrivateKey, peerPublicKeyJWK) {
      const peerPublicKey = await crypto.subtle.importKey(
        'jwk',
        peerPublicKeyJWK,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
      )
      return await crypto.subtle.deriveBits(
        { name: 'ECDH', public: peerPublicKey },
        myPrivateKey,
        256,
      )
    },
    getOrCreateSpaceKey: async function (spaceId, passphrase) {
      this.passphraseCache.set(spaceId, passphrase)
      if (this.spaceKeys.has(spaceId))
        return this.spaceKeys.get(spaceId).sharedKey
      const key = await this.generateDeterministicKey(spaceId, passphrase)
      this.spaceKeys.set(spaceId, { sharedKey: key, type: 'deterministic' })
      return key
    },
    deriveSecureSessionKey: async function (spaceId, activeSessionIds) {
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
          return this.derivePairwiseSecret(myPrivateKey, peerPublicKeyJWK)
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
      return await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      )
    },
    encryptMessageHybrid: async function (message, spaceId, activeSessionIds) {
      const deterministicKey = await this.getOrCreateSpaceKey(
        spaceId,
        this.passphraseCache.get(spaceId),
      )
      const fallbackData = await this.encryptDeterministically(
        message,
        deterministicKey,
      )
      if (activeSessionIds.length <= 1)
        return { type: 'deterministic', ...fallbackData }
      const sessionKey = await this.deriveSecureSessionKey(
        spaceId,
        activeSessionIds,
      )
      const { encryptedData, iv } = await this.encryptDeterministically(
        JSON.stringify(fallbackData),
        sessionKey,
      )
      return {
        type: 'hybrid',
        encryptedData,
        iv,
        algorithm: 'AES-GCM-256',
        sessionParticipants: activeSessionIds,
        fallbackData: fallbackData,
      }
    },
    decryptMessageWithFallback: async function (payload, spaceId) {
      const deterministicKey = await this.getOrCreateSpaceKey(
        spaceId,
        this.passphraseCache.get(spaceId),
      )
      if (payload.type === 'hybrid') {
        try {
          const sessionKey = await this.deriveSecureSessionKey(
            spaceId,
            payload.sessionParticipants,
          )
          const decryptedPayloadJson = await this.decryptDeterministically(
            payload.encryptedData,
            payload.iv,
            sessionKey,
          )
          const innerPayload = JSON.parse(decryptedPayloadJson)
          return await this.decryptDeterministically(
            innerPayload.encryptedData,
            innerPayload.iv,
            deterministicKey,
          )
        } catch (hybridError) {
          console.warn(
            'ハイブリッド復号化に失敗。フォールバックします。',
            hybridError.message,
          )
          return await this.decryptDeterministically(
            payload.fallbackData.encryptedData,
            payload.fallbackData.iv,
            deterministicKey,
          )
        }
      } else {
        return await this.decryptDeterministically(
          payload.encryptedData,
          payload.iv,
          deterministicKey,
        )
      }
    },
  }
})()
