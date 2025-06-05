const express = require('express');
const { nanoid } = require('../utils/id-generator');

module.exports = (db) => {
  const router = express.Router();

  // バリデーション関数 (テスト容易性を考慮して分離)
  const validatePassphrase = (passphrase) => {
    if (!passphrase || typeof passphrase !== 'string' || !passphrase.trim()) {
      return { valid: false, error: '合言葉を入力してください。' };
    }
    if (passphrase.trim().length > 100) {
      return { valid: false, error: '合言葉は100文字以内で入力してください。' };
    }
    return { valid: true, passphrase: passphrase.trim() };
  };

  // 空間に参加 (入室)
  router.post('/enter', (req, res) => {
    const validation = validatePassphrase(req.body.passphrase);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const stmt = db.prepare('SELECT * FROM spaces WHERE passphrase = ?');
      const space = stmt.get(validation.passphrase);

      if (space) {
        db.prepare("UPDATE spaces SET last_activity_at = datetime('now') WHERE id = ?").run(space.id);
        res.json({ success: true, space });
      } else {
        res.status(404).json({ success: false, error: 'その合言葉の空間は存在しません。' });
      }
    } catch (error) {
      console.error('空間入室エラー:', error);
      res.status(500).json({ success: false, error: 'サーバーエラーが発生しました。' });
    }
  });

  // 空間を作成
  router.post('/create', (req, res) => {
    const validation = validatePassphrase(req.body.passphrase);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      // 既存チェック
      const existingSpace = db.prepare('SELECT id FROM spaces WHERE passphrase = ?').get(validation.passphrase);
      if (existingSpace) {
        return res.status(409).json({ success: false, error: 'その合言葉は既に使用されています。' });
      }

      // 新規作成
      const newSpace = {
        id: nanoid(),
        passphrase: validation.passphrase,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      };

      db.prepare('INSERT INTO spaces (id, passphrase, created_at, last_activity_at) VALUES (?, ?, ?, ?)')
        .run(newSpace.id, newSpace.passphrase, newSpace.created_at, newSpace.last_activity_at);

      res.status(201).json({ success: true, message: '新しい空間を作成しました。', space: newSpace });
    } catch (error) {
      console.error('空間作成エラー:', error);
      res.status(500).json({ success: false, error: 'サーバーエラーが発生しました。' });
    }
  });

  return router;
};