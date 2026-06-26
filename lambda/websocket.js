const { createStores } = require('../storage/create-stores')

let cachedContext

function getContext() {
  if (!cachedContext) {
    const stores = createStores()
    cachedContext = {
      sessionStore: stores.sessionStore,
      managementClient: createManagementClient(),
    }
  }
  return cachedContext
}

function setContextForTesting(context) {
  cachedContext = context
}

async function handler(event) {
  const routeKey = event.requestContext.routeKey
  const connectionId = event.requestContext.connectionId
  const { sessionStore } = getContext()

  if (routeKey === '$connect') {
    await sessionStore.connect(connectionId, ttlInHours(3))
    return { statusCode: 200, body: 'connected' }
  }

  if (routeKey === '$disconnect') {
    await sessionStore.disconnect(connectionId)
    return { statusCode: 200, body: 'disconnected' }
  }

  const body = event.body ? JSON.parse(event.body) : {}
  const action = body.action || routeKey

  if (action === 'joinSpace') {
    const connections = await sessionStore.joinSpace(
      connectionId,
      body.spaceId,
      body.publicKey || null,
    )
    await broadcast(body.spaceId, {
      event: 'session-joined',
      sessionId: connectionId,
      spaceId: body.spaceId,
    }, connectionId)
    await send(connectionId, {
      event: 'space-joined-successfully',
      sessionId: connectionId,
      spaceId: body.spaceId,
      sessionCount: connections.length,
      allSessionIds: connections.map((connection) => connection.sessionId || connection.connectionId),
    })
    return { statusCode: 200, body: 'joined' }
  }

  if (action === 'newMessage') {
    await broadcast(
      body.spaceId,
      {
        event: 'message-received',
        message: body.message,
        encryptionInfo: body.encryptionInfo,
        from: connectionId,
        timestamp: new Date().toISOString(),
      },
      connectionId,
    )
    return { statusCode: 200, body: 'sent' }
  }

  if (action === 'publicKeyAnnouncement') {
    await sessionStore.savePublicKey(connectionId, body.publicKey)
    await broadcast(
      body.spaceId,
      {
        event: 'public-key-received',
        spaceId: body.spaceId,
        sessionId: connectionId,
        publicKey: body.publicKey,
      },
      connectionId,
    )
    return { statusCode: 200, body: 'announced' }
  }

  return { statusCode: 400, body: 'unknown action' }
}

async function broadcast(spaceId, payload, exceptConnectionId = null) {
  const { sessionStore } = getContext()
  const connections = await sessionStore.getSpaceConnections(spaceId)
  await Promise.all(
    connections
      .filter((connection) => connection.connectionId !== exceptConnectionId)
      .map((connection) => send(connection.connectionId, payload)),
  )
}

async function send(connectionId, payload) {
  const { managementClient, sessionStore } = getContext()
  try {
    await managementClient.postToConnection(connectionId, payload)
  } catch (error) {
    if (error.name === 'GoneException' || error.$metadata?.httpStatusCode === 410) {
      await sessionStore.removeConnection(connectionId)
      return
    }
    throw error
  }
}

function createManagementClient() {
  const {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
  } = require('@aws-sdk/client-apigatewaymanagementapi')
  const client = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_CALLBACK_URL,
  })
  return {
    async postToConnection(connectionId, payload) {
      await client.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(payload)),
        }),
      )
    },
  }
}

function ttlInHours(hours) {
  return Math.floor(Date.now() / 1000) + hours * 60 * 60
}

function resetForTesting() {
  cachedContext = null
}

module.exports = {
  handler,
  resetForTesting,
  setContextForTesting,
  ttlInHours,
}
