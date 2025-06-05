// public/js/modules/crypto.js

console.log('🔒 FRIENDLYモード 暗号化モジュールを読み込んでいます...');

window.Crypto = (() => {
  // --- モジュール状態 ---
  const spaceKeys = new Map(); // 空間ごとの鍵情報を管理 
  const passphraseCache = new Map(); // パスフレーズをメモリにキャッシュ 

  // --- 内部ヘルパー関数 ---

  /**
   * Web Crypto APIが利用可能かチェックします。
   */
  const isSupported = () => {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
  };

  /**
   * 文字列からArrayBufferを生成します。
   * @param {string} str - 対象の文字列
   * @returns {ArrayBuffer}
   */
  const str2ab = (str) => new TextEncoder().encode(str);

  /**
   * ArrayBufferをBase64文字列に変換します。
   * @param {ArrayBuffer} buffer - 対象のバッファ
   * @returns {string}
   */
  const ab2b64 = (buffer) => btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));

  /**
   * Base64文字列をArrayBufferに変換します。
   * @param {string} b64 - 対象のBase64文字列
   * @returns {Uint8Array}
   */
  const b642ab = (b64) => new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)));


  // --- 主要な暗号化関数 ---

  /**
   * パスフレーズと空間IDから決定的なAES-GCMキーを導出します。 
   * @param {string} spaceId - 空間ID
   * @param {string} passphrase - 合言葉
   * @returns {Promise<CryptoKey>} 導出された決定的キー
   */
  const generateDeterministicKey = async (spaceId, passphrase) => {
    if (!passphrase) throw new Error("決定的キーの導出にはパスフレーズが必要です。");

    // 決定的なソルトを生成
    const seedData = str2ab(`secure-chat-v2:${spaceId}:${passphrase}`);
    const saltBuffer = await crypto.subtle.digest('SHA-256', seedData);

    // PBKDF2のベースキーをインポート
    const baseKeyMaterial = str2ab(`${spaceId}:${passphrase}`);
    const baseKey = await crypto.subtle.importKey("raw", baseKeyMaterial, "PBKDF2", false, ["deriveKey"]);

    // AES-GCMキーを導出
    return await crypto.subtle.deriveKey({
      "name": "PBKDF2",
      "salt": saltBuffer,
      "iterations": 100000,
      "hash": "SHA-256"
    }, baseKey, { "name": "AES-GCM", "length": 256 }, false, ["encrypt", "decrypt"]);
  };

  /**
   * 現在のセッションリストから空間共通のセッションキーを導出します（ハイブリッド暗号化用）。 
   * @param {string[]} sessionIds - アクティブな全セッションIDの配列
   * @param {string} spaceId - 空間ID
   * @returns {Promise<CryptoKey>} 導出された空間共通セッションキー
   */
  const deriveSessionKey = async (sessionIds, spaceId) => {
    const sortedSessionIds = [...sessionIds].sort();
    const keyMaterialString = `friendly-session-key:${spaceId}:${sortedSessionIds.join(':')}`;
    const keyMaterial = str2ab(keyMaterialString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial);

    return await crypto.subtle.importKey("raw", hashBuffer, { "name": "AES-GCM", "length": 256 }, false, ["encrypt", "decrypt"]);
  };

  /**
   * 決定的キーを用いてメッセージを暗号化します。 
   * @param {string} message - 平文メッセージ
   * @param {CryptoKey} deterministicKey - 決定的キー
   * @returns {Promise<Object>} 暗号化されたデータとIV
   */
  const encryptDeterministically = async (message, deterministicKey) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = str2ab(message);
    const encryptedBuffer = await crypto.subtle.encrypt({ "name": "AES-GCM", "iv": iv, "tagLength": 128 }, deterministicKey, data);
    return {
        encryptedData: ab2b64(encryptedBuffer),
        iv: ab2b64(iv),
        algorithm: "AES-GCM-256"
    };
  };

  /**
   * 決定的キーを用いてメッセージを復号化します。 
   * @param {string} encryptedData - Base64エンコードされた暗号文
   * @param {string} iv - Base64エンコードされたIV
   * @param {CryptoKey} deterministicKey - 決定的キー
   * @returns {Promise<string>} 復号化された平文
   */
  const decryptDeterministically = async (encryptedData, iv, deterministicKey) => {
    const encrypted = b642ab(encryptedData);
    const ivArray = b642ab(iv);
    const decryptedBuffer = await crypto.subtle.decrypt({ "name": "AES-GCM", "iv": ivArray, "tagLength": 128 }, deterministicKey, encrypted);
    return new TextDecoder().decode(decryptedBuffer);
  };

    // [新設] ECDHを用いてピアとの共有秘密を導出するヘルパー関数
    const derivePairwiseSecret = async (myPrivateKey, peerPublicKeyJWK) => {
        const peerPublicKey = await crypto.subtle.importKey(
            'jwk', peerPublicKeyJWK,
            { name: 'ECDH', namedCurve: 'P-256' },
            true, []
        );
        return await crypto.subtle.deriveBits(
            { name: 'ECDH', public: peerPublicKey },
            myPrivateKey,
            256
        );
    };

  // --- 公開API ---

  return {
    isSupported: isSupported(),

    /**
     * 指定された空間の決定的キーをキャッシュから取得または新規作成します。 
     * @param {string} spaceId - 空間ID
     * @param {string} passphrase - 合言葉
     * @returns {Promise<CryptoKey>}
     */
    async getOrCreateSpaceKey(spaceId, passphrase) {
      passphraseCache.set(spaceId, passphrase);
      if (spaceKeys.has(spaceId) && spaceKeys.get(spaceId).type === 'deterministic') {
        return spaceKeys.get(spaceId).sharedKey;
      }
      const deterministicKey = await generateDeterministicKey(spaceId, passphrase);
      spaceKeys.set(spaceId, {
        sharedKey: deterministicKey,
        type: 'deterministic',
        passphrase,
        createdAt: new Date(),
      });
      return deterministicKey;
    },

    /**
     * メッセージを段階的暗号化ロジックに基づいて暗号化します。 
     * @param {string} message - 平文メッセージ
     * @param {string} spaceId - 空間ID
     * @param {string[]} activeSessionIds - 現在のアクティブセッションIDの配列
     * @returns {Promise<Object>} 暗号化ペイロードオブジェクト
     */
    async encryptMessageHybrid(message, spaceId, activeSessionIds) {
        const deterministicKey = await this.getOrCreateSpaceKey(spaceId, passphraseCache.get(spaceId));
        const fallbackData = await encryptDeterministically(message, deterministicKey);

        if (activeSessionIds.length <= 1) {
        return { type: "deterministic", ...fallbackData };
        } else {
        const sessionKey = await this.deriveSecureSessionKey(spaceId, activeSessionIds);
        const { encryptedData, iv } = await encryptDeterministically(JSON.stringify(fallbackData), sessionKey);

        return {
            type: "hybrid",
            encryptedData,
            iv,
            algorithm: "AES-GCM-256",
            sessionParticipants: activeSessionIds,
            fallbackData: fallbackData
        };
        }
    },


    /**
     * 受信したメッセージをフォールバックロジックを用いて復号化します。 
     * @param {Object} payload - 受信したメッセージの暗号化ペイロード
     * @param {string} spaceId - 空間ID
     * @param {string[]} activeSessionIds - 現在のアクティブセッションIDの配列
     * @returns {Promise<string>} 復号化された平文
     */
    async decryptMessageWithFallback(payload, spaceId, activeSessionIds) {
        const deterministicKey = await this.getOrCreateSpaceKey(spaceId, passphraseCache.get(spaceId));

        if (payload.type === 'hybrid') {
        try {
            // [修正] activeSessionIds を引数から削除し、payload内の参加者リストを信頼する
            const sessionKey = await this.deriveSecureSessionKey(spaceId, payload.sessionParticipants);
            const decryptedPayloadJson = await decryptDeterministically(payload.encryptedData, payload.iv, sessionKey);
            const innerPayload = JSON.parse(decryptedPayloadJson);
            return await decryptDeterministically(innerPayload.encryptedData, innerPayload.iv, deterministicKey);
        } catch (hybridError) {
            console.warn("ハイブリッド復号化に失敗。フォールバックします。", hybridError.message);
            return await decryptDeterministically(payload.fallbackData.encryptedData, payload.fallbackData.iv, deterministicKey);
        }
        } else {
        return await decryptDeterministically(payload.encryptedData, payload.iv, deterministicKey);
        }
    },

    /**
     * 特定の空間のキー情報を強制的にクリーンアップします。
     * @param {string} spaceId - 空間ID
     */
    forceCleanupSpaceKey(spaceId) {
        spaceKeys.delete(spaceId);
        passphraseCache.delete(spaceId);
        console.log(`🧹 空間[${spaceId}]のキー情報を強制的にクリーンアップしました。`);
    },
    /**
     * [追加] ECDHキーペアを生成します。
     * KeyExchangeManagerから利用されます。
     * @returns {Promise<CryptoKeyPair>}
     */
    async generateKeyPair() {
        return await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true, // extractable
            ['deriveKey', 'deriveBits']
        );
    },

    /**
     * [追加] 公開鍵をJWK形式でエクスポートします。
     * @param {CryptoKey} publicKey
     * @returns {Promise<object>}
     */
    async exportPublicKey(publicKey) {
        return await crypto.subtle.exportKey('jwk', publicKey);
    },

    /**
     * [最重要修正] 安全なセッションキーを導出するロジックを修正します。
     */
    async deriveSecureSessionKey(spaceId, activeSessionIds) {
        const myPrivateKey = window.KeyExchangeManager.getMyPrivateKey();
        const mySessionId = window.SessionManager.getCurrentSession()?.sessionId;

        if (!myPrivateKey || !mySessionId) {
            throw new Error("自身のキーまたはセッション情報が不足しており、セッションキーを導出できません。");
        }

        const peerSessionIds = activeSessionIds.filter(id => id !== mySessionId);
        
        // [修正] peerId と secret を紐付ける Map を使用する
        const derivedSecretsMap = new Map();

        for (const peerId of peerSessionIds) {
            const peerPublicKeyJWK = window.KeyExchangeManager.getPeerPublicKey(spaceId, peerId);
            if (!peerPublicKeyJWK) {
                throw new Error(`ピア[${peerId.substring(0,8)}]の公開鍵が見つかりません。キー交換が不完全です。`);
            }
            const secret = await derivePairwiseSecret(myPrivateKey, peerPublicKeyJWK);
            derivedSecretsMap.set(peerId, secret); // peerId をキーとして保存
        }
        
        // [修正] peerId をソートし、その順番で Map から secret を取り出して結合する
        const sortedPeerIds = peerSessionIds.sort();
        const sortedSecrets = sortedPeerIds.map(id => derivedSecretsMap.get(id));
        
        if (sortedSecrets.some(s => s === undefined)) {
            throw new Error("共有秘密の結合に失敗しました。一部のピアの秘密を導出できませんでした。");
        }

        const totalLength = sortedSecrets.reduce((sum, s) => sum + s.byteLength, 0);
        const combinedSecrets = new Uint8Array(totalLength);
        let offset = 0;
        for (const secret of sortedSecrets) {
            combinedSecrets.set(new Uint8Array(secret), offset);
            offset += secret.byteLength;
        }
        
        const keyMaterial = await crypto.subtle.digest('SHA-256', combinedSecrets);
        return await crypto.subtle.importKey("raw", keyMaterial, { "name": "AES-GCM" }, false, ["encrypt", "decrypt"]);
    },
  };
})();

console.log('✅ FRIENDLYモード 暗号化モジュール 読み込み完了');