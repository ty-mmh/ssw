const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const path = require('path')
const Database = require('better-sqlite3')
const multer = require('multer')
const fs = require('fs')

// --- 初期設定 ---
const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*', // 開発用に許可
    methods: ['GET', 'POST'],
  },
})

const uploadDir = path.join(__dirname, 'public/uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // ファイル名の重複を防ぐため、ユニークな接尾辞を付与
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(
      null,
      file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname),
    )
  },
})
const upload = multer({ storage: storage })

const PORT = process.env.PORT || 3000
const db = new Database('secure_chat.db')

// --- ミドルウェア ---
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// --- APIルーター ---
const spacesRouter = require('./routes/spaces')(db)
const messagesRouter = require('./routes/messages')(db)
app.use('/api/spaces', spacesRouter)
app.use('/api/messages', messagesRouter)

app.post('/api/files/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'ファイルがアップロードされませんでした。',
    })
  }
  // アップロード成功後、クライアントからアクセス可能なファイルパスを返す
  res.json({ success: true, filePath: `/uploads/${req.file.filename}` })
})

// --- Socket.IO イベントハンドラ ---
const activeSessions = new Map() // spaceId -> Set<socket.id>

io.on('connection', (socket) => {
  console.log(`🔌 [Socket.IO] 新しい接続: ${socket.id}`)

  // [修正] 空間参加時の処理を強化
  socket.on('join-space', (spaceId) => {
    console.log(`🚪 [Socket.IO] 空間参加: ${socket.id} -> ${spaceId}`)
    socket.join(spaceId)

    if (!activeSessions.has(spaceId)) {
      activeSessions.set(spaceId, new Set())
    }
    activeSessions.get(spaceId).add(socket.id)

    const sessionCount = activeSessions.get(spaceId).size
    const allSessionIds = Array.from(activeSessions.get(spaceId))

    // 他のクライアントに、新しい参加者が来たことを通知
    socket.to(spaceId).emit('session-joined', { sessionId: socket.id, spaceId })

    // ルームにいる全員（自分を含む）に、最新のセッション数を通知
    io.to(spaceId).emit('session-count-updated', { spaceId, sessionCount })

    // [追加] 新しく参加したクライアントに、現在の全参加者リストを送る
    socket.emit('space-joined-successfully', {
      spaceId,
      sessionCount,
      allSessionIds,
    })
  })

  // 新規メッセージのブロードキャスト
  socket.on('new-message', (data) => {
    const roomName = data.spaceId
    const room = io.sockets.adapter.rooms.get(roomName)
    const clientsInRoom = room ? Array.from(room) : []

    console.log(`--------------------------------`)
    console.log(
      `💬 [診断] 'new-message' 受信 (from: ${socket.id.substring(0, 5)}...)`,
    )
    console.log(`   - 空間ID: ${roomName}`)
    console.log(`   - 現在のルーム参加者: [${clientsInRoom.join(', ')}]`)
    console.log(
      `   - 送信者以外の対象者数: ${clientsInRoom.filter((id) => id !== socket.id).length}人`,
    )
    console.log(`   - 配信イベント: 'message-received'`)
    console.log(`--------------------------------`)

    // 既存の配信処理
    socket.to(roomName).emit('message-received', {
      message: data.message,
      encryptionInfo: data.encryptionInfo,
      from: socket.id,
      timestamp: new Date().toISOString(),
    })
  })

  // 公開鍵の通知
  socket.on('public-key-announcement', (data) => {
    console.log(
      `🔑 [Socket.IO] 公開鍵通知 from ${data.sessionId.substring(0, 8)} in ${data.spaceId}`,
    )
    socket.to(data.spaceId).emit('public-key-received', data)
  })

  // 切断処理
  socket.on('disconnect', () => {
    console.log(`🔌 [Socket.IO] 接続切断: ${socket.id}`)
    // 参加していた空間からセッションを削除
    activeSessions.forEach((sessions, spaceId) => {
      if (sessions.has(socket.id)) {
        sessions.delete(socket.id)
        const sessionCount = sessions.size
        io.to(spaceId).emit('session-left', {
          sessionId: socket.id,
          spaceId,
          timestamp: new Date().toISOString(),
        })
        io.to(spaceId).emit('session-count-updated', {
          spaceId,
          sessionCount,
          encryptionLevel: sessionCount > 1 ? 'hybrid' : 'deterministic',
        })
        if (sessionCount === 0) {
          activeSessions.delete(spaceId)
        }
      }
    })
  })
})

// --- [追加] メッセージの自動クリーンアップ処理 ---
const cleanupExpiredMessages = () => {
  try {
    const now = new Date().toISOString()
    const stmt = db.prepare(`
      UPDATE messages 
      SET is_deleted = 1 
      WHERE expires_at <= ? AND is_deleted = 0
    `)
    const result = stmt.run(now)
    if (result.changes > 0) {
      console.log(
        `🧹 [Auto-Cleanup] 期限切れメッセージを ${result.changes} 件クリーンアップしました。`,
      )
    }
  } catch (error) {
    console.error(
      '❌ [Auto-Cleanup] メッセージのクリーンアップ中にエラーが発生しました:',
      error,
    )
  }
}

// サーバー起動時に、1時間ごとにクリーンアップ処理を実行
const CLEANUP_INTERVAL_MS = 1000 * 60 // 1時間
setInterval(cleanupExpiredMessages, CLEANUP_INTERVAL_MS)
console.log(
  `🧹 期限切れメッセージの自動クリーンアップが有効になりました (実行間隔: ${CLEANUP_INTERVAL_MS / (1000 * 60)}分)`,
)

// --- サーバー起動 ---
server.listen(PORT, () => {
  console.log(`🚀 FRIENDLYモード対応サーバーがポート ${PORT} で起動しました`)
})
