const path = require('path')
const Database = require('better-sqlite3')
const { getAppSecret } = require('../utils/passphrase')
const { createLocalStores } = require('./sqlite-store')
const {
  DynamoDbSpaceStore,
  DynamoDbMessageStore,
} = require('./dynamodb-store')
const { S3FileStore } = require('./s3-file-store')
const { LocalFileStore } = require('./sqlite-store')
const { DynamoDbSessionStore, MemorySessionStore } = require('./session-store')

function createStores(options = {}) {
  const env = options.env || process.env
  const storageDriver = env.STORAGE_DRIVER || 'sqlite'
  const fileDriver = env.FILE_DRIVER || 'local'
  const sessionDriver = env.SESSION_DRIVER || storageDriver
  const secret = getAppSecret(env)

  let spaceStore
  let messageStore
  let db = options.db

  if (storageDriver === 'dynamodb') {
    spaceStore = new DynamoDbSpaceStore(options.dynamoDb)
    messageStore = new DynamoDbMessageStore(options.dynamoDb)
  } else {
    db = db || new Database(env.SQLITE_DB_PATH || 'secure_chat.db')
    ;({ spaceStore, messageStore } = createLocalStores({
      db,
      secret,
      publicDir: options.publicDir,
    }))
  }

  const fileStore =
    fileDriver === 's3'
      ? new S3FileStore(options.s3)
      : new LocalFileStore({
          publicDir: options.publicDir || path.join(process.cwd(), 'public'),
        })

  const sessionStore =
    sessionDriver === 'dynamodb'
      ? new DynamoDbSessionStore(options.dynamoDb)
      : new MemorySessionStore()

  return {
    db,
    spaceStore,
    messageStore,
    fileStore,
    sessionStore,
    drivers: {
      storageDriver,
      fileDriver,
      sessionDriver,
    },
  }
}

module.exports = {
  createStores,
}
