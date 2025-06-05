// public/js/components/Login.js

console.log('👤 ログインコンポーネントを読み込んでいます...');

window.LoginComponent = ({
  passphrase, setPassphrase, error, setError, newSpacePassphrase,
  setNewSpacePassphrase, showCreateSpace, setShowCreateSpace, isLoading,
  onEnterSpace, onCreateSpace
}) => {
  const { Shield, Lock, AlertCircle } = window.Icons;

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      action();
    }
  };

  return React.createElement(
    'div', { className: 'min-h-screen bg-gray-900 text-white flex items-center justify-center p-4' },
    React.createElement(
      'div', { className: 'max-w-md w-full' },
      React.createElement(
        'div', { className: 'text-center mb-8' },
        React.createElement(Shield, { className: 'w-16 h-16 mx-auto text-blue-400' }),
        React.createElement('h1', { className: 'text-3xl font-bold mt-4' }, 'セキュアチャット'),
        React.createElement('p', { className: 'text-gray-400' }, 'FRIENDLYモード')
      ),
      React.createElement(
        'div', { className: 'bg-gray-800/80 p-6 rounded-xl border border-gray-700' },
        React.createElement('label', { htmlFor: 'passphrase', className: 'block text-sm font-medium mb-2' }, '合言葉'),
        React.createElement('input', {
          id: 'passphrase', type: 'text', value: passphrase,
          onChange: (e) => { setPassphrase(e.target.value); setError(''); },
          onKeyPress: (e) => handleKeyPress(e, onEnterSpace),
          placeholder: '空間の合言葉を入力',
          className: 'w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 outline-none',
          disabled: isLoading
        }),
        error && React.createElement(
          'div', { className: 'mt-3 text-red-400 text-sm flex items-center gap-2' },
          React.createElement(AlertCircle, { className: 'w-5 h-5' }),
          React.createElement('span', null, error)
        ),
        React.createElement(
          'button', {
            onClick: onEnterSpace,
            disabled: isLoading || !passphrase.trim(),
            className: 'w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2'
          },
          React.createElement(Lock),
          isLoading ? '接続中...' : '空間に入る'
        ),
        React.createElement('div', { className: 'mt-6 border-t border-gray-700 pt-4' },
          React.createElement(
            'button', { onClick: () => setShowCreateSpace(!showCreateSpace), className: 'text-center w-full text-gray-400 hover:text-white' },
            showCreateSpace ? '作成をやめる' : '新しい空間を作成する'
          ),
          showCreateSpace && React.createElement('div', { className: 'mt-4' },
            React.createElement('label', { htmlFor: 'new-passphrase', className: 'block text-sm font-medium mb-2' }, '新しい合言葉'),
            React.createElement('input', {
              id: 'new-passphrase', type: 'text', value: newSpacePassphrase,
              onChange: (e) => { setNewSpacePassphrase(e.target.value); setError(''); },
              onKeyPress: (e) => handleKeyPress(e, onCreateSpace),
              placeholder: '新しい空間の合言葉',
              className: 'w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 outline-none',
              disabled: isLoading
            }),
            React.createElement(
              'button', {
                onClick: onCreateSpace,
                disabled: isLoading || !newSpacePassphrase.trim(),
                className: 'w-full mt-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg'
              },
              isLoading ? '作成中...' : '作成'
            )
          )
        )
      )
    )
  );
};

console.log('✅ ログインコンポーネント 読み込み完了');