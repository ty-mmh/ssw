const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const { hashPassphrase, getAppSecret } = require('../utils/passphrase')

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const dbPath = options.db || path.join(__dirname, '..', 'secure_chat.db')
  const uploadsDir =
    options.uploads || path.join(__dirname, '..', 'public', 'uploads')
  const dryRun = options.execute !== true

  const plan = buildMigrationPlan({
    dbPath,
    uploadsDir,
    secret: getAppSecret(),
  })

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...plan }, null, 2))
    return
  }

  if (options.target !== 'mock') {
    throw new Error(
      'Only --target mock is supported. Real DynamoDB/S3 migration requires explicit AWS wiring and user approval.',
    )
  }

  const mockResult = executeMockMigration({
    plan,
    outDir: options.out || path.join(__dirname, '..', 'migration-mock-output'),
  })
  console.log(JSON.stringify({ dryRun: false, target: 'mock', ...plan, mockResult }, null, 2))
}

function buildMigrationPlan({ dbPath, uploadsDir, secret }) {
  const db = new Database(dbPath, { readonly: true })
  try {
    const spaceColumns = getColumns(db, 'spaces')
    const spaces = db.prepare('SELECT * FROM spaces').all()
    const messages = db.prepare('SELECT * FROM messages').all()
    const mediaMessages = messages.filter((message) =>
      ['image', 'audio'].includes(message.message_type),
    )
    const jsonIssues = []
    const unknownMessageTypes = []

    const plannedSpaces = spaces.map((space) => {
      const legacyPassphrase = space.passphrase
      const passphraseHash =
        space.passphrase_hash ||
        (legacyPassphrase ? hashPassphrase(legacyPassphrase, secret) : null)
      return {
        sourceId: space.id,
        targetSpaceId: space.id,
        passphraseHash,
        hasLegacyPlainPassphrase: spaceColumns.has('passphrase') && !!legacyPassphrase,
      }
    })

    const plannedMessages = messages.map((message) => {
      const encryptedPayload = parseJsonField(message, 'encrypted_payload', jsonIssues)
      const metadata = parseJsonField(message, 'metadata', jsonIssues)
      if (!['text', 'image', 'audio'].includes(message.message_type)) {
        unknownMessageTypes.push({
          messageId: message.id,
          messageType: message.message_type,
        })
      }
      const storageKey = message.encrypted_content?.startsWith('/uploads/')
        ? toS3Key(message.space_id, message.id, message.encrypted_content)
        : null
      return {
        id: message.id,
        spaceId: message.space_id,
        messageType: message.message_type,
        storageKey,
        encryptedContent: storageKey || message.encrypted_content,
        encryptedPayload,
        metadata,
        timestamp: message.timestamp,
        expiresAt: message.expires_at,
        expiresAtEpoch: toEpoch(message.expires_at),
        encrypted: message.encrypted,
        isDeleted: message.is_deleted,
      }
    })

    const uploadMessages = messages.filter((message) =>
      message.encrypted_content?.startsWith('/uploads/'),
    )
    const uploadChecks = uploadMessages.map((message) => {
      const uploadPath = message.encrypted_content?.startsWith('/uploads/')
        ? path.join(uploadsDir, path.basename(message.encrypted_content))
        : null
      return {
        messageId: message.id,
        source: message.encrypted_content,
        sourcePath: uploadPath,
        plannedStorageKey: uploadPath
          ? toS3Key(message.space_id, message.id, message.encrypted_content)
          : null,
        exists: uploadPath ? fs.existsSync(uploadPath) : false,
      }
    })

    return {
      dbPath,
      uploadsDir,
      counts: {
        spaces: spaces.length,
        messages: messages.length,
        mediaMessages: mediaMessages.length,
        uploadFilesFound: uploadChecks.filter((check) => check.exists).length,
        uploadFilesMissing: uploadChecks.filter((check) => !check.exists).length,
      },
      plannedSpaces,
      plannedMessages,
      uploadChecks,
      issues: {
        corruptJson: jsonIssues,
        missingFiles: uploadChecks.filter((check) => !check.exists),
        unknownMessageTypes,
      },
    }
  } finally {
    db.close()
  }
}

function executeMockMigration({ plan, outDir }) {
  fs.mkdirSync(outDir, { recursive: true })
  const dynamoDir = path.join(outDir, 'dynamodb')
  const s3Dir = path.join(outDir, 's3')
  fs.mkdirSync(dynamoDir, { recursive: true })
  fs.mkdirSync(s3Dir, { recursive: true })

  const spaces = plan.plannedSpaces.map(({ hasLegacyPlainPassphrase, ...space }) => space)
  const messages = plan.plannedMessages
  fs.writeFileSync(path.join(dynamoDir, 'spaces.json'), JSON.stringify(spaces, null, 2))
  fs.writeFileSync(path.join(dynamoDir, 'messages.json'), JSON.stringify(messages, null, 2))

  let copiedFiles = 0
  for (const check of plan.uploadChecks) {
    if (!check.exists || !check.sourcePath || !check.plannedStorageKey) continue
    const targetPath = path.join(s3Dir, ...check.plannedStorageKey.split('/'))
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(check.sourcePath, targetPath)
    copiedFiles += 1
  }

  return {
    outDir,
    dynamoDir,
    s3Dir,
    copiedFiles,
    skippedMissingFiles: plan.uploadChecks.filter((check) => !check.exists).length,
  }
}

function toS3Key(spaceId, messageId, encryptedContent) {
  return `spaces/${spaceId}/messages/${messageId}/${path.basename(encryptedContent)}`
}

function parseJsonField(message, fieldName, issues) {
  const value = message[fieldName]
  if (!value) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    issues.push({
      messageId: message.id,
      field: fieldName,
      error: error.message,
    })
    return null
  }
}

function toEpoch(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(date.getTime() / 1000)
}

function getColumns(db, tableName) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => column.name),
  )
}

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--execute') options.execute = true
    if (arg === '--db') {
      options.db = argv[i + 1]
      i += 1
    }
    if (arg === '--uploads') {
      options.uploads = argv[i + 1]
      i += 1
    }
    if (arg === '--target') {
      options.target = argv[i + 1]
      i += 1
    }
    if (arg === '--out') {
      options.out = argv[i + 1]
      i += 1
    }
  }
  return options
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = {
  buildMigrationPlan,
  executeMockMigration,
  toS3Key,
  parseJsonField,
}
