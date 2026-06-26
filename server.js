const express = require('express')
const cors = require('cors')
const path = require('path')
const multer = require('multer')

const { createStores } = require('./storage/create-stores')
const { createMessageService } = require('./services/message-service')
const { getRuntimeConfig } = require('./services/config-service')

const app = express()

const PORT = process.env.PORT || 3000
const runtimeConfig = getRuntimeConfig()
const MAX_FILE_SIZE_BYTES = runtimeConfig.maxFileSize
const uploadDir = path.join(__dirname, 'public/uploads')
const stores = createStores({
  publicDir: path.join(__dirname, 'public'),
})
const messageService = createMessageService({
  messageStore: stores.messageStore,
  env: process.env,
})

console.log(
  `ファイルサイズの最大値は ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB に設定されています。`,
)

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  },
})
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
})

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: runtimeConfig,
  })
})

const routeContext = {
  ...stores,
  env: process.env,
  upload,
}

app.use('/api/spaces', require('./routes/spaces')(routeContext))
app.use('/api/messages', require('./routes/messages')(routeContext))
app.use('/api/files', require('./routes/files')(routeContext))

const cleanupExpiredMessages = async () => {
  try {
    const changes = await messageService.cleanupExpiredMessages()
    if (changes > 0) {
      console.log('[Auto-Cleanup] expired messages marked deleted', { changes })
    }
  } catch (error) {
    console.error('[Auto-Cleanup] failed', { error: error.message })
  }
}

const CLEANUP_INTERVAL_MS = 1000 * 60
setInterval(cleanupExpiredMessages, CLEANUP_INTERVAL_MS)
console.log(
  `期限切れメッセージの自動クリーンアップが有効です (${CLEANUP_INTERVAL_MS / 60000}分間隔)`,
)

app.listen(PORT, () => {
  console.log(`SSW server listening on port ${PORT}`)
})
