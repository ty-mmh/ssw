const express = require('express')

module.exports = (context) => {
  const router = express.Router()
  const { fileStore, upload } = context

  router.post('/upload', (req, res) => {
    if (!upload) {
      return res
        .status(400)
        .json({ success: false, error: 'Local upload is not enabled.' })
    }

    upload.single('file')(req, res, async (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 400 : 500
        return res
          .status(status)
          .json({ success: false, error: `ファイルアップロードエラー: ${err.message}` })
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: 'ファイルがアップロードされませんでした。' })
      }

      const result = await fileStore.completeMulterUpload(req.file)
      res.json(result)
    })
  })

  router.post('/presign-upload', async (req, res) => {
    try {
      const { spaceId, messageId, fileName, contentType } = req.body
      if (!spaceId || !messageId) {
        return res
          .status(400)
          .json({ success: false, error: 'spaceId and messageId are required.' })
      }
      const result = await fileStore.createPresignedUpload({
        spaceId,
        messageId,
        fileName,
        contentType,
      })
      res.json({ success: true, ...result })
    } catch (error) {
      console.error('presign upload error', { error: error.message })
      res
        .status(500)
        .json({ success: false, error: 'アップロードURLの発行に失敗しました。' })
    }
  })

  router.get('/presign-download', async (req, res) => {
    try {
      const storageKey = req.query.key
      if (!storageKey) {
        return res
          .status(400)
          .json({ success: false, error: 'key is required.' })
      }
      const result = await fileStore.createPresignedDownload(storageKey)
      res.json({ success: true, ...result })
    } catch (error) {
      console.error('presign download error', { error: error.message })
      res
        .status(500)
        .json({ success: false, error: 'ダウンロードURLの発行に失敗しました。' })
    }
  })

  return router
}
