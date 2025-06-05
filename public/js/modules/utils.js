// public/js/modules/utils.js

console.log('🛠️ ユーティリティモジュールを読み込んでいます...');

window.Utils = (() => {
  return {
    /**
     * 日時を指定された形式の文字列にフォーマットします。
     * @param {Date | string} date - フォーマットする日時
     * @returns {string} フォーマット後の文字列
     */
    formatTime: (date) => {
      if (!date) return '不明な時刻';
      try {
        return new Date(date).toLocaleString('ja-JP', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return '無効な日時';
      }
    },

    /**
     * [修正] メッセージの有効期限までの残り時間を計算して返します。
     * @param {Date | string} expires_at - メッセージの有効期限
     * @returns {{text: string, expired: boolean}}
     */
    getMessageTimeRemaining: (expires_at) => {
      if (!expires_at) return { text: '期限不明', expired: true };
      try {
        // [修正] 引数のexpires_atを直接使用する
        const expiryDate = new Date(expires_at);
        const remaining = expiryDate.getTime() - new Date().getTime();

        if (remaining <= 0) return { text: '削除済み', expired: true };

        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        if (days > 0) return { text: `あと${days}日`, expired: false };

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        if (hours > 0) return { text: `あと${hours}時間`, expired: false };

        const minutes = Math.floor(remaining / (1000 * 60));
        if (minutes > 0) return { text: `あと${minutes}分`, expired: false };

        return { text: 'まもなく削除', expired: false }; // 1分未満は「まもなく」
      } catch (e) {
        return { text: '期限エラー', expired: true };
      }
    },

    /**
     * 合言葉のバリデーションを行います。
     * @param {string} passphrase - 検証する合言葉
     * @returns {{valid: boolean, error?: string}}
     */
    validatePassphrase: (passphrase) => {
      if (!passphrase || !passphrase.trim()) {
        return { valid: false, error: '合言葉を入力してください。' };
      }
      if (passphrase.trim().length > 100) {
        return { valid: false, error: '合言葉は100文字以内で入力してください。' };
      }
      return { valid: true };
    },

    /**
     * 構造化されたログをコンソールに出力します。
     * @param {'info' | 'warn' | 'error' | 'success'} level - ログレベル
     * @param {string} message - ログメッセージ
     * @param {any} data - 追加データ
     */
    log: (level, message, data = {}) => {
      const icons = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        success: '✅',
      };
      console.log(`${icons[level]} [${level.toUpperCase()}] ${message}`, data);
    }
  };
})();

console.log('✅ ユーティリティモジュール 読み込み完了');