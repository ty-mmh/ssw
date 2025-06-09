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
  onSendMedia,
  onToggleAudioModal,
  onOpenImageModal,
  fileInputRef,
}) => {
  // [修正] Send アイコンを正しく分割代入で取得する
  const { MessageCircle, Users, Image, Mic, Send } = window.Icons;
  const chatContainerRef = React.useRef(null);

  React.useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isLoading) {
      e.preventDefault();
      onSendMessage();
    }
  };
  
  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          onSendMedia(file);
      }
      e.target.value = null;
  };

  const sortedMessages = React.useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      ),
    [messages],
  );

  return React.createElement(
    'div',
    { className: 'h-screen w-screen bg-gradient-to-br from-gray-900 via-stone-950 to-black text-gray-200 flex flex-col overflow-hidden' },
    // Header
    React.createElement(
      'header',
      { className: 'glass-pane z-10 flex-shrink-0' },
      React.createElement(
        'div',
        { className: 'max-w-5xl mx-auto p-3 sm:p-4 flex justify-between items-center' },
        React.createElement(
          'div',
          { className: 'flex items-center gap-3 min-w-0' },
          React.createElement(MessageCircle, { className: 'w-6 h-6 text-primary flex-shrink-0' }),
          React.createElement(
            'button',
            {
              onClick: () => setShowPassphraseInHeader((prev) => !prev),
              className: 'text-lg font-bold truncate hover:bg-gray-700/50 px-2 py-1 rounded-md transition',
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
            { onClick: onLeaveSpace, className: 'bg-danger/80 hover:bg-danger px-3 py-2 rounded-lg text-sm transition' },
            '退室',
          ),
        ),
      ),
    ),
    // Message List
    React.createElement(
      'main',
      { ref: chatContainerRef, className: 'flex-1 overflow-y-auto p-4' },
      React.createElement(
        'div',
        { className: 'max-w-5xl mx-auto space-y-4' },
        sortedMessages.length > 0
          ? sortedMessages.map((msg) =>
              React.createElement(window.EnhancedMessageDisplay, {
                key: msg.id,
                message: msg,
                onOpenImageModal: onOpenImageModal,
              }),
            )
          : React.createElement(
              'div',
              { className: 'text-center text-gray-500 pt-20 animate-fade-in' },
              React.createElement(Users, { className: 'w-24 h-24 mx-auto' }),
              React.createElement('p', { className: 'mt-4 text-lg' }, 'ようこそ'),
              React.createElement('p', null, '最初のメッセージを送信してください。'),
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
          React.createElement('input', {
            type: 'file',
            ref: fileInputRef,
            onChange: handleFileChange,
            className: 'hidden',
            accept: 'image/jpeg,image/png,image/gif,image/webp,audio/mp4,audio/mpeg,audio/webm,audio/ogg',
          }),
          React.createElement(
              'button',
              {
                  onClick: () => fileInputRef.current.click(),
                  disabled: isLoading,
                  className: 'h-11 w-11 flex-shrink-0 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  title: '画像・音声ファイル投稿'
              },
              React.createElement(Image, { className: 'w-6 h-6 text-gray-300' })
          ),
          React.createElement(
              'button',
              {
                  onClick: () => onToggleAudioModal(true),
                  disabled: isLoading,
                  className: 'h-11 w-11 flex-shrink-0 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  title: '音声録音'
              },
              React.createElement(Mic, { className: 'w-6 h-6 text-gray-300' })
          ),
          React.createElement('textarea', {
            value: message,
            onChange: (e) => setMessage(e.target.value),
            onKeyDown: handleKeyPress,
            placeholder: 'メッセージを入力...',
            className: 'w-full px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none resize-none transition-all',
            rows: 1,
            style: { minHeight: '44px', maxHeight: '150px' },
          }),
          React.createElement(
            'button',
            {
              onClick: onSendMessage,
              disabled: isLoading || !message.trim(),
              className: 'h-11 w-11 bg-primary hover:bg-blue-600 disabled:bg-gray-600 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0',
              title: '送信'
            },
            isLoading
              ? React.createElement('div', {
                  className: 'w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin',
                })
              : React.createElement(Send, {className: 'w-6 h-6'})
          ),
        ),
      ),
    ),
  )
}