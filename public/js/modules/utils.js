// public/js/modules/utils.js
;(function (exports) {
  'use strict'
  console.log('🛠️ ユーティリティモジュールを読み込んでいます...')
  const Utils = {
    formatTime: (date) => {
      if (!date) return '不明な時刻'
      try {
        const d = new Date(date)
        if (isNaN(d.getTime())) return '無効な日時'
        return d.toLocaleString('ja-JP', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tokyo',
        })
      } catch (e) {
        return '無効な日時'
      }
    },
    getMessageTimeRemaining: (expires_at) => {
      if (!expires_at) return { text: '期限不明', expired: !0 }
      try {
        const t = new Date(expires_at),
          e = t.getTime() - Date.now()
        if (e <= 0) return { text: '削除済み', expired: !0 }
        const o = Math.floor(e / 864e5)
        if (o > 0) return { text: `あと${o}日`, expired: !1 }
        const r = Math.floor(e / 36e5)
        if (r > 0) return { text: `あと${r}時間`, expired: !1 }
        const a = Math.floor(e / 6e4)
        return a > 0
          ? { text: `あと${a}分`, expired: !1 }
          : { text: 'まもなく削除', expired: !1 }
      } catch (o) {
        return { text: '期限エラー', expired: !0 }
      }
    },
    validatePassphrase: (passphrase) => {
      return !passphrase || typeof passphrase !== 'string' || !passphrase.trim()
        ? { valid: !1, error: '合言葉を入力してください。' }
        : passphrase.trim().length > 100
          ? { valid: !1, error: '合言葉は100文字以内で入力してください。' }
          : { valid: !0, passphrase: passphrase.trim() }
    },
  }
  if (typeof exports === 'undefined') {
    this.Utils = Utils
  } else {
    exports.Utils = Utils
  }
})(typeof exports === 'undefined' ? this : exports)
