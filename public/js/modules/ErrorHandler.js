// public/js/modules/ErrorHandler.js

console.log('🛡️ 高度な通知モジュール（旧ErrorHandler）を読み込んでいます...');

window.ErrorHandler = (() => {
    const errorHistory = [];
    const errorListeners = new Set();

    const recordNotification = (notificationInfo) => {
        const timestamp = new Date().toISOString();
        // [修正] severityのデフォルト値を 'error' に設定
        const notificationRecord = {
            id: `notify_${Date.now()}`,
            timestamp,
            severity: 'error', // デフォルト
            ...notificationInfo
        };

        errorHistory.push(notificationRecord);
        if (errorHistory.length > 50) {
            errorHistory.shift();
        }

        errorListeners.forEach(listener => listener(notificationRecord));

        // コンソールへのログ出力もレベル分け
        const { category, message, details, severity } = notificationRecord;
        const logMessage = `[Notification] ${category.toUpperCase()} (${severity}): ${message}`;
        if (severity === 'error') {
            console.error(logMessage, details || '');
        } else {
            console.log(logMessage, details || '');
        }
    };

    return {
        initialize() {
            window.addEventListener('error', (event) => {
                recordNotification({
                    severity: 'error',
                    category: 'javascript',
                    message: event.message,
                    details: { filename: event.filename, lineno: event.lineno }
                });
            });

            window.addEventListener('unhandledrejection', (event) => {
                recordNotification({
                    severity: 'error',
                    category: 'promise',
                    message: event.reason?.message || '非同期処理で予期せぬエラーが発生しました。',
                    details: { reason: event.reason }
                });
            });
            console.log("✅ グローバル通知ハンドラが設定されました。");
        },

        /**
         * [修正] 手動で通知を報告します。
         * @param {string} category - カテゴリ
         * @param {string} message - メッセージ
         * @param {{severity: 'success'|'info'|'warning'|'error', details: object}} options
         */
        report(category, message, options = {}) {
            recordNotification({ category, message, ...options });
        },
        
        addListener(listener) {
            errorListeners.add(listener);
        },

        removeListener(listener) {
            errorListeners.delete(listener);
        }
    };
})();