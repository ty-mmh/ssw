const express = require('express')
const { createMessageService } = require('../services/message-service')

module.exports = (context) => {
  const router = express.Router()
  const messageService = createMessageService({
    messageStore: context.messageStore,
    env: context.env,
  })

  console.log(
    `メッセージの有効期限は ${messageService.getMessageExpiryHours()} 時間に設定されています。`,
  )

  router.get('/:spaceId', async (req, res) => {
    try {
      const result = await messageService.listMessages(req.params.spaceId, {
        since: req.query.since,
      })
      res.status(result.status).json(result.body)
    } catch (error) {
      if (error.code === 'INVALID_SINCE') {
        return res
          .status(400)
          .json({ success: false, error: 'since timestamp is invalid.' })
      }
      console.error('message list error', { error: error.message })
      res
        .status(500)
        .json({ success: false, error: 'サーバーエラーが発生しました。' })
    }
  })

  router.post('/create', async (req, res) => {
    try {
      const result = await messageService.createMessage(req.body)
      res.status(result.status).json(result.body)
    } catch (error) {
      console.error('message create error', { error: error.message })
      res
        .status(500)
        .json({ success: false, error: 'サーバーエラーが発生しました。' })
    }
  })

  return router
}
