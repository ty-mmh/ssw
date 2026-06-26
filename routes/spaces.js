const express = require('express')
const { createSpaceService } = require('../services/space-service')

module.exports = (context) => {
  const router = express.Router()
  const spaceService = createSpaceService({
    spaceStore: context.spaceStore,
    env: context.env,
  })

  router.post('/enter', async (req, res) => {
    try {
      const result = await spaceService.enterSpace(req.body.passphrase)
      res.status(result.status).json(result.body)
    } catch (error) {
      console.error('space enter error', { error: error.message })
      res
        .status(500)
        .json({ success: false, error: 'サーバーエラーが発生しました。' })
    }
  })

  router.post('/create', async (req, res) => {
    try {
      const result = await spaceService.createSpace(req.body.passphrase)
      res.status(result.status).json(result.body)
    } catch (error) {
      console.error('space create error', { error: error.message })
      res
        .status(500)
        .json({ success: false, error: 'サーバーエラーが発生しました。' })
    }
  })

  return router
}
