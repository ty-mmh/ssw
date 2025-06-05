// public/js/components/enhanced/EncryptionStatus.js

console.log('✨ FRIENDLYモード 暗号化状態表示コンポーネントを読み込んでいます...');

window.EncryptionStatusComponent = ({
  encryptionStatus,
  encryptionInfo,
  sessionCount,
}) => {
  const { Lock, Key, Users, AlertCircle, Shield } = window.Icons;

  const getDisplayInfo = () => {
    switch (encryptionStatus) {
      case 'enabled':
        const isHybrid = sessionCount > 1;
        return {
          icon: isHybrid ? Users : Key,
          color: isHybrid ? 'text-purple-400' : 'text-blue-400',
          bgColor: isHybrid ? 'bg-purple-900/30' : 'bg-blue-900/30',
          borderColor: isHybrid ? 'border-purple-800/50' : 'border-blue-800/50',
          title: isHybrid ? 'ハイブリッド暗号化' : '決定的暗号化',
          description: isHybrid ? `${sessionCount}セッションで保護中` : '単独セッションで保護中',
        };
      case 'initializing':
        return {
          icon: Shield,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/30 animate-pulse',
          borderColor: 'border-yellow-800/50',
          title: '暗号化を準備中...',
          description: 'セキュアな接続を確立しています',
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-900/30',
          borderColor: 'border-red-800/50',
          title: '暗号化エラー',
          description: encryptionInfo?.error || 'キーの同期に失敗しました',
        };
      default: // disabled
        return {
          icon: Shield,
          color: 'text-gray-500',
          bgColor: 'bg-gray-800/30',
          borderColor: 'border-gray-700/50',
          title: '暗号化無効',
          description: '通信は保護されていません',
        };
    }
  };

  const info = getDisplayInfo();

  return React.createElement(
    'div',
    { className: `p-3 rounded-lg border ${info.bgColor} ${info.borderColor}` },
    React.createElement(
      'div',
      { className: 'flex items-center gap-3' },
      React.createElement(info.icon, { className: `w-5 h-5 flex-shrink-0 ${info.color}` }),
      React.createElement(
        'div',
        null,
        React.createElement('div', { className: `font-medium text-sm ${info.color}` }, info.title),
        React.createElement('div', { className: 'text-xs text-gray-400' }, info.description)
      )
    )
  );
};

console.log('✅ FRIENDLYモード 暗号化状態表示コンポーネント 読み込み完了');