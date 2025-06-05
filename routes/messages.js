const express = require('express');
const { nanoid } = require('../utils/id-generator');

module.exports = (db) => {
  const router = express.Router();
  const MESSAGE_EXPIRY_HOURS = parseFloat(process.env.MESSAGE_EXPIRY_HOURS) || 48;
  console.log(`メッセージの有効期限は ${MESSAGE_EXPIRY_HOURS} 時間に設定されています。`);

  // 空間のメッセージ一覧を取得
  router.get('/:spaceId', (req, res) => {
    const { spaceId } = req.params;
    if (!spaceId) {
      return res.status(400).json({ success: false, error: '空間IDが必要です。' });
    }

    try {
      const stmt = db.prepare(`
        SELECT id, space_id, encrypted_content, timestamp, expires_at, is_deleted, encrypted, encrypted_payload
        FROM messages
        WHERE space_id = ? AND is_deleted = 0
        ORDER BY timestamp ASC
      `);
      const messages = stmt.all(spaceId);

      // encrypted_payload をクライアントがパースしやすい形に整形
      const formattedMessages = messages.map(msg => {
          const formatted = { ...msg };
          if (msg.encrypted_payload) {
              try {
                  // DBのTEXT型からJSONオブジェクトへパース
                  formatted.encrypted_payload = JSON.parse(msg.encrypted_payload);
              } catch (e) {
                  console.error(`encrypted_payload のJSONパース失敗 (ID: ${msg.id})`, e);
                  // パース失敗時はnullを設定し、クライアント側でのエラーハンドリングを期待
                  formatted.encrypted_payload = null;
              }
          }
          return formatted;
      });

      res.json({ success: true, messages: formattedMessages });
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      res.status(500).json({ success: false, error: 'サーバーエラーが発生しました。' });
    }
  });

  // メッセージを投稿
  router.post('/create', (req, res) => {
    const { spaceId, message, encrypted, encryptedPayload } = req.body;
    if (!spaceId || !message) {
      return res.status(400).json({ success: false, error: '空間IDとメッセージは必須です。' });
    }

    try {
      const now = new Date();
      // [修正] 設定された有効期限を使ってexpires_atを計算
      const expiresAt = new Date(now.getTime() + MESSAGE_EXPIRY_HOURS * 60 * 60 * 1000);
      
      const newMessage = {
        id: nanoid(),
        space_id: spaceId,
        encrypted_content: encrypted ? '[ENCRYPTED]' : message,
        timestamp: now.toISOString(),
        expires_at: expiresAt.toISOString(), // 計算結果を保存
        is_deleted: 0,
        encrypted: encrypted ? 1 : 0,
        encrypted_payload: encryptedPayload ? JSON.stringify(encryptedPayload) : null
      };

      const stmt = db.prepare(`
        INSERT INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted, encrypted, encrypted_payload)
        VALUES (@id, @space_id, @encrypted_content, @timestamp, @expires_at, @is_deleted, @encrypted, @encrypted_payload)
      `);
      stmt.run(newMessage);

      const responseMessage = { ...newMessage };
      if (responseMessage.encrypted_payload) {
          responseMessage.encrypted_payload = JSON.parse(responseMessage.encrypted_payload);
      }

      res.status(201).json({ success: true, message: responseMessage });
    } catch (error) {
      console.error('メッセージ投稿エラー:', error);
      res.status(500).json({ success: false, error: 'サーバーエラーが発生しました。' });
    }
  });

  return router;
};