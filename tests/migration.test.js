const fs = require('fs')
const os = require('os')
const path = require('path')
const Database = require('better-sqlite3')
const {
  buildMigrationPlan,
  executeMockMigration,
  toS3Key,
} = require('../scripts/migrate-to-aws')

describe('AWS migration dry-run', () => {
  let tempDir
  let dbPath
  let uploadsDir

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssw-migrate-'))
    dbPath = path.join(tempDir, 'secure_chat.db')
    uploadsDir = path.join(tempDir, 'uploads')
    fs.mkdirSync(uploadsDir)
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE spaces (
        id TEXT PRIMARY KEY,
        passphrase TEXT NOT NULL UNIQUE,
        created_at TEXT,
        last_activity_at TEXT
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        timestamp TEXT,
        expires_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        encrypted INTEGER DEFAULT 0,
        encrypted_payload TEXT,
        message_type TEXT NOT NULL DEFAULT 'text',
        metadata TEXT
      );
    `)
    db.prepare(
      'INSERT INTO spaces (id, passphrase, created_at, last_activity_at) VALUES (?, ?, ?, ?)',
    ).run('space-1', 'plain-room', 'now', 'now')
    db.prepare(
      'INSERT INTO messages (id, space_id, encrypted_content, expires_at, message_type) VALUES (?, ?, ?, ?, ?)',
    ).run('msg-1', 'space-1', '/uploads/file.bin', 'later', 'image')
    fs.writeFileSync(path.join(uploadsDir, 'file.bin'), 'encrypted')
    db.close()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('summarizes spaces, messages, media files, and hash conversion', () => {
    const plan = buildMigrationPlan({
      dbPath,
      uploadsDir,
      secret: 'migration-secret',
    })

    expect(plan.counts).toEqual({
      spaces: 1,
      messages: 1,
      mediaMessages: 1,
      uploadFilesFound: 1,
      uploadFilesMissing: 0,
    })
    expect(plan.plannedSpaces[0].passphraseHash).not.toContain('plain-room')
    expect(plan.plannedMessages[0].storageKey).toBe(
      'spaces/space-1/messages/msg-1/file.bin',
    )
    expect(plan.issues).toEqual({
      corruptJson: [],
      missingFiles: [],
      unknownMessageTypes: [],
    })
  })

  test('builds deterministic S3 keys from upload paths', () => {
    expect(toS3Key('s', 'm', '/uploads/a.bin')).toBe(
      'spaces/s/messages/m/a.bin',
    )
  })

  test('detects corrupt json, missing files, and unknown message types', () => {
    const db = new Database(dbPath)
    db.prepare(
      'INSERT INTO messages (id, space_id, encrypted_content, expires_at, encrypted_payload, message_type) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('msg-2', 'space-1', '/uploads/missing.bin', 'later', '{broken', 'video')
    db.close()

    const plan = buildMigrationPlan({
      dbPath,
      uploadsDir,
      secret: 'migration-secret',
    })

    expect(plan.issues.corruptJson).toEqual([
      expect.objectContaining({ messageId: 'msg-2', field: 'encrypted_payload' }),
    ])
    expect(plan.issues.missingFiles).toEqual([
      expect.objectContaining({ messageId: 'msg-2' }),
    ])
    expect(plan.issues.unknownMessageTypes).toEqual([
      { messageId: 'msg-2', messageType: 'video' },
    ])
  })

  test('writes mock DynamoDB payloads and local S3 prefix without AWS access', () => {
    const outDir = path.join(tempDir, 'mock-out')
    const plan = buildMigrationPlan({
      dbPath,
      uploadsDir,
      secret: 'migration-secret',
    })

    const result = executeMockMigration({ plan, outDir })

    expect(result.copiedFiles).toBe(1)
    expect(
      JSON.parse(
        fs.readFileSync(path.join(outDir, 'dynamodb', 'spaces.json'), 'utf8'),
      )[0],
    ).not.toHaveProperty('passphrase')
    expect(
      fs.existsSync(
        path.join(outDir, 's3', 'spaces', 'space-1', 'messages', 'msg-1', 'file.bin'),
      ),
    ).toBe(true)
  })
})
