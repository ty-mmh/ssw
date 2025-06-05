// public/js/modules/KeyExchangeManager.js

console.log('🔐 FRIENDLYモード キー交換管理モジュールを読み込んでいます...');

window.KeyExchangeManager = (() => {
  const peerPublicKeys = new Map();
  let socket = null;
  let currentSpaceId = null;
  let myKeyPair = null;
  let initializePromise = null;

  return {
    initialize(newSocket, spaceId) {
      // [修正] 初期化処理をPromiseでラップし、非同期処理の完了を待てるようにする
      initializePromise = new Promise(async (resolve, reject) => {
        try {
          socket = newSocket;
          currentSpaceId = spaceId;
          myKeyPair = null;

          if (!peerPublicKeys.has(spaceId)) {
            peerPublicKeys.set(spaceId, new Map());
          }

          socket.off('public-key-received'); // 念のため既存のリスナーを解除
          socket.on('public-key-received', this.handlePublicKeyReceived.bind(this));
          
          myKeyPair = await window.Crypto.generateKeyPair();
          console.log(`[KeyExchange] 空間[${spaceId}]用の自身のキーペアを生成しました。`);
          
          console.log(`キー交換マネージャー初期化完了 for space: ${spaceId}`);
          resolve(); // 初期化完了を通知
        } catch (error) {
          console.error('[KeyExchange] 初期化時のキーペア生成に失敗:', error);
          reject(error); // 初期化失敗を通知
        }
      });
      return initializePromise;
    },

    handlePublicKeyReceived(data) {
      if (!data || data.spaceId !== currentSpaceId || !data.sessionId) return;
      const { spaceId, sessionId, publicKey } = data;
      const mySessionId = window.SessionManager.getCurrentSession()?.sessionId;

      // 自分の鍵は保存しない
      if (sessionId === mySessionId) return;

      const spacePeers = peerPublicKeys.get(spaceId);
      if (spacePeers) {
        if (!spacePeers.has(sessionId)) {
            console.log(`[KeyExchange] ピア[${sessionId.substring(0,8)}]の公開鍵を受信・保存しました。`);
        }
        spacePeers.set(sessionId, publicKey);
        document.dispatchEvent(new CustomEvent('key-exchange-update', { detail: { spaceId, peerCount: spacePeers.size } }));
      }
    },

    async announcePublicKey() {
      // [修正] 初期化が完了するまで待つ
      await initializePromise;

      if (!socket || !currentSpaceId || !myKeyPair) {
        console.error("[KeyExchange] 必要な情報が不足しているため、公開鍵をアナウンスできません。");
        return;
      }
      const currentSession = window.SessionManager.getCurrentSession();
      if (!currentSession) return;

      try {
        const publicKeyJWK = await window.Crypto.exportPublicKey(myKeyPair.publicKey);
        console.log(`[KeyExchange] 自身の公開鍵をアナウンスします (To: ${currentSpaceId})`);
        socket.emit('public-key-announcement', {
          spaceId: currentSpaceId,
          sessionId: currentSession.sessionId,
          publicKey: publicKeyJWK,
        });
      } catch (error) {
        console.error('[KeyExchange] 公開鍵のアナウンス中にエラーが発生しました:', error);
      }
    },

    getMyPrivateKey() {
        return myKeyPair ? myKeyPair.privateKey : null;
    },

    getPeerPublicKey(spaceId, sessionId) {
        return peerPublicKeys.get(spaceId)?.get(sessionId) || null;
    },

    cleanup(spaceId) {
      if(socket) { socket.off('public-key-received'); }
      peerPublicKeys.delete(spaceId);
      currentSpaceId = null;
      socket = null;
      myKeyPair = null;
      console.log(`キー交換マネージャーのクリーンアップ完了 for space: ${spaceId}`);
    }
  };
})();

console.log('✅ FRIENDLYモード キー交換管理モジュール 読み込み完了');