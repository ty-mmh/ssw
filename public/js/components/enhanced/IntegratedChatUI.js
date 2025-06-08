// public/js/components/enhanced/IntegratedChatUI.js

window.IntegratedChatUI = ({
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
  onSendMessage,
  onLeaveSpace,
}) => {
  const { MessageCircle, Users } = window.Icons
  const chatContainerRef = React.useRef(null)

  // [追加] 新しいメッセージが追加された際に、自動で一番下までスクロールする
  React.useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages]) // messages配列が変更されるたびに実行

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isLoading) {
      e.preventDefault()
      onSendMessage()
    }
  }

  // [修正] メッセージのソート順を昇順（古いものが先頭）に戻す
  const sortedMessages = React.useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      ),
    [messages],
  )

  return React.createElement(
    'div',
    {
      className:
        'h-screen w-screen bg-gradient-to-br from-gray-900 via-stone-950 to-black text-gray-200 flex flex-col overflow-hidden',
    },
    // Header (変更なし)
    React.createElement(
      'header',
      { className: 'glass-pane z-10 flex-shrink-0' },
      React.createElement(
        'div',
        {
          className:
            'max-w-5xl mx-auto p-3 sm:p-4 flex justify-between items-center',
        },
        React.createElement(
          'div',
          { className: 'flex items-center gap-3 min-w-0' },
          React.createElement(MessageCircle, {
            className: 'w-6 h-6 text-primary flex-shrink-0',
          }),
          React.createElement(
            'button',
            {
              onClick: () => setShowPassphraseInHeader((prev) => !prev),
              className:
                'text-lg font-bold truncate hover:bg-gray-700/50 px-2 py-1 rounded-md transition',
              title: '合言葉の表示/非表示',
            },
            showPassphraseInHeader
              ? currentSpace.passphrase
              : '•'.repeat(currentSpace.passphrase.length),
          ),
        ),
        React.createElement(
          'div',
          { className: 'flex items-center gap-2 sm:gap-4' },
          React.createElement(window.EncryptionStatusComponent, {
            encryptionStatus,
            encryptionInfo,
            sessionCount,
          }),
          React.createElement(
            'button',
            {
              onClick: onLeaveSpace,
              className:
                'bg-danger/80 hover:bg-danger px-3 py-2 rounded-lg text-sm transition',
            },
            '退室',
          ),
        ),
      ),
    ),
    // [修正] Message List のレイアウトを通常の top-to-bottom に戻す
    React.createElement(
      'main',
      { ref: chatContainerRef, className: 'flex-1 overflow-y-auto p-4' },
      React.createElement(
        'div',
        { className: 'max-w-5xl mx-auto space-y-4' },
        sortedMessages.length > 0
          ? // [修正] mapの対象を昇順ソート済みの配列に変更
            sortedMessages.map((msg) =>
              React.createElement(window.EnhancedMessageDisplay, {
                key: msg.id,
                message: msg,
              }),
            )
          : React.createElement(
              'div',
              { className: 'text-center text-gray-500 pt-20 animate-fade-in' },
              React.createElement(Users, { className: 'w-24 h-24 mx-auto' }),
              React.createElement(
                'p',
                { className: 'mt-4 text-lg' },
                'ようこそ',
              ),
              React.createElement(
                'p',
                null,
                '最初のメッセージを送信してください。',
              ),
            ),
      ),
    ),
    // Footer
    React.createElement(
      'footer',
      { className: 'glass-pane sticky bottom-0 z-10' },
      React.createElement(
        'div',
        { className: 'max-w-5xl mx-auto p-2 sm:p-4' },
        React.createElement(
          'div',
          { className: 'flex gap-3 items-end' },
          React.createElement('textarea', {
            value: message,
            onChange: (e) => setMessage(e.target.value),
            onKeyDown: handleKeyPress,
            placeholder: 'メッセージを入力...',
            className:
              'w-full px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none resize-none transition-all',
            rows: 1,
            style: { minHeight: '44px', maxHeight: '150px' },
          }),
          React.createElement(
            'button',
            {
              onClick: onSendMessage,
              disabled: isLoading || !message.trim(),
              className:
                'h-11 bg-primary hover:bg-blue-600 disabled:bg-gray-600 px-5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center whitespace-nowrap',
            },
            isLoading
              ? React.createElement('div', {
                  className:
                    'w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin',
                })
              : '送信',
          ),
        ),
      ),
    ),
  )
}
