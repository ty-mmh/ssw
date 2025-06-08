// public/js/modules/sessionManager.js
;(function () {
  'use strict'
  console.log('👥 FRIENDLYモード セッション管理モジュールを読み込んでいます...')
  let currentSession = null
  const activeSessions = new Map()
  const encryptionLevels = new Map()
  let socket = null
  window.SessionManager = {
    _clearStateForTesting: () => {
      currentSession = null
      activeSessions.clear()
      encryptionLevels.clear()
      socket = null
    },
    setCurrentSession(sessionId, spaceId) {
      currentSession = { sessionId, spaceId, joinedAt: new Date() }
      if (!activeSessions.has(spaceId)) activeSessions.set(spaceId, new Set())
      activeSessions.get(spaceId).add(sessionId)
    },
    setSocket(newSocket) {
      socket = newSocket
      if (socket) {
        socket.on('session-joined', (data) =>
          this.addSessionToSpace(data.spaceId, data.sessionId),
        )
        socket.on('session-left', (data) =>
          this.removeSessionFromSpace(data.spaceId, data.sessionId),
        )
      }
    },
    addSessionToSpace(spaceId, sessionId) {
      const spaceSessions = activeSessions.get(spaceId)
      if (spaceSessions && !spaceSessions.has(sessionId)) {
        spaceSessions.add(sessionId)
        this.updateEncryptionLevel(spaceId)
      }
    },
    removeSessionFromSpace(spaceId, sessionId) {
      const spaceSessions = activeSessions.get(spaceId)
      if (spaceSessions && spaceSessions.has(sessionId)) {
        spaceSessions.delete(sessionId)
        this.updateEncryptionLevel(spaceId)
      }
    },
    updateEncryptionLevel(spaceId) {
      const sessionSet = activeSessions.get(spaceId) || new Set()
      const sessionCount = sessionSet.size
      const newLevel = sessionCount > 1 ? 'hybrid' : 'deterministic'
      const oldLevelInfo = encryptionLevels.get(spaceId) || {}
      if (
        oldLevelInfo.level !== newLevel ||
        oldLevelInfo.sessionCount !== sessionCount
      ) {
        encryptionLevels.set(spaceId, { level: newLevel, sessionCount })
        if (typeof document !== 'undefined')
          document.dispatchEvent(
            new CustomEvent('session-state-changed', {
              detail: { spaceId, level: newLevel, sessionCount },
            }),
          )
      }
    },
    syncAllSessions(spaceId, allSessionIds) {
      activeSessions.set(spaceId, new Set(allSessionIds))
      this.updateEncryptionLevel(spaceId)
    },
    getCurrentSession: () => currentSession,
    getActiveSessionsForSpace: (spaceId) =>
      Array.from(activeSessions.get(spaceId) || []),
    getEncryptionLevelForSpace: (spaceId) =>
      encryptionLevels.get(spaceId) || {
        level: 'deterministic',
        sessionCount: 1,
      },
    leaveSession() {
      if (currentSession && socket?.connected)
        socket.emit('leave-space', currentSession.spaceId)
      if (currentSession)
        activeSessions
          .get(currentSession.spaceId)
          ?.delete(currentSession.sessionId)
      currentSession = null
    },
  }
})()
