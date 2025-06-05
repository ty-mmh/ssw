// public/js/components/enhanced/IntegratedChatUI.js

console.log('✨ FRIENDLYモード 統合チャットUIを読み込んでいます...');

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
  onSendMessage,
  onLeaveSpace,
}) => {
  const { MessageCircle } = window.Icons;

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isLoading) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages]);


  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-900 text-white flex flex-col font-sans' },
    // Header
    React.createElement(
      'header',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto flex items-center justify-between' },
        React.createElement(
          'div', { className: 'flex items-center gap-3' },
          React.createElement(MessageCircle, { className: 'w-6 h-6 text-blue-400' }),
          React.createElement('h1', { className: 'text-lg font-bold' }, currentSpace.passphrase)
        ),
        React.createElement(
            'div', {className: 'flex items-center gap-4'},
             React.createElement(window.EncryptionStatusComponent, { encryptionStatus, encryptionInfo, sessionCount }),
             React.createElement('button', { onClick: onLeaveSpace, className: 'bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm' }, '退室')
        )
      )
    ),
    // Message List
    React.createElement(
      'main',
      { className: 'flex-1 overflow-y-auto p-4' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto space-y-4' },
        sortedMessages.map(msg =>
          React.createElement(window.EnhancedMessageDisplay, {
            key: msg.id,
            message: msg,
            // onRetryDecrypt: handleRetryDecrypt // 必要に応じて実装
          })
        )
      )
    ),
    // Footer
    React.createElement(
      'footer',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 sticky bottom-0' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto flex gap-3 items-end' },
        React.createElement(
          'textarea',
          {
            value: message,
            onChange: e => setMessage(e.target.value),
            onKeyDown: handleKeyPress,
            placeholder: 'メッセージを入力... (Ctrl+Enterで送信)',
            className: 'w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none',
            rows: 1,
            style: { minHeight: '44px', maxHeight: '128px' }
          }
        ),
        React.createElement(
          'button',
          { onClick: onSendMessage, disabled: isLoading || !message.trim(), className: 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 px-6 py-2.5 rounded-lg font-medium' },
          isLoading ? '送信中...' : '送信'
        )
      )
    )
  );
};

console.log('✅ FRIENDLYモード 統合チャットUI 読み込み完了');