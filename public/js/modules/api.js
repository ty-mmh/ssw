// public/js/modules/api.js

console.log('📡 FRIENDLYモード API通信モジュールを読み込んでいます...');

window.API = (() => {
  const API_BASE = '/api'; // 環境変数などから取得するのが望ましい

  /**
   * 共通のAPI呼び出し関数
   * @param {string} endpoint - APIエンドポイント
   * @param {object} options - fetchのオプション
   * @returns {Promise<any>}
   */
  async function call(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`API呼び出しエラー [${endpoint}]:`, error);
      throw error;
    }
  }

  return {
    /**
     * 空間に参加し、成功したら空間情報を返します。
     * @param {string} passphrase - 合言葉
     * @returns {Promise<Object>} 空間情報
     */
    async enterSpace(passphrase) {
      const { space } = await call('/spaces/enter', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      });
      // 決定的キーを生成・キャッシュ
      await window.Crypto.getOrCreateSpaceKey(space.id, passphrase);
      return space;
    },

    /**
     * 新しい空間を作成します。
     * @param {string} passphrase - 新しい合言葉
     * @returns {Promise<Object>}
     */
    async createSpace(passphrase) {
      return await call('/spaces/create', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      });
    },

    /**
     * FRIENDLYモードでメッセージを送信します。
     * @param {string} spaceId - 空間ID
     * @param {string} message - 平文メッセージ
     * @returns {Promise<Object>} 送信されたメッセージオブジェクト
     */
    async sendMessageFriendly(spaceId, message) {
      const activeSessionIds = window.SessionManager.getActiveSessionsForSpace(spaceId);
      const encryptedPayload = await window.Crypto.encryptMessageHybrid(message, spaceId, activeSessionIds);

      const { message: serverMessage } = await call('/messages/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          message: '[ENCRYPTED]',
          encrypted: true,
          encryptedPayload,
        }),
      });
      
      // [修正点] サーバーからの応答に含まれるtimestampもDateオブジェクトに変換
      const sentMessage = {
          ...serverMessage,
          text: message, // ローカル表示用に平文をセット
          timestamp: new Date(serverMessage.timestamp) // 文字列からDateオブジェクトへ
      };
      
      return sentMessage;
    },

    /**
     * メッセージ履歴を読み込み、復号化します。
     * @param {string} spaceId - 空間ID
     * @returns {Promise<Array>} 復号化済みのメッセージ配列
     */
    async loadMessagesFriendly(spaceId) {
      const { messages } = await call(`/messages/${spaceId}`);
      const activeSessionIds = window.SessionManager.getActiveSessionsForSpace(spaceId);

      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          const messageWithDate = {
            ...msg,
            // [修正点] 読み込み時にもtimestampをDateオブジェクトに変換
            timestamp: new Date(msg.timestamp)
          };

          if (messageWithDate.encrypted && messageWithDate.encrypted_payload) {
            try {
              messageWithDate.text = await window.Crypto.decryptMessageWithFallback(messageWithDate.encrypted_payload, spaceId, activeSessionIds);
            } catch (e) {
              console.warn(`メッセージ[${messageWithDate.id}]の復号化に失敗:`, e.message);
              messageWithDate.text = `[復号化に失敗しました: ${e.message}]`;
              messageWithDate.encryptionType = 'error'; // エラータイプを設定
            }
          }
          return messageWithDate;
        })
      );
      return decryptedMessages;
    },
  };
})();

console.log('✅ FRIENDLYモード API通信モジュール 読み込み完了');