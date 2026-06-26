// public/js/app.js

window.SecureChatApp = () => {
  // --- 状態管理 ---
  const { useState, useEffect, useCallback, useRef } = React;
  const [currentView, setCurrentView] = useState('login')
  const [currentSpace, setCurrentSpace] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [newSpacePassphrase, setNewSpacePassphrase] = useState('')
  const [showCreateSpace, setShowCreateSpace] = useState(false)
  const [message, setMessage] = useState('')
  const [socket, setSocket] = useState(null)
  const [showPassphraseInHeader, setShowPassphraseInHeader] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [encryptionStatus, setEncryptionStatus] = useState('disabled')
  const [encryptionInfo, setEncryptionInfo] = useState({})
  const [sessionCount, setSessionCount] = useState(0)
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [appConfig, setAppConfig] = useState({ maxFileSize: 0 });

  const fileInputRef = useRef(null);

  const mergeRuntimeConfig = (config = {}) => {
    const nextConfig = { ...(window.SSW_CONFIG || {}) }
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        nextConfig[key] = value
      }
    })
    window.SSW_CONFIG = nextConfig
    setAppConfig(nextConfig)
    return nextConfig
  }

  const apiUrl = (endpoint) => {
    const baseUrl = window.SSW_CONFIG?.apiBaseUrl || ''
    return `${baseUrl.replace(/\/$/, '')}/api${endpoint}`
  }

  const mergeMessages = (currentMessages, incomingMessages) => {
    const byId = new Map(currentMessages.map((msg) => [msg.id, msg]))
    incomingMessages.forEach((msg) => {
      if (!byId.has(msg.id)) byId.set(msg.id, msg)
    })
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    )
  }

  useEffect(() => {
    if (window.ErrorHandler) {
      window.ErrorHandler.initialize()
    }
    mergeRuntimeConfig()
    const fetchConfig = async () => {
        try {
            const response = await fetch(apiUrl('/config'));
            const data = await response.json();
            if (data.success) {
                const nextConfig = mergeRuntimeConfig(data.config);
                console.log('サーバーから設定情報を取得しました:', nextConfig);
            }
        } catch (error) {
            console.error('設定情報の取得に失敗しました:', error);
        }
    };
    fetchConfig();
  }, [])

  useEffect(() => {
    if (window.ErrorHandler) {
      window.ErrorHandler.initialize()
    }
  }, [])

  // --- イベントハンドラ ---
  const handleEnterSpace = useCallback(async () => {
    if (!passphrase.trim()) {
      setError('合言葉を入力してください。')
      return
    }
    setIsLoading(true)
    setError('')
    setEncryptionStatus('initializing')
    try {
      await window.API.setPassphraseForApi(passphrase);
      
      const space = await window.API.enterSpace(passphrase)
      setCurrentSpace({ ...space, passphrase })
      const loadedMessages = await window.API.loadMessagesFriendly(space.id)
      setMessages(loadedMessages)
      setEncryptionStatus('enabled')
      setCurrentView('chat')
      setShowPassphraseInHeader(false)
    } catch (err) {
      setError(err.message)
      setEncryptionStatus('error')
      window.API.setPassphraseForApi(null);
    } finally {
      setIsLoading(false)
    }
  }, [passphrase])

  const handleCreateSpace = useCallback(async () => {
    if (!newSpacePassphrase.trim()) {
      window.ErrorHandler.report('validation', '新しい合言葉を入力してください。', { severity: 'warning' })
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await window.API.createSpace(newSpacePassphrase)
      window.ErrorHandler.report('space', '新しい空間を作成しました。作成した合言葉で入室してください。',{ severity: 'success' })
      setShowCreateSpace(false)
      setNewSpacePassphrase('')
    } catch (err) {
    } finally {
      setIsLoading(false)
    }
  }, [newSpacePassphrase])

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !currentSpace) return
    setIsLoading(true)
    try {
      const sentMessage = await window.API.sendMessageFriendly(
        currentSpace.id,
        message,
      )
      if (socket) {
          socket.emit('new-message', {
              message: { ...sentMessage, timestamp: sentMessage.timestamp.toISOString(), encrypted_payload: sentMessage.encrypted_payload },
              spaceId: currentSpace.id,
          });
      }
      setMessages((prev) => [...prev, sentMessage]);
      setMessage('');
    } catch (err) {
      window.ErrorHandler.report('send', err.message, { severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [message, currentSpace, socket])
  
  const handleSendMedia = useCallback(async (file) => {
    if (!file || !currentSpace) return;

    const MAX_FILE_SIZE = appConfig.maxFileSize;
    if (MAX_FILE_SIZE > 0 && file.size > MAX_FILE_SIZE) {
      window.ErrorHandler.report('validation', `ファイルサイズが大きすぎます。${MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください。`, { severity: 'error' });
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const messageType = file.type.startsWith('image/') ? 'image' : 'audio';
    const localBlobUrl = URL.createObjectURL(file);

    setMessages(prev => [...prev, {
        id: tempId,
        timestamp: new Date(),
        message_type: messageType,
        blobUrl: localBlobUrl,
        isLoading: true,
    }]);

    try {
        const sentMessage = await window.API.sendMediaMessage(currentSpace.id, file, messageType);
        const finalMessage = { ...sentMessage, blobUrl: localBlobUrl, isLoading: false };

        if (socket) {
            socket.emit('new-message', {
                message: { ...sentMessage, timestamp: sentMessage.timestamp.toISOString(), encrypted_payload: sentMessage.encrypted_payload },
                spaceId: currentSpace.id,
            });
        }
        setMessages((prev) => prev.map(m => m.id === tempId ? finalMessage : m));

    } catch (err) {
        window.ErrorHandler.report('send_media', err.message, { severity: 'error' });
        setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, text: `[送信失敗: ${file.name}]`, isLoading: false, isError: true } : m));
    }
  }, [currentSpace, socket, appConfig]);

  const handleLeaveSpace = useCallback(() => {
    if (currentSpace) {
      window.KeyExchangeManager.cleanup(currentSpace.id)
      window.Crypto.forceCleanupSpaceKey(currentSpace.id)
      window.SessionManager.leaveSession()
    }
    if (socket) socket.disconnect()
    
    window.API.setPassphraseForApi(null);
    setSocket(null)
    setCurrentSpace(null)
    setCurrentView('login')
    setMessages([])
    setError('')
    setPassphrase('')
    setShowCreateSpace(false)
    setNewSpacePassphrase('')
    setConnectionStatus('disconnected')
    setSessionCount(0)
    setEncryptionInfo({})
  }, [socket, currentSpace])

  const handleOpenImageModal = useCallback((url) => {
    setSelectedImageUrl(url);
    setIsImageModalOpen(true);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setIsImageModalOpen(false);
    setSelectedImageUrl('');
  }, []);

  // ---副作用の管理 (useEffect) ---
  useEffect(() => {
    if (!currentSpace) return

    const newSocket = window.RealtimeClient
      ? window.RealtimeClient.connect()
      : null
    if (!newSocket) {
      setConnectionStatus('polling')
      return
    }
    setSocket(newSocket)
    setConnectionStatus('connecting')

    newSocket.on('connect', async () => {
      setConnectionStatus('connected')
      newSocket.emit('join-space', currentSpace.id)

      if (window.KeyExchangeManager) {
        try {
          await window.KeyExchangeManager.initialize(newSocket, currentSpace.id)
        } catch (error) {
          console.error('KeyExchangeManagerの初期化に失敗しました', error)
          setError('暗号化の初期設定に失敗しました。')
        }
      }
    })

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected')
      if (window.KeyExchangeManager && currentSpace) {
        window.KeyExchangeManager.cleanup(currentSpace.id)
      }
    })

    newSocket.on('message-received', async (data) => {
      if (data.message && data.message.space_id === currentSpace.id) {
        let receivedMessage = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
        }
        
        setMessages((prev) => [...prev, { ...receivedMessage, isLoading: true }]);

        if (receivedMessage.encrypted) {
           try {
              if (receivedMessage.message_type === 'text') {
                 receivedMessage.text =
                  await window.Crypto.decryptMessageWithFallback(
                    receivedMessage.encrypted_payload,
                    currentSpace.id,
                  );
              } else if (receivedMessage.message_type === 'image' || receivedMessage.message_type === 'audio') {
                 const encryptedBuffer = await window.API.downloadEncryptedContent(receivedMessage.encrypted_content);
                 const decryptedBuffer = await window.Crypto.decryptFile(encryptedBuffer, receivedMessage.encrypted_payload, currentSpace.id);
                 const blob = new Blob([decryptedBuffer], { type: receivedMessage.metadata.type });
                 receivedMessage.blobUrl = URL.createObjectURL(blob);
              }
           } catch (e) {
              console.warn(`[リアルタイム] メッセージ[${receivedMessage.id}]の処理中にエラー:`, e.message);
              receivedMessage.text = `[読み込みに失敗しました]`
              receivedMessage.isError = true;
           }
        }
        
        setMessages((prev) => prev.map(m => m.id === receivedMessage.id ? { ...receivedMessage, isLoading: false } : m));
      }
    })

    newSocket.on('space-joined-successfully', (data) => {
      if (data.spaceId === currentSpace.id && window.SessionManager) {
        window.SessionManager.setCurrentSession(data.sessionId, currentSpace.id)
        window.SessionManager.setSocket(newSocket)
        window.SessionManager.syncAllSessions(data.spaceId, data.allSessionIds)
        if (window.KeyExchangeManager) {
          window.KeyExchangeManager.announcePublicKey()
        }
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [currentSpace])

  useEffect(() => {
    if (!currentSpace) return
    const intervalMs = window.SSW_CONFIG?.pollingIntervalMs || 5000
    const timer = setInterval(async () => {
      try {
        const lastTimestamp = messages.reduce((latest, msg) => {
          const timestamp = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
          return !latest || timestamp > latest ? timestamp : latest
        }, null)
        const loadedMessages = await window.API.loadMessagesFriendly(
          currentSpace.id,
          lastTimestamp ? { since: lastTimestamp.toISOString() } : {},
        )
        if (loadedMessages.length > 0) {
          setMessages((prev) => mergeMessages(prev, loadedMessages))
        }
      } catch (error) {
        console.warn('polling update failed', error.message)
      }
    }, intervalMs)
    return () => clearInterval(timer)
  }, [currentSpace, messages])

  useEffect(() => {
    const handleSessionStateChange = (event) => {
      if (currentSpace && event.detail.spaceId === currentSpace.id) {
        const { level, sessionCount } = event.detail;
        setSessionCount(sessionCount);
        setEncryptionInfo((prev) => ({ ...prev, level, sessionCount }));
        
        if (window.KeyExchangeManager) {
            setTimeout(() => {
                window.KeyExchangeManager.announcePublicKey();
            }, Math.random() * 400 + 100);
        }
      }
    };

    document.addEventListener('session-state-changed', handleSessionStateChange);
    return () => {
      document.removeEventListener('session-state-changed', handleSessionStateChange);
    };
  }, [currentSpace]);

  // --- レンダリング ---
  return React.createElement(
    React.Fragment,
    null,
    window.UnifiedErrorDisplayComponent &&
      React.createElement(window.UnifiedErrorDisplayComponent),
    window.AudioRecorderModal && React.createElement(window.AudioRecorderModal, {
        isOpen: isAudioModalOpen,
        onClose: () => setIsAudioModalOpen(false),
        onPost: handleSendMedia
    }),
    window.ImageModal && React.createElement(window.ImageModal, {
        isOpen: isImageModalOpen,
        onClose: handleCloseImageModal,
        imageUrl: selectedImageUrl
    }),
    (() => {
      if (currentView === 'login') {
        return React.createElement(window.LoginComponent, {
          passphrase, setPassphrase, error, setError, newSpacePassphrase,
          setNewSpacePassphrase, showCreateSpace, setShowCreateSpace, isLoading,
          onEnterSpace: handleEnterSpace, onCreateSpace: handleCreateSpace,
        })
      }

      if (currentView === 'chat') {
        return React.createElement(window.IntegratedChatUI, {
          currentSpace, messages, message, setMessage, isLoading,
          connectionStatus, encryptionStatus, encryptionInfo, sessionCount,
          showPassphraseInHeader, setShowPassphraseInHeader,
          onSendMessage: handleSendMessage,
          onLeaveSpace: handleLeaveSpace,
          onSendMedia: handleSendMedia,
          onToggleAudioModal: setIsAudioModalOpen,
          onOpenImageModal: handleOpenImageModal,
          fileInputRef,
        })
      }

      return React.createElement('div', null, '読み込み中...')
    })(),
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(SecureChatApp),
  )
})
