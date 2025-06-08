// public/js/modules/KeyExchangeManager.js
;(function () {
  'use strict'
  console.log('🔐 FRIENDLYモード キー交換管理モジュールを読み込んでいます...')
  const peerPublicKeys = new Map()
  let socket = null,
    currentSpaceId = null,
    myKeyPair = null,
    initializePromise = null
  const generateKeyPair = async () =>
    await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, !0, [
      'deriveKey',
      'deriveBits',
    ])
  const exportPublicKey = async (publicKey) =>
    await crypto.subtle.exportKey('jwk', publicKey)
  window.KeyExchangeManager = {
    _clearStateForTesting: () => {
      peerPublicKeys.clear()
      socket = null
      currentSpaceId = null
      myKeyPair = null
      initializePromise = null
    },
    async initialize(newSocket, spaceId) {
      initializePromise = new Promise(async (resolve, reject) => {
        try {
          socket = newSocket
          currentSpaceId = spaceId
          myKeyPair = await generateKeyPair()
          if (!peerPublicKeys.has(spaceId))
            peerPublicKeys.set(spaceId, new Map())
          socket.off('public-key-received')
          socket.on(
            'public-key-received',
            this.handlePublicKeyReceived.bind(this),
          )
          resolve()
        } catch (error) {
          reject(error)
        }
      })
      return initializePromise
    },
    async announcePublicKey() {
      await initializePromise
      if (!socket || !myKeyPair) return
      const currentSession = window.SessionManager.getCurrentSession()
      if (!currentSession) return
      const publicKeyJWK = await exportPublicKey(myKeyPair.publicKey)
      socket.emit('public-key-announcement', {
        spaceId: currentSpaceId,
        sessionId: currentSession.sessionId,
        publicKey: publicKeyJWK,
      })
    },
    handlePublicKeyReceived(data) {
      if (!data || data.spaceId !== currentSpaceId || !data.sessionId) return
      const mySessionId = window.SessionManager.getCurrentSession()?.sessionId
      if (data.sessionId === mySessionId) return
      const spacePeers = peerPublicKeys.get(data.spaceId)
      if (spacePeers) {
        spacePeers.set(data.sessionId, data.publicKey)
        if (typeof document !== 'undefined')
          document.dispatchEvent(
            new CustomEvent('key-exchange-update', {
              detail: { spaceId: data.spaceId, peerCount: spacePeers.size },
            }),
          )
      }
    },
    getMyPrivateKey: () => (myKeyPair ? myKeyPair.privateKey : null),
    getPeerPublicKey: (spaceId, sessionId) =>
      peerPublicKeys.get(spaceId)?.get(sessionId) || null,
    cleanup(spaceId) {
      if (socket) socket.off('public-key-received')
      peerPublicKeys.delete(spaceId)
      myKeyPair = null
    },
  }
})()
