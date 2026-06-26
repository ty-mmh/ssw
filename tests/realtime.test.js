const fs = require('fs')
const path = require('path')

describe('RealtimeClient', () => {
  beforeEach(() => {
    jest.resetModules()
    window.SSW_CONFIG = {}
    delete window.io
    delete global.io
    delete global.WebSocket
    FakeWebSocket.instances = []
  })

  test('returns null for polling fallback when no WebSocket URL is configured', () => {
    window.io = jest.fn()
    require('../public/js/modules/realtime.js')

    expect(window.RealtimeClient.connect()).toBeNull()
    expect(window.io).not.toHaveBeenCalled()
  })

  test('uses native WebSocket and maps socket-style events to actions', () => {
    global.WebSocket = FakeWebSocket
    window.SSW_CONFIG = { wsUrl: 'wss://example.test/ws' }
    require('../public/js/modules/realtime.js')

    const client = window.RealtimeClient.connect()
    const ws = FakeWebSocket.instances[0]
    const received = jest.fn()
    client.on('space-joined-successfully', received)

    ws.open()
    client.emit('join-space', { spaceId: 'space-1' })
    ws.message({
      event: 'space-joined-successfully',
      sessionId: 'connection-1',
      spaceId: 'space-1',
    })

    expect(ws.url).toBe('wss://example.test/ws')
    expect(JSON.parse(ws.sent[0])).toEqual({
      action: 'joinSpace',
      spaceId: 'space-1',
    })
    expect(client.id).toBe('connection-1')
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'connection-1' }),
    )
  })

  test('keeps compatibility for string join-space payloads', () => {
    global.WebSocket = FakeWebSocket
    window.SSW_CONFIG = { wsUrl: 'wss://example.test/ws' }
    require('../public/js/modules/realtime.js')

    const client = window.RealtimeClient.connect()
    const ws = FakeWebSocket.instances[0]

    ws.open()
    client.emit('join-space', 'space-1')

    expect(JSON.parse(ws.sent[0])).toEqual({
      action: 'joinSpace',
      spaceId: 'space-1',
    })
  })

  test('app joins native WebSocket with an object payload', () => {
    const appSource = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'js', 'app.js'),
      'utf8',
    )

    expect(appSource).toContain(
      "newSocket.emit('join-space', { spaceId: currentSpace.id })",
    )
    expect(appSource).not.toContain("newSocket.emit('join-space', currentSpace.id)")
  })
})

class FakeWebSocket {
  static OPEN = 1
  static instances = []

  constructor(url) {
    this.url = url
    this.readyState = 0
    this.listeners = {}
    this.sent = []
    FakeWebSocket.instances.push(this)
  }

  addEventListener(event, handler) {
    this.listeners[event] = handler
  }

  send(data) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.listeners.close?.({})
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.listeners.open?.({})
  }

  message(data) {
    this.listeners.message?.({ data: JSON.stringify(data) })
  }
}
