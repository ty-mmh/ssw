const { createStores } = require('../storage/create-stores')
const { createSpaceService } = require('../services/space-service')
const { createMessageService } = require('../services/message-service')
const { getRuntimeConfig } = require('../services/config-service')
const {
  getPathParameter,
  jsonResponse,
  parseJsonBody,
} = require('../utils/http-response')

let cachedContext

function getContext() {
  if (!cachedContext) {
    const stores = createStores()
    cachedContext = {
      stores,
      spaceService: createSpaceService({
        spaceStore: stores.spaceStore,
        env: process.env,
      }),
      messageService: createMessageService({
        messageStore: stores.messageStore,
        env: process.env,
      }),
    }
  }
  return cachedContext
}

async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return jsonResponse(204, {})
  }

  const method = event.requestContext?.http?.method || event.httpMethod
  const routeKey = event.routeKey || `${method} ${event.rawPath || event.path}`
  const path = event.rawPath || event.path || ''
  const { spaceService, messageService, stores } = getContext()

  try {
    if (method === 'GET' && path === '/api/config') {
      return jsonResponse(200, {
        success: true,
        config: getRuntimeConfig(),
      })
    }

    if (method === 'POST' && path === '/api/spaces/create') {
      const result = await spaceService.createSpace(parseJsonBody(event).passphrase)
      return jsonResponse(result.status, result.body)
    }

    if (method === 'POST' && path === '/api/spaces/enter') {
      const result = await spaceService.enterSpace(parseJsonBody(event).passphrase)
      return jsonResponse(result.status, result.body)
    }

    if (
      method === 'GET' &&
      (routeKey === 'GET /api/messages/{spaceId}' ||
        path.startsWith('/api/messages/'))
    ) {
      const spaceId =
        getPathParameter(event, 'spaceId') ||
        decodeURIComponent(path.replace('/api/messages/', ''))
      const result = await messageService.listMessages(spaceId, {
        since: event.queryStringParameters?.since,
      })
      return jsonResponse(result.status, result.body)
    }

    if (method === 'POST' && path === '/api/messages/create') {
      const result = await messageService.createMessage(parseJsonBody(event))
      return jsonResponse(result.status, result.body)
    }

    if (method === 'POST' && path === '/api/files/presign-upload') {
      const body = parseJsonBody(event)
      const result = await stores.fileStore.createPresignedUpload(body)
      return jsonResponse(200, { success: true, ...result })
    }

    if (method === 'GET' && path === '/api/files/presign-download') {
      const storageKey = event.queryStringParameters?.key
      if (!storageKey) {
        return jsonResponse(400, { success: false, error: 'key is required.' })
      }
      const result = await stores.fileStore.createPresignedDownload(storageKey)
      return jsonResponse(200, { success: true, ...result })
    }

    return jsonResponse(404, {
      success: false,
      error: `No route for ${routeKey}`,
    })
  } catch (error) {
    console.error('lambda http handler error', { error: error.message })
    if (error.code === 'INVALID_SINCE') {
      return jsonResponse(400, {
        success: false,
        error: 'since timestamp is invalid.',
      })
    }
    return jsonResponse(500, {
      success: false,
      error: 'サーバーエラーが発生しました。',
    })
  }
}

function resetForTesting() {
  if (cachedContext?.stores?.db) {
    cachedContext.stores.db.close()
  }
  cachedContext = null
}

module.exports = {
  handler,
  resetForTesting,
}
