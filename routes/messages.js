const express = require('express')
const { nanoid } = require('../utils/id-generator')

module.exports = (db) => {
  const router = express.Router()
  const MESSAGE_EXPIRY_HOURS =
    parseFloat(process.env.MESSAGE_EXPIRY_HOURS) || 48
  console.log(
    `メッセージの有効期限は ${MESSAGE_EXPIRY_HOURS} 時間に設定されています。`,
  )

  // 空間のメッセージ一覧を取得
  router.get('/:spaceId', (req, res) => {
    const { spaceId } = req.params
    if (!spaceId) {
      return res
        .status(400)
        .json({ success: false, error: '空間IDが必要です。' })
    }

    try {
      const stmt = db.prepare(`
        SELECT id, space_id, encrypted_content, timestamp, expires_at, is_deleted, encrypted, encrypted_payload, message_type, metadata
        FROM messages
        WHERE space_id = ? AND is_deleted = 0
        ORDER BY timestamp ASC
      `)
      const messages = stmt.all(spaceId)

      const formattedMessages = messages.map((msg) => {
        const formatted = { ...msg }
        try {
            if (msg.encrypted_payload) {
                formatted.encrypted_payload = JSON.parse(msg.encrypted_payload);
            }
            if (msg.metadata) {
                formatted.metadata = JSON.parse(msg.metadata);
            }
        } catch (e) {
            console.error(
              `JSONパース失敗 (ID: ${msg.id})`, e
            )
            formatted.encrypted_payload = formatted.encrypted_payload ? null : formatted.encrypted_payload;
            formatted.metadata = formatted.metadata ? null : formatted.metadata;
        }
        return formatted
      })

      res.json({ success: true, messages: formattedMessages })
    } catch (error) {
      console.error('メッセージ取得エラー:', error)
      res
        .status(500)
        .json({ success: false, error: 'サーバーエラーが発生しました。' })
    }
  })

  // メッセージを投稿
  router.post('/create', (req, res) => {
    console.log('[API /messages/create] 受信したリクエストボディ:', JSON.stringify(req.body, null, 2));
    
    // [修正] req.bodyから正しくプロパティを取得
    const { spaceId, message, encrypted, encryptedPayload, metadata, messageType } = req.body;

    if (!spaceId || (!message && !encryptedPayload)) {
      return res
        .status(400)
        .json({ success: false, error: '空間IDとメッセージ内容は必須です。' })
    }

    try {
      const now = new Date()
      const expiresAt = new Date(
        now.getTime() + MESSAGE_EXPIRY_HOURS * 60 * 60 * 1000,
      )

      const newMessage = {
        id: nanoid(),
        space_id: spaceId,
        encrypted_content: message,
        timestamp: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_deleted: 0,
        encrypted: encrypted ? 1 : 0,
        encrypted_payload: encryptedPayload
          ? JSON.stringify(encryptedPayload)
          : null,
        message_type: messageType || 'text', // [修正] これで 'image' が正しくセットされる
        metadata: metadata ? JSON.stringify(metadata) : null
      }
      
      console.log('[API /messages/create] DBに挿入するオブジェクト:', JSON.stringify(newMessage, null, 2));

      const stmt = db.prepare(`
        INSERT INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted, encrypted, encrypted_payload, message_type, metadata)
        VALUES (@id, @space_id, @encrypted_content, @timestamp, @expires_at, @is_deleted, @encrypted, @encrypted_payload, @message_type, @metadata)
      `)
      stmt.run(newMessage)

      const responseMessage = { ...newMessage }
      if (responseMessage.encrypted_payload) {
        responseMessage.encrypted_payload = JSON.parse(
          responseMessage.encrypted_payload,
        )
      }
       if (responseMessage.metadata) {
        responseMessage.metadata = JSON.parse(
          responseMessage.metadata,
        )
      }

      res.status(201).json({ success: true, message: responseMessage })
    } catch (error) {
      console.error('メッセージ投稿エラー:', error)
      res
        .status(500)
        .json({ success: false, error: 'サーバーエラーが発生しました。' })
    }
  })

  return router
}