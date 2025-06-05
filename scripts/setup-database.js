const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🗄️ セキュアチャット FRIENDLYモード データベース初期化開始');

const dbPath = path.join(__dirname, '..', 'secure_chat.db');

// 開発の再現性を高めるため、既存のDBファイルがあれば削除
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ 既存のデータベースファイルを削除しました');
}

let db;

try {
  db = new Database(dbPath);
  console.log(`✅ データベースに接続しました: ${dbPath}`);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('📋 テーブルを作成中...');

  // 空間テーブル (spaces)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      passphrase TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_activity_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ "spaces" テーブルを作成しました');

  // メッセージテーブル (messages)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted INTEGER DEFAULT 0,
      encrypted_payload TEXT,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ "messages" テーブルを作成しました (暗号化対応)');

  // インデックス作成によるパフォーマンス最適化
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_space_id_timestamp ON messages(space_id, timestamp)');
  console.log('✅ インデックスを作成しました');

  // サンプルデータ挿入
  console.log('📝 サンプルデータを挿入中...');
  const sampleSpaceId = 'sample-space-friendly';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO spaces (id, passphrase, created_at, last_activity_at)
    VALUES (?, ?, ?, ?)
  `).run(sampleSpaceId, '秘密の部屋', now.toISOString(), now.toISOString());

  db.prepare(`
    INSERT INTO messages (id, space_id, encrypted_content, expires_at, encrypted, encrypted_payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'sample-msg-1',
    sampleSpaceId,
    'ようこそ！これはFRIENDLYモードのサンプルメッセージです。',
    expiresAt.toISOString(),
    0,
    null
  );
  console.log('✅ サンプルデータを挿入しました');

  console.log('\n🎉 データベースセットアップ完了！');

} catch (error) {
  console.error('❌ データベースセットアップエラー:', error.message);
  process.exit(1);
} finally {
  if (db) {
    db.close();
    console.log('✅ データベース接続を閉じました');
  }
}