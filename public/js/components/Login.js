// public/js/components/Login.js

window.LoginComponent = ({
  passphrase, setPassphrase, error, setError, newSpacePassphrase,
  setNewSpacePassphrase, showCreateSpace, setShowCreateSpace, isLoading,
  onEnterSpace, onCreateSpace
}) => {
  const { Shield, Lock, AlertCircle } = window.Icons;

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter' && !isLoading) { action(); }
  };

  return React.createElement(
    'div', { className: 'min-h-screen bg-gradient-to-br from-gray-900 via-stone-950 to-black text-white flex items-center justify-center p-4' },
    React.createElement(
      'div', { className: 'w-full max-w-md mx-auto animate-fade-in' },
      React.createElement(
        'div', { className: 'text-center mb-8' },
        React.createElement(Shield, { className: 'w-16 h-16 mx-auto text-primary animate-subtle-pulse' }),
        React.createElement('h1', { className: 'text-3xl font-bold mt-4 text-gray-100' }, 'Secure Space'),
        React.createElement('p', { className: 'text-gray-400' }, 'in the word')
      ),
      React.createElement(
        'div', { className: 'glass-pane p-6 sm:p-8 rounded-2xl' },
        React.createElement('div', { className: 'mb-6' },
          React.createElement('label', { htmlFor: 'passphrase', className: 'block text-sm font-medium mb-2 text-gray-300' }, '合言葉'),
          // [修正] type="password" を "text" に変更
          React.createElement('input', {
            id: 'passphrase', type: 'text', value: passphrase,
            onChange: (e) => { setPassphrase(e.target.value); setError(''); },
            onKeyPress: (e) => handleKeyPress(e, onEnterSpace),
            placeholder: '空間の合言葉を入力',
            className: 'w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all',
            disabled: isLoading
          })
        ),
        error && React.createElement(
          'div', { className: 'mb-4 text-danger text-sm flex items-center gap-2' },
          React.createElement(AlertCircle, { className: 'w-5 h-5' }),
          React.createElement('span', null, error)
        ),
        React.createElement(
          'button', {
            onClick: onEnterSpace,
            disabled: isLoading || !passphrase.trim(),
            className: 'w-full bg-primary hover:bg-blue-600 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 disabled:scale-100'
          },
          React.createElement(Lock),
          isLoading ? '接続中...' : '空間に入る'
        ),
        React.createElement('div', { className: 'mt-6 text-center' },
          React.createElement(
            'button', { onClick: () => setShowCreateSpace(!showCreateSpace), className: 'text-sm text-gray-400 hover:text-white transition' },
            showCreateSpace ? '作成を閉じる' : '新しい空間を作成'
          )
        ),
        // [修正] アニメーションのために常に要素は描画し、クラスで表示を制御する
        React.createElement('div', {
            className: `collapsible ${showCreateSpace ? 'open' : ''}`
          },
          React.createElement('div', { /* アニメーション用の内側コンテナ */ },
            React.createElement('div', { className: 'border-t border-gray-700 pt-4' },
              React.createElement('label', { htmlFor: 'new-passphrase', className: 'block text-sm font-medium mb-2 text-gray-300' }, '新しい合言葉'),
              React.createElement('input', {
                id: 'new-passphrase', type: 'text', value: newSpacePassphrase,
                onChange: (e) => { setNewSpacePassphrase(e.target.value); setError(''); },
                onKeyPress: (e) => handleKeyPress(e, onCreateSpace),
                placeholder: '新しい空間の合言葉',
                className: 'w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-gray-600 focus:border-accent focus:ring-2 focus:ring-accent/50 outline-none transition-all',
                disabled: isLoading
              }),
              React.createElement(
                'button', {
                  onClick: onCreateSpace,
                  disabled: isLoading || !newSpacePassphrase.trim(),
                  className: 'w-full mt-3 bg-accent hover:bg-emerald-600 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all'
                },
                '作成する'
              )
            )
          )
        )
      )
    )
  );
};