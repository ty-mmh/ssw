// public/js/modules/api.js
;(function () {
  'use strict'
  async function call(endpoint, options = {}) {
    try {
      const response = await fetch(`/api${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data
    } catch (error) {
      // ErrorHandlerが利用可能であれば、エラーを報告
      if (window.ErrorHandler) {
        window.ErrorHandler.report('api', error.message, { endpoint })
      }
      throw error // エラーを再スローして呼び出し元に伝える
    }
  }

  window.API = {
    async enterSpace(passphrase) {
      const { space } = await call('/spaces/enter', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      })
      // 空間キーの生成をCryptoモジュールに依頼
      await window.Crypto.getOrCreateSpaceKey(space.id, passphrase)
      return space
    },
    async createSpace(passphrase) {
      return await call('/spaces/create', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      })
    },
    async sendMessageFriendly(spaceId, message) {
      // 依存モジュールから必要な情報を取得
      const activeSessionIds =
        window.SessionManager.getActiveSessionsForSpace(spaceId)
      const encryptedPayload = await window.Crypto.encryptMessageHybrid(
        message,
        spaceId,
        activeSessionIds,
      )

      // サーバーに送信
      const { message: serverMessage } = await call('/messages/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          message: '[ENCRYPTED]',
          encrypted: true,
          encryptedPayload,
        }),
      })
      // フロントエンドで扱いやすいようにタイムスタンプをDateオブジェクトに変換
      return {
        ...serverMessage,
        text: message,
        timestamp: new Date(serverMessage.timestamp),
      }
    },
    async loadMessagesFriendly(spaceId) {
      const { messages } = await call(`/messages/${spaceId}`)
      return await Promise.all(
        messages.map(async (msg) => {
          const messageWithDate = { ...msg, timestamp: new Date(msg.timestamp) }
          // encrypted_payloadは、サーバーのAPIレスポンスでパース済みのオブジェクトとして返される想定
          if (msg.encrypted && msg.encrypted_payload) {
            try {
              messageWithDate.text =
                await window.Crypto.decryptMessageWithFallback(
                  msg.encrypted_payload,
                  spaceId,
                )
            } catch (e) {
              messageWithDate.text = `[復号化に失敗しました]`
              messageWithDate.encryptionType = 'error'
            }
          }
          return messageWithDate
        }),
      )
    },
    async uploadFile(fileData, fileName) {
      const formData = new FormData()
      // 'file' というキーは、サーバー側の upload.single('file') と一致させる
      formData.append('file', fileData, fileName)

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        // multipart/form-data の場合、Content-Typeはブラウザが自動設定するので不要
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data
    },
  }
})()
