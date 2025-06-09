// public/js/components/ImageModal.js

window.ImageModal = ({ isOpen, onClose, imageUrl }) => {
  const { useEffect, useState } = React;

  // [追加] アニメーションのための終了状態を管理
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // モーダルが開かれるたびに、終了状態をリセット
      setIsExiting(false);
      return;
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // [修正] 直接onCloseを呼ばず、終了処理を開始
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }
  
  const { X } = window.Icons;

  // [追加] モーダルを閉じる処理
  const handleClose = () => {
    setIsExiting(true); // まず終了状態にセット
    setTimeout(onClose, 200); // CSSのアニメーション時間(0.2s)後に実際に閉じる
  };

  return React.createElement('div', {
      className: 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in',
      onClick: handleClose // 背景クリックで閉じる
    },
    React.createElement('div', {
        // [修正] アニメーション用のクラスを動的に適用
        className: `modal-content relative max-w-4xl max-h-full ${isExiting ? 'is-exiting' : ''}`,
        onClick: e => e.stopPropagation()
      },
      React.createElement('img', {
        src: imageUrl,
        className: 'block max-w-full max-h-[90vh] object-contain rounded-lg'
      }),
      React.createElement('button', {
          onClick: handleClose,
          className: 'absolute -top-2 -right-2 bg-gray-800 rounded-full p-2 text-white hover:bg-gray-700 transition-colors'
        },
        React.createElement(X, { className: 'w-6 h-6' })
      )
    )
  );
};