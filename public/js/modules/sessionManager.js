// public/js/modules/sessionManager.js

console.log('👥 FRIENDLYモード セッション管理モジュールを読み込んでいます...');

window.SessionManager = (() => {
  let currentSession = null;
  const activeSessions = new Map(); // spaceId -> Set<sessionId>
  const encryptionLevels = new Map();
  let socket = null;

  return {
    // [修正] 自身のセッション情報をsocket.idを元に設定する
    setCurrentSession(sessionId, spaceId) {
        currentSession = { sessionId, spaceId, joinedAt: new Date() };
        // sessionStorageは不要になるか、あるいはsocket.idを保存する形になる
        sessionStorage.setItem('secureChatSessionId', sessionId); 
        
        if (!activeSessions.has(spaceId)) {
          activeSessions.set(spaceId, new Set());
        }
        activeSessions.get(spaceId).add(sessionId);
        console.log(`[SessionManager] 自身のセッションを確立しました: ${sessionId.substring(0,8)}...`);
    },

    setSocket(newSocket) {
        socket = newSocket;
        // [修正] イベントリスナーをよりシンプルに
        socket.on('session-joined', (data) => this.addSessionToSpace(data.spaceId, data.sessionId));
        socket.on('session-left', (data) => this.removeSessionFromSpace(data.spaceId, data.sessionId));
    },

    addSessionToSpace(spaceId, sessionId) {
        if (!activeSessions.has(spaceId)) {
            activeSessions.set(spaceId, new Set());
        }
        const spaceSessions = activeSessions.get(spaceId);
        if (!spaceSessions.has(sessionId)) {
            spaceSessions.add(sessionId);
            console.log(`[SessionManager] ピア[${sessionId.substring(0,8)}]が参加しました。`);
            this.updateEncryptionLevel(spaceId);
        }
    },

    removeSessionFromSpace(spaceId, sessionId) {
        const spaceSessions = activeSessions.get(spaceId);
        if (spaceSessions && spaceSessions.has(sessionId)) {
            spaceSessions.delete(sessionId);
            console.log(`[SessionManager] ピア[${sessionId.substring(0,8)}]が退出しました。`);
            this.updateEncryptionLevel(spaceId);
        }
    },

    updateEncryptionLevel(spaceId) {
      const sessionSet = activeSessions.get(spaceId) || new Set();
      const sessionCount = sessionSet.size;
      const newLevel = sessionCount > 1 ? 'hybrid' : 'deterministic';
      const oldLevelInfo = encryptionLevels.get(spaceId) || {};
      const hasChanged = oldLevelInfo.level !== newLevel || oldLevelInfo.sessionCount !== sessionCount;

      encryptionLevels.set(spaceId, { level: newLevel, sessionCount });
      
      if (hasChanged) {
        console.log(`[SessionManager] 状態変化を検出: ${oldLevelInfo.level || 'N/A'}(${oldLevelInfo.sessionCount || 0}) -> ${newLevel}(${sessionCount})`);
        document.dispatchEvent(new CustomEvent('session-state-changed', { 
            detail: { spaceId, level: newLevel, sessionCount } 
        }));
      }
    },
    
    syncAllSessions(spaceId, allSessionIds) {
        const sessionSet = new Set(allSessionIds);
        activeSessions.set(spaceId, sessionSet);
        console.log(`[SessionManager] 空間[${spaceId}]のセッションを完全に同期しました。参加者: ${sessionSet.size}人`);
        this.updateEncryptionLevel(spaceId);
    },

    getCurrentSession: () => currentSession,
    getActiveSessionsForSpace: (spaceId) => Array.from(activeSessions.get(spaceId) || []),
    getEncryptionLevelForSpace: (spaceId) => encryptionLevels.get(spaceId) || { level: 'deterministic', sessionCount: 1 },

    leaveSession() {
        if (currentSession && socket && socket.connected) {
            socket.emit('leave-space', currentSession.spaceId);
        }
        if (currentSession) {
            const spaceSessions = activeSessions.get(currentSession.spaceId);
            if(spaceSessions) {
                spaceSessions.delete(currentSession.sessionId);
            }
        }
        currentSession = null;
        sessionStorage.removeItem('secureChatSessionId');
        console.log("セッションを終了しました。");
    }
  };
})();