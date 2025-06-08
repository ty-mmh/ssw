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
      window.ErrorHandler?.report('api', error.message, { endpoint })
      throw error
    }
  }
  window.API = {
    async enterSpace(passphrase) {
      const { space } = await call('/spaces/enter', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      })
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
      const activeSessionIds =
        window.SessionManager.getActiveSessionsForSpace(spaceId)
      const encryptedPayload = await window.Crypto.encryptMessageHybrid(
        message,
        spaceId,
        activeSessionIds,
      )
      const { message: serverMessage } = await call('/messages/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          message: '[ENCRYPTED]',
          encrypted: true,
          encryptedPayload,
        }),
      })
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
          if (msg.encrypted && msg.encrypted_payload) {
            try {
              messageWithDate.text =
                await window.Crypto.decryptMessageWithFallback(
                  msg.encrypted_payload,
                  spaceId,
                )
            } catch (e) {
              messageWithDate.text = `[復号化に失敗]`
              messageWithDate.encryptionType = 'error'
            }
          }
          return messageWithDate
        }),
      )
    },
  }
})()
