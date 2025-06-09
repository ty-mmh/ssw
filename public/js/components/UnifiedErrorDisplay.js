// public/js/components/UnifiedErrorDisplay.js

console.log('🔔 通知表示UIコンポーネントを読み込んでいます...');

window.UnifiedErrorDisplayComponent = () => {
    const { useState, useEffect, useCallback } = React;
    const { AlertCircle, Check, Info } = window.Icons; // [追加] CheckとInfoアイコン
    const [notifications, setNotifications] = useState([]); // [修正] activeErrors -> notifications

    // [修正] 通知を削除するロジックを更新
    const removeNotification = useCallback((id) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, state: 'exiting' } : n)
        );

        // CSSアニメーションの完了を待ってから、実際にstateから削除する
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 400); // CSSのtransition durationと合わせる
    }, []);

    useEffect(() => {
        const handleNotification = (notification) => {
            // [修正] stateプロパティを追加
            const newNotification = { ...notification, state: 'visible' };
            setNotifications(prev => [...prev, newNotification]);

            // 5秒後に削除処理を開始する
            setTimeout(() => {
                removeNotification(notification.id);
            }, 5000);
        };

        window.ErrorHandler.addListener(handleNotification);
        return () => window.ErrorHandler.removeListener(handleNotification);
    }, [removeNotification]); // useCallbackでラップした関数を依存配列に追加

    const getNotificationStyle = (severity) => {
        switch (severity) {
            case 'success':
                return { icon: Check, color: 'text-accent', borderColor: 'border-accent' };
            case 'info':
                return { icon: Info, color: 'text-primary', borderColor: 'border-primary' };
            case 'warning':
                return { icon: AlertCircle, color: 'text-warning', borderColor: 'border-warning' };
            default: // error
                return { icon: AlertCircle, color: 'text-danger', borderColor: 'border-danger' };
        }
    };

    if (notifications.length === 0) {
        return null;
    }

    return React.createElement(
        'div', { className: 'fixed top-4 right-4 z-[100] w-full max-w-sm space-y-3' },
        notifications.map(notification => {
            const style = getNotificationStyle(notification.severity);
            const title = notification.title || `${notification.category.toUpperCase()} ${notification.severity}`;
            
            // [修正] アニメーション用のクラスを動的に適用
            const animationClass = `notification-item ${notification.state}`;

            return React.createElement(
                'div', { 
                    key: notification.id,
                    className: `glass-pane p-4 rounded-lg shadow-lg border-l-4 ${style.borderColor} ${animationClass}`
                },
                React.createElement(
                    'div', { className: 'flex items-start gap-3' },
                    React.createElement(style.icon, { className: `w-6 h-6 ${style.color} flex-shrink-0` }),
                    React.createElement(
                        'div', { className: 'flex-1' },
                        React.createElement('p', { className: 'font-bold text-gray-100' }, title),
                        React.createElement('p', { className: 'text-sm text-gray-300' }, notification.message)
                    ),
                    React.createElement(
                        'button', { onClick: () => removeNotification(notification.id), className: 'text-gray-500 hover:text-white transition-colors' }, '✕'
                    )
                )
            )
        })
    );
};