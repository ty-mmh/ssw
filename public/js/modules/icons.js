// public/js/modules/icons.js

console.log('🎨 アイコンモジュールを読み込んでいます...');

window.Icons = (() => {
  const createIcon = (path) => ({ className = 'w-4 h-4' }) =>
    React.createElement('svg', {
      className, fill: 'none', stroke: 'currentColor',
      viewBox: '0 0 24 24', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    }, React.createElement('path', { d: path }));

  return {
    Lock: createIcon('M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'),
    Key: createIcon('M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'),
    Users: createIcon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 10v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 8 4 4 0 0 1 0-8z'),
    MessageCircle: createIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'),
    Clock: createIcon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
    Trash2: createIcon('M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
    AlertCircle: createIcon('M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
    Shield: createIcon('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'),
  };
})();

console.log('✅ アイコンモジュール 読み込み完了');