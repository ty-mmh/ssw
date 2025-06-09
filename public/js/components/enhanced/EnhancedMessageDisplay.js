// public/js/components/enhanced/EnhancedMessageDisplay.js

console.log(
  '✨ FRIENDLYモード 拡張メッセージ表示コンポーネントを読み込んでいます...',
)

window.EnhancedMessageDisplay = ({ message, onOpenImageModal }) => {
  const { Lock, Key, Users, Clock, Trash2, AlertCircle, Image } = window.Icons
  const { formatTime, getMessageTimeRemaining } = window.Utils

  const isError = message.isError; // [修正]
  const timeRemaining = getMessageTimeRemaining(message.expires_at)

  const getEncryptionIcon = () => {
    if (!message.encrypted) return null
    const commonClass = 'w-3 h-3'
    switch (message.encryptionType) {
      case 'hybrid':
        return React.createElement(Users, {
          className: `${commonClass} text-purple-400`,
          title: `ハイブリッド暗号化 (${message.sessionParticipants?.length || 0}セッション)`,
        })
      case 'deterministic':
        return React.createElement(Key, {
          className: `${commonClass} text-blue-400`,
          title: '決定的暗号化',
        })
      case 'error':
        return React.createElement(AlertCircle, {
          className: `${commonClass} text-red-400`,
          title: '復号化エラー',
        })
      default:
        return React.createElement(Lock, {
          className: `${commonClass} text-green-400`,
          title: '暗号化済み',
        })
    }
  }
  
  const renderMessageContent = () => {
    // [修正] ローディング表示をスピナーに変更
    if (message.isLoading) {
        return React.createElement('div', { className: 'flex items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg mt-2' },
            React.createElement('div', { className: 'w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin' })
        );
    }
    if (isError) {
        return React.createElement('div', { className: 'text-red-400' }, message.text || '[エラーが発生しました]');
    }

    if (message.message_type === 'image' && message.blobUrl) {
      return React.createElement('img', { 
          src: message.blobUrl, 
          alt: message.metadata?.name || '投稿画像',
          className: 'max-w-full max-h-96 rounded-lg mt-2 cursor-pointer transition hover:opacity-80',
          onClick: () => onOpenImageModal(message.blobUrl)
      });
    }
    
    if (message.message_type === 'audio' && message.blobUrl) {
        return React.createElement('audio', {
            controls: true,
            src: message.blobUrl,
            className: 'w-full max-w-xs'
        });
    }

    return React.createElement(
        'pre',
        { className: `text-gray-100 leading-relaxed whitespace-pre-wrap font-sans break-words flex-1`},
        message.text,
      );
  }

  return React.createElement(
    'article',
    {
      className: `bg-gray-800/70 rounded-xl p-4 border border-gray-700/50 transition-all ${isError ? 'border-red-800/60' : ''}`,
    },
    React.createElement(
      'div',
      { className: 'flex items-start justify-between gap-3' },
      React.createElement(
        'div',
        { className: 'flex-1 min-w-0' },
        renderMessageContent()
      ),
      React.createElement(
        'div',
        { className: 'text-xs text-gray-400 text-right flex-shrink-0' },
        React.createElement(
          'div',
          { className: 'flex items-center gap-1.5 justify-end mb-1' },
          getEncryptionIcon(),
          React.createElement(
            'time',
            { dateTime: message.timestamp?.toISOString() },
            formatTime(message.timestamp),
          ),
        ),
        React.createElement(
          'div',
          {
            className: `flex items-center gap-1 justify-end ${timeRemaining.expired ? 'text-red-400' : 'text-gray-500'}`,
          },
          React.createElement(timeRemaining.expired ? Trash2 : Clock, {
            className: 'w-3 h-3',
          }),
          React.createElement('span', null, timeRemaining.text),
        ),
      ),
    ),
  )
}

console.log('✅ FRIENDLYモード 拡張メッセージ表示コンポーネント 読み込み完了')