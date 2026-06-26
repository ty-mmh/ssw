const {
  handler,
  resetForTesting,
  setContextForTesting,
} = require('../lambda/websocket')

describe('WebSocket handler', () => {
  let sessionStore
  let sent

  beforeEach(() => {
    sent = []
    sessionStore = createSessionStore()
    setContextForTesting({
      sessionStore,
      managementClient: {
        async postToConnection(connectionId, payload) {
          sent.push({ connectionId, payload })
        },
      },
    })
  })

  afterEach(() => {
    resetForTesting()
  })

  test('connects, joins, and announces sessions', async () => {
    await handler(wsEvent('$connect', 'c1'))
    await handler(wsEvent('$connect', 'c2'))
    await handler(wsEvent('joinSpace', 'c1', { action: 'joinSpace', spaceId: 's1' }))
    await handler(wsEvent('joinSpace', 'c2', { action: 'joinSpace', spaceId: 's1' }))

    expect(sent.some((item) => item.payload.event === 'space-joined-successfully')).toBe(true)
    expect(sent.some((item) => item.payload.event === 'session-joined')).toBe(true)
    expect(sessionStore._connections.get('c1')).toHaveProperty('expiresAtEpoch')
    expect(sessionStore._connections.get('c1')).not.toHaveProperty('ttlEpoch')
  })

  test('broadcasts messages to other connections only', async () => {
    await handler(wsEvent('$connect', 'c1'))
    await handler(wsEvent('$connect', 'c2'))
    await handler(wsEvent('joinSpace', 'c1', { action: 'joinSpace', spaceId: 's1' }))
    await handler(wsEvent('joinSpace', 'c2', { action: 'joinSpace', spaceId: 's1' }))
    sent = []

    await handler(
      wsEvent('newMessage', 'c1', {
        action: 'newMessage',
        spaceId: 's1',
        message: { id: 'm1', space_id: 's1' },
      }),
    )

    expect(sent).toEqual([
      expect.objectContaining({
        connectionId: 'c2',
        payload: expect.objectContaining({ event: 'message-received' }),
      }),
    ])
  })

  test('broadcasts public key announcements', async () => {
    await handler(wsEvent('$connect', 'c1'))
    await handler(wsEvent('$connect', 'c2'))
    await handler(wsEvent('joinSpace', 'c1', { action: 'joinSpace', spaceId: 's1' }))
    await handler(wsEvent('joinSpace', 'c2', { action: 'joinSpace', spaceId: 's1' }))
    sent = []

    await handler(
      wsEvent('publicKeyAnnouncement', 'c1', {
        action: 'publicKeyAnnouncement',
        spaceId: 's1',
        publicKey: { kty: 'EC' },
      }),
    )

    expect(sent[0]).toEqual(
      expect.objectContaining({
        connectionId: 'c2',
        payload: expect.objectContaining({
          event: 'public-key-received',
          sessionId: 'c1',
        }),
      }),
    )
  })

  test('removes gone connections during broadcast', async () => {
    await handler(wsEvent('$connect', 'c1'))
    await handler(wsEvent('$connect', 'c2'))
    await handler(wsEvent('joinSpace', 'c1', { action: 'joinSpace', spaceId: 's1' }))
    await handler(wsEvent('joinSpace', 'c2', { action: 'joinSpace', spaceId: 's1' }))
    setContextForTesting({
      sessionStore,
      managementClient: {
        async postToConnection() {
          const error = new Error('gone')
          error.name = 'GoneException'
          throw error
        },
      },
    })

    await handler(
      wsEvent('newMessage', 'c1', {
        action: 'newMessage',
        spaceId: 's1',
        message: { id: 'm1', space_id: 's1' },
      }),
    )

    expect(sessionStore._connections.has('c2')).toBe(false)
  })
})

function wsEvent(routeKey, connectionId, body = null) {
  return {
    requestContext: { routeKey, connectionId },
    body: body ? JSON.stringify(body) : null,
  }
}

function createSessionStore() {
  const connections = new Map()
  return {
    _connections: connections,
    async connect(connectionId, expiresAtEpoch) {
      connections.set(connectionId, { connectionId, expiresAtEpoch })
    },
    async disconnect(connectionId) {
      connections.delete(connectionId)
    },
    async joinSpace(connectionId, spaceId, publicKey = null) {
      connections.set(connectionId, {
        ...(connections.get(connectionId) || { connectionId }),
        spaceId,
        sessionId: connectionId,
        publicKey,
      })
      return this.getSpaceConnections(spaceId)
    },
    async savePublicKey(connectionId, publicKey) {
      connections.set(connectionId, {
        ...connections.get(connectionId),
        publicKey,
      })
    },
    async removeConnection(connectionId) {
      connections.delete(connectionId)
    },
    async getSpaceConnections(spaceId) {
      return Array.from(connections.values()).filter(
        (connection) => connection.spaceId === spaceId,
      )
    },
  }
}
