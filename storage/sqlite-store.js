const fs = require('fs')
const path = require('path')
const { hashPassphrase, getAppSecret } = require('../utils/passphrase')
const {
  assertAllowedDownloadKey,
  assertAllowedLocalDownloadKey,
  assertPresignedUploadInput,
} = require('../utils/file-validation')

function createSpaceExistsError() {
  const error = new Error('Space already exists')
  error.code = 'SPACE_EXISTS'
  return error
}

class SqliteSpaceStore {
  constructor(db, options = {}) {
    this.db = db
    this.secret = options.secret || getAppSecret()
    ensureSpacesSchema(this.db, this.secret)
  }

  async createSpace(space) {
    try {
      this.db
        .prepare(
          `INSERT INTO spaces (id, passphrase_hash, created_at, last_activity_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          space.id,
          space.passphraseHash,
          space.created_at,
          space.last_activity_at,
        )
      return {
        id: space.id,
        created_at: space.created_at,
        last_activity_at: space.last_activity_at,
      }
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw createSpaceExistsError()
      }
      throw error
    }
  }

  async findByPassphraseHash(passphraseHash) {
    const space = this.db
      .prepare(
        `SELECT id, created_at, last_activity_at
         FROM spaces
         WHERE passphrase_hash = ?`,
      )
      .get(passphraseHash)
    return space || null
  }

  async touchSpace(spaceId, passphraseHash) {
    const lastActivityAt = new Date().toISOString()
    this.db
      .prepare(
        `UPDATE spaces
         SET last_activity_at = ?
         WHERE id = ? AND passphrase_hash = ?`,
      )
      .run(lastActivityAt, spaceId, passphraseHash)
  }
}

class SqliteMessageStore {
  constructor(db) {
    this.db = db
    ensureMessagesSchema(this.db)
  }

  async listMessages(spaceId, options = {}) {
    const now = options.now || new Date()
    const params = [spaceId, now.toISOString()]
    let sinceClause = ''
    if (options.since) {
      const since = new Date(options.since)
      if (Number.isNaN(since.getTime())) {
        const error = new Error('Invalid since timestamp')
        error.code = 'INVALID_SINCE'
        throw error
      }
      sinceClause = 'AND timestamp > ?'
      params.push(since.toISOString())
    }

    const rows = this.db
      .prepare(
        `SELECT id, space_id, encrypted_content, timestamp, expires_at,
                is_deleted, encrypted, encrypted_payload, message_type, metadata
         FROM messages
         WHERE space_id = ?
           AND is_deleted = 0
           AND expires_at > ?
           ${sinceClause}
         ORDER BY timestamp ASC`,
      )
      .all(...params)
    return rows.map(formatMessage)
  }

  async createMessage(message) {
    this.db
      .prepare(
        `INSERT INTO messages
          (id, space_id, encrypted_content, timestamp, expires_at,
           is_deleted, encrypted, encrypted_payload, message_type, metadata)
         VALUES
          (@id, @space_id, @encrypted_content, @timestamp, @expires_at,
           @is_deleted, @encrypted, @encrypted_payload, @message_type, @metadata)`,
      )
      .run({
        ...message,
        encrypted_payload: message.encrypted_payload
          ? JSON.stringify(message.encrypted_payload)
          : null,
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      })
    return message
  }

  async cleanupExpiredMessages(now = new Date()) {
    const result = this.db
      .prepare(
        `UPDATE messages
         SET is_deleted = 1
         WHERE expires_at <= ? AND is_deleted = 0`,
      )
      .run(now.toISOString())
    return result.changes
  }

  async findActiveMediaMessageByStorageKey(storageKey, options = {}) {
    assertAllowedDownloadKey(storageKey)
    const now = options.now || new Date()
    const row = this.db
      .prepare(
        `SELECT id, space_id, encrypted_content, timestamp, expires_at,
                is_deleted, encrypted, encrypted_payload, message_type, metadata
         FROM messages
         WHERE encrypted_content = ?
           AND is_deleted = 0
           AND expires_at > ?
         LIMIT 1`,
      )
      .get(storageKey, now.toISOString())
    return row ? formatMessage(row) : null
  }
}

class LocalFileStore {
  constructor(options = {}) {
    this.publicDir = options.publicDir || path.join(process.cwd(), 'public')
    this.uploadDir =
      options.uploadDir || path.join(this.publicDir, 'uploads')
    fs.mkdirSync(this.uploadDir, { recursive: true })
  }

  async completeMulterUpload(file) {
    return {
      success: true,
      filePath: `/uploads/${file.filename}`,
      storageKey: `/uploads/${file.filename}`,
    }
  }

  async createPresignedUpload(input = {}) {
    assertPresignedUploadInput(input)
    return {
      mode: 'local-multipart',
      uploadUrl: '/api/files/upload',
    }
  }

  async createPresignedDownload(storageKey) {
    assertAllowedLocalDownloadKey(storageKey)
    return {
      downloadUrl: storageKey,
    }
  }
}

function createLocalStores({ db, secret, publicDir } = {}) {
  return {
    spaceStore: new SqliteSpaceStore(db, { secret }),
    messageStore: new SqliteMessageStore(db),
    fileStore: new LocalFileStore({ publicDir }),
  }
}

function ensureSpacesSchema(db, secret) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      passphrase_hash TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_activity_at TEXT DEFAULT (datetime('now'))
    )
  `)
  const columns = getColumns(db, 'spaces')
  if (!columns.has('passphrase_hash')) {
    db.prepare('ALTER TABLE spaces ADD COLUMN passphrase_hash TEXT').run()
  }
  if (columns.has('passphrase')) {
    const legacyRows = db
      .prepare(
        `SELECT id, passphrase
         FROM spaces
         WHERE passphrase_hash IS NULL OR passphrase_hash = ''`,
      )
      .all()
    const update = db.prepare(
      `UPDATE spaces
       SET passphrase_hash = ?, passphrase = ?
       WHERE id = ?`,
    )
    for (const row of legacyRows) {
      const hashed = hashPassphrase(row.passphrase, secret)
      update.run(hashed, hashed, row.id)
    }
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_passphrase_hash ON spaces(passphrase_hash)',
  )
}

function ensureMessagesSchema(db) {
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
}

function getColumns(db, tableName) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => column.name),
  )
}

function formatMessage(msg) {
  const formatted = { ...msg }
  try {
    if (msg.encrypted_payload) {
      formatted.encrypted_payload = JSON.parse(msg.encrypted_payload)
    }
    if (msg.metadata) {
      formatted.metadata = JSON.parse(msg.metadata)
    }
  } catch (error) {
    console.error(`Failed to parse message JSON payload (ID: ${msg.id})`, {
      messageId: msg.id,
      error: error.message,
    })
    if (msg.encrypted_payload) formatted.encrypted_payload = null
    if (msg.metadata) formatted.metadata = null
  }
  return formatted
}

module.exports = {
  SqliteSpaceStore,
  SqliteMessageStore,
  LocalFileStore,
  createLocalStores,
  ensureSpacesSchema,
  ensureMessagesSchema,
  formatMessage,
}
