const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { hashPassphrase, getAppSecret } = require('../utils/passphrase')

console.log('SSW local database setup started')

const dbPath = path.join(__dirname, '..', 'secure_chat.db')

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
  console.log('Existing database file removed')
}

let db

try {
  db = new Database(dbPath)
  console.log(`Connected to database: ${dbPath}`)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      passphrase_hash TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_activity_at TEXT DEFAULT (datetime('now'))
    )
  `)

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
      message_type TEXT NOT NULL DEFAULT 'text',
      metadata TEXT,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    )
  `)

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_messages_space_id_timestamp ON messages(space_id, timestamp)',
  )

  const sampleSpaceId = 'sample-space-friendly'
  const samplePassphrase = '秘密の部屋'
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  db.prepare(`
    INSERT INTO spaces (id, passphrase_hash, created_at, last_activity_at)
    VALUES (?, ?, ?, ?)
  `).run(
    sampleSpaceId,
    hashPassphrase(samplePassphrase, getAppSecret()),
    now.toISOString(),
    now.toISOString(),
  )

  db.prepare(`
    INSERT INTO messages
      (id, space_id, encrypted_content, expires_at, encrypted, encrypted_payload, message_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sample-msg-1',
    sampleSpaceId,
    'ようこそ。これはFRIENDLYモードのサンプルメッセージです。',
    expiresAt.toISOString(),
    0,
    null,
    'text',
  )

  console.log('Database setup completed')
} catch (error) {
  console.error('Database setup failed:', error.message)
  process.exit(1)
} finally {
  if (db) {
    db.close()
    console.log('Database connection closed')
  }
}
