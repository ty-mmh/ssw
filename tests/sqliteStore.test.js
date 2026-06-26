const fs = require('fs')
const os = require('os')
const path = require('path')
const Database = require('better-sqlite3')
const {
  SqliteMessageStore,
  SqliteSpaceStore,
} = require('../storage/sqlite-store')

describe('SQLite stores', () => {
  let tempDir
  let db

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssw-store-'))
    db = new Database(path.join(tempDir, 'test.db'))
  })

  afterEach(() => {
    db.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('creates and enters spaces without storing plaintext passphrase', async () => {
    const spaceStore = new SqliteSpaceStore(db, { secret: 'test-secret' })
    await spaceStore.createSpace({
      id: 'space-1',
      passphraseHash: 'hash-1',
      created_at: '2026-01-01T00:00:00.000Z',
      last_activity_at: '2026-01-01T00:00:00.000Z',
    })

    const space = await spaceStore.findByPassphraseHash('hash-1')

    expect(space).toEqual({
      id: 'space-1',
      created_at: '2026-01-01T00:00:00.000Z',
      last_activity_at: '2026-01-01T00:00:00.000Z',
    })
    const row = db.prepare('SELECT * FROM spaces').get()
    expect(JSON.stringify(row)).not.toContain('plain')
  })

  test('lists messages by since and excludes expired messages', async () => {
    new SqliteSpaceStore(db, { secret: 'test-secret' })
    const messageStore = new SqliteMessageStore(db)
    const now = new Date('2026-01-01T00:00:00.000Z')
    db.prepare(
      `INSERT INTO spaces (id, passphrase_hash, created_at, last_activity_at)
       VALUES (?, ?, ?, ?)`,
    ).run(
      'space-1',
      'hash-1',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    )

    await messageStore.createMessage({
      id: 'old',
      space_id: 'space-1',
      encrypted_content: '[ENCRYPTED]',
      timestamp: '2025-12-31T23:00:00.000Z',
      expires_at: '2026-01-01T01:00:00.000Z',
      is_deleted: 0,
      encrypted: 1,
      encrypted_payload: { type: 'deterministic' },
      message_type: 'text',
      metadata: null,
    })
    await messageStore.createMessage({
      id: 'new',
      space_id: 'space-1',
      encrypted_content: '[ENCRYPTED]',
      timestamp: '2026-01-01T00:30:00.000Z',
      expires_at: '2026-01-01T01:00:00.000Z',
      is_deleted: 0,
      encrypted: 1,
      encrypted_payload: { type: 'deterministic' },
      message_type: 'text',
      metadata: null,
    })
    await messageStore.createMessage({
      id: 'expired',
      space_id: 'space-1',
      encrypted_content: '[ENCRYPTED]',
      timestamp: '2026-01-01T00:40:00.000Z',
      expires_at: '2025-12-31T23:59:00.000Z',
      is_deleted: 0,
      encrypted: 1,
      encrypted_payload: { type: 'deterministic' },
      message_type: 'text',
      metadata: null,
    })

    const messages = await messageStore.listMessages('space-1', {
      since: '2026-01-01T00:00:00.000Z',
      now,
    })

    expect(messages.map((message) => message.id)).toEqual(['new'])
  })
})
