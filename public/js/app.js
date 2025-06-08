// public/js/app.js

console.log('🚀 FRIENDLYモード アプリケーション本体を読み込んでいます...')

const { useState, useEffect, useCallback } = React

const SecureChatApp = () => {
  // --- 状態管理 (変更なし) ---
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

  // [追加] アプリケーション起動時に一度だけ実行するuseEffect
  useEffect(() => {
    // 高度なエラーハンドリングシステムを初期化
    if (window.ErrorHandler) {
      window.ErrorHandler.initialize()
    }
  }, [])

  // --- イベントハンドラ (変更なし) ---
  const handleEnterSpace = useCallback(async () => {
    if (!passphrase.trim()) {
      setError('合言葉を入力してください。')
      return
    }
    setIsLoading(true)
    setError('')
    setEncryptionStatus('initializing')
    try {
      const space = await window.API.enterSpace(passphrase)
      setCurrentSpace(space)
      const loadedMessages = await window.API.loadMessagesFriendly(space.id)
      setMessages(loadedMessages)
      setEncryptionStatus('enabled')
      setCurrentView('chat')
      setShowPassphraseInHeader(false)
    } catch (err) {
      setError(err.message)
      setEncryptionStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [passphrase])

  // 空間作成処理
  const handleCreateSpace = useCallback(async () => {
    if (!newSpacePassphrase.trim()) {
      // [修正] エラー通知
      window.ErrorHandler.report(
        'validation',
        '新しい合言葉を入力してください。',
        { severity: 'warning' },
      )
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await window.API.createSpace(newSpacePassphrase)
      // [修正] 成功通知
      window.ErrorHandler.report(
        'space',
        '新しい空間を作成しました。作成した合言葉で入室してください。',
        { severity: 'success' },
      )
      setShowCreateSpace(false)
      setNewSpacePassphrase('')
    } catch (err) {
      // エラーはapi.jsで報告されるので、ここでは何もしなくても良い
      // setError(err.message); // フォーム直下のエラー表示を残す場合はこのまま
    } finally {
      setIsLoading(false)
    }
  }, [newSpacePassphrase])

  // メッセージ送信処理
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !currentSpace) return
    setIsLoading(true)
    try {
      const sentMessage = await window.API.sendMessageFriendly(
        currentSpace.id,
        message,
      )
      setMessages((prev) => [...prev, sentMessage])
      setMessage('')
      if (socket) {
        const payloadForBroadcast = {
          ...sentMessage,
          timestamp: sentMessage.timestamp.toISOString(),
        }
        socket.emit('new-message', {
          message: payloadForBroadcast,
          spaceId: currentSpace.id,
        })
      }
    } catch (err) {
      // [修正] エラー通知
      window.ErrorHandler.report('send', err.message, { severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [message, currentSpace, socket])

  // [修正] 空間退室処理
  const handleLeaveSpace = useCallback(() => {
    console.log(`[App] 空間[${currentSpace?.id}]からの退出処理を開始します。`)

    // [追加] 各モジュールのクリーンアップ処理を呼び出す
    if (currentSpace) {
      window.KeyExchangeManager.cleanup(currentSpace.id)
      window.Crypto.forceCleanupSpaceKey(currentSpace.id)
      window.SessionManager.leaveSession()
    }

    if (socket) {
      socket.disconnect()
    }

    // UIの状態をリセット
    setSocket(null)
    setCurrentSpace(null)
    setCurrentView('login')
    setMessages([])
    setError('')
    setPassphrase('') // 入力中のパスフレーズもクリア

    // [追加] 空間作成フォームの状態もリセットする
    setShowCreateSpace(false)
    setNewSpacePassphrase('')

    setConnectionStatus('disconnected')
    setSessionCount(0)
    setEncryptionInfo({})

    console.log('[App] 退出処理が完了し、状態をリセットしました。')
  }, [socket, currentSpace]) // 依存配列にcurrentSpaceを追加

  // ---副作用の管理 (useEffect) ---

  // Socket.IO接続管理
  useEffect(() => {
    if (!currentSpace) return

    const newSocket = io()
    setSocket(newSocket)
    setConnectionStatus('connecting')

    newSocket.on('connect', async () => {
      setConnectionStatus('connected')

      // [最重要修正箇所] socket.idを正式なセッションIDとして採用する
      window.SessionManager.setCurrentSession(newSocket.id, currentSpace.id)

      newSocket.emit('join-space', currentSpace.id)
      window.SessionManager.setSocket(newSocket)

      if (window.KeyExchangeManager) {
        try {
          await window.KeyExchangeManager.initialize(newSocket, currentSpace.id)
          await window.KeyExchangeManager.announcePublicKey()
        } catch (error) {
          console.error('KeyExchangeManagerの初期化に失敗しました', error)
          setError('暗号化の初期設定に失敗しました。')
        }
      }
    })

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected')
      if (window.KeyExchangeManager) {
        window.KeyExchangeManager.cleanup(currentSpace.id)
      }
    })

    newSocket.on('message-received', async (data) => {
      // [最重要修正箇所] data.spaceId -> data.message.space_id に修正
      if (data.message && data.message.space_id === currentSpace.id) {
        const activeSessionIds =
          window.SessionManager.getActiveSessionsForSpace(currentSpace.id)
        const receivedMessage = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
        }

        if (receivedMessage.encrypted) {
          try {
            let payloadToDecrypt = receivedMessage.encrypted_payload
            if (typeof payloadToDecrypt === 'string') {
              payloadToDecrypt = JSON.parse(payloadToDecrypt)
            }

            if (!payloadToDecrypt) {
              throw new Error('暗号化ペイロードが見つかりません。')
            }

            const decryptedText =
              await window.Crypto.decryptMessageWithFallback(
                payloadToDecrypt,
                currentSpace.id,
                activeSessionIds,
              )
            receivedMessage.text = decryptedText
            receivedMessage.encryptionType = payloadToDecrypt.type
          } catch (e) {
            console.warn(
              `[リアルタイム] メッセージ[${receivedMessage.id}]の復号化に失敗:`,
              e.message,
            )
            receivedMessage.text = `[復号化に失敗しました]`
            receivedMessage.encryptionType = 'error'
          }
        }

        setMessages((prev) => {
          const messageExists = prev.some(
            (msg) => msg.id === receivedMessage.id,
          )
          if (messageExists) {
            return prev.map((msg) =>
              msg.id === receivedMessage.id ? receivedMessage : msg,
            )
          } else {
            return [...prev, receivedMessage]
          }
        })
      }
    })

    // [追加] 空間参加成功と状態同期のイベントハンドラ
    newSocket.on('space-joined-successfully', (data) => {
      if (data.spaceId === currentSpace.id && window.SessionManager) {
        console.log(
          '[App] 空間参加成功。サーバーからセッション状態を同期します。',
          data,
        )
        window.SessionManager.syncAllSessions(data.spaceId, data.allSessionIds)
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [currentSpace])

  // セッション数と暗号化レベルの同期
  useEffect(() => {
    const updateStatus = (event) => {
      if (currentSpace && event.detail.spaceId === currentSpace.id) {
        const { level, sessionCount } = event.detail
        setSessionCount(sessionCount)
        setEncryptionInfo((prev) => ({ ...prev, level, sessionCount }))
      }
    }
    document.addEventListener('encryption-level-changed', updateStatus)
    return () =>
      document.removeEventListener('encryption-level-changed', updateStatus)
  }, [currentSpace])

  // [修正] セッション状態の変更をトリガーにした副作用を追加
  useEffect(() => {
    const handleSessionStateChange = (event) => {
      if (currentSpace && event.detail.spaceId === currentSpace.id) {
        console.log(
          '[App] セッション状態の変更を検知。キー交換を再トリガーします。',
          event.detail,
        )

        const { level, sessionCount } = event.detail
        setSessionCount(sessionCount)
        setEncryptionInfo((prev) => ({ ...prev, level, sessionCount }))

        // 参加者が複数人になった、または人数が変わった場合に鍵交換を促す
        if (window.KeyExchangeManager) {
          // 相手の参加を検知してから、少し待って自分の鍵をアナウンスする
          setTimeout(
            () => {
              console.log(
                '[App] 変更に応じて、自身の公開鍵を再アナウンスします。',
              )
              window.KeyExchangeManager.announcePublicKey()
            },
            Math.random() * 500 + 200,
          ) // 200-700msのランダムな遅延で通知の衝突を避ける
        }
      }
    }
    // [修正] イベント名を `session-state-changed` に変更
    document.addEventListener('session-state-changed', handleSessionStateChange)
    return () =>
      document.removeEventListener(
        'session-state-changed',
        handleSessionStateChange,
      )
  }, [currentSpace]) // currentSpace が変わった時のみリスナーを再設定

  // --- レンダリング (変更なし) ---
  // [修正] アプリケーション全体をフラグメントで囲み、エラー表示コンポーネントを追加
  return React.createElement(
    React.Fragment,
    null,
    // エラー表示コンポーネントを常に最前面に配置
    window.UnifiedErrorDisplayComponent &&
      React.createElement(window.UnifiedErrorDisplayComponent),
    // メインのビュー
    (() => {
      if (currentView === 'login') {
        return React.createElement(window.LoginComponent, {
          passphrase,
          setPassphrase,
          error,
          setError,
          newSpacePassphrase,
          setNewSpacePassphrase,
          showCreateSpace,
          setShowCreateSpace,
          isLoading,
          onEnterSpace: handleEnterSpace,
          onCreateSpace: handleCreateSpace,
        })
      }

      if (currentView === 'chat') {
        return React.createElement(window.IntegratedChatUI, {
          currentSpace,
          messages,
          message,
          setMessage,
          isLoading,
          connectionStatus,
          encryptionStatus,
          encryptionInfo,
          sessionCount,
          showPassphraseInHeader,
          setShowPassphraseInHeader,
          onSendMessage: handleSendMessage,
          onLeaveSpace: handleLeaveSpace,
        })
      }

      return React.createElement('div', null, '読み込み中...')
    })(),
  )
}

// アプリケーションのマウント
document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(SecureChatApp),
  )
  console.log('✅ FRIENDLYモード アプリケーションがDOMにマウントされました。')
})
