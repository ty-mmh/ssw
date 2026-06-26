// public/js/modules/realtime.js
;(function () {
  'use strict'

  function getWsUrl() {
    return window.SSW_CONFIG?.wsUrl || ''
  }

  function connect() {
    const wsUrl = getWsUrl()
    if (wsUrl) return createNativeWebSocketClient(wsUrl)
    return null
  }

  function createNativeWebSocketClient(wsUrl) {
    const handlers = new Map()
    const ws = new WebSocket(wsUrl)
    const client = {
      id: null,
      connected: false,
      on(event, handler) {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event).add(handler)
      },
      off(event) {
        handlers.delete(event)
      },
      emit(event, payload) {
        const action = socketEventToAction(event)
        if (!action || ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify({ action, ...payload }))
      },
      disconnect() {
        ws.close()
      },
    }

    ws.addEventListener('open', () => {
      client.connected = true
      dispatch('connect')
    })
    ws.addEventListener('close', () => {
      client.connected = false
      dispatch('disconnect')
    })
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data)
      if (data.sessionId) client.id = data.sessionId
      dispatch(data.event || data.type || data.action, data)
    })

    function dispatch(event, payload) {
      for (const handler of handlers.get(event) || []) {
        handler(payload)
      }
    }

    return client
  }

  function socketEventToAction(event) {
    return {
      'join-space': 'joinSpace',
      'new-message': 'newMessage',
      'public-key-announcement': 'publicKeyAnnouncement',
      'leave-space': 'leaveSpace',
    }[event]
  }

  window.RealtimeClient = { connect, _createNativeWebSocketClient: createNativeWebSocketClient }
})()
