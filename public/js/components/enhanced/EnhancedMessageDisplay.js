// public/js/components/enhanced/EnhancedMessageDisplay.js

console.log(
  '✨ FRIENDLYモード 拡張メッセージ表示コンポーネントを読み込んでいます...',
)

window.EnhancedMessageDisplay = ({ message, onRetryDecrypt }) => {
  const { Lock, Key, Users, Clock, Trash2, AlertCircle } = window.Icons
  const { formatTime, getMessageTimeRemaining } = window.Utils

  const isError = message.encryptionType === 'error'
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

  return React.createElement(
    'article',
    {
      className: `bg-gray-800/70 rounded-xl p-4 border border-gray-700/50 transition-all ${isError ? 'border-red-800/60' : ''}`,
    },
    React.createElement(
      'div',
      { className: 'flex items-start justify-between gap-3' },
      React.createElement(
        'pre',
        {
          className: `text-gray-100 leading-relaxed whitespace-pre-wrap font-sans break-words flex-1 ${isError ? 'italic text-red-300' : ''}`,
        },
        message.text,
      ),
      React.createElement(
        'div',
        { className: 'text-xs text-gray-400 text-right' },
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
    isError &&
      onRetryDecrypt &&
      React.createElement(
        'button',
        {
          onClick: () => onRetryDecrypt(message),
          className: 'mt-2 text-xs text-blue-400 hover:underline',
        },
        '復号化を再試行',
      ),
  )
}

console.log('✅ FRIENDLYモード 拡張メッセージ表示コンポーネント 読み込み完了')
