const { nanoid } = require('../utils/id-generator')

function createMessageService({ messageStore, env = process.env }) {
  const messageExpiryHours = parseFloat(env.MESSAGE_EXPIRY_HOURS) || 48

  return {
    getMessageExpiryHours() {
      return messageExpiryHours
    },

    async listMessages(spaceId, options = {}) {
      if (!spaceId) {
        return {
          status: 400,
          body: { success: false, error: '空間IDが必要です。' },
        }
      }

      const messages = await messageStore.listMessages(spaceId, {
        since: options.since,
        now: new Date(),
      })
      return { status: 200, body: { success: true, messages } }
    },

    async createMessage(body) {
      const {
        spaceId,
        message,
        encrypted,
        encryptedPayload,
        metadata,
        messageType,
      } = body

      if (!spaceId || (!message && !encryptedPayload)) {
        return {
          status: 400,
          body: {
            success: false,
            error: '空間IDとメッセージ内容は必須です。',
          },
        }
      }

      const now = new Date()
      const expiresAt = new Date(
        now.getTime() + messageExpiryHours * 60 * 60 * 1000,
      )
      const newMessage = {
        id: nanoid(),
        space_id: spaceId,
        encrypted_content: message,
        timestamp: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        expires_at_epoch: Math.floor(expiresAt.getTime() / 1000),
        is_deleted: 0,
        encrypted: encrypted ? 1 : 0,
        encrypted_payload: encryptedPayload || null,
        message_type: messageType || 'text',
        metadata: metadata || null,
      }

      const saved = await messageStore.createMessage(newMessage)
      console.log('[API /messages/create] stored message', {
        messageId: saved.id,
        spaceId,
        messageType: saved.message_type,
      })
      return { status: 201, body: { success: true, message: saved } }
    },

    async cleanupExpiredMessages() {
      return await messageStore.cleanupExpiredMessages(new Date())
    },
  }
}

module.exports = {
  createMessageService,
}
