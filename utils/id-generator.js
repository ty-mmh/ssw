const crypto = require('crypto')

/**
 * 暗号学的に安全なランダムIDを生成します。
 * nanoidの代替として機能します。
 * @param {number} length 生成するIDの長さ（デフォルト: 21）
 * @returns {string} 生成されたID
 */
function generateSecureId(length = 21) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomBytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length]
  }
  return result
}

module.exports = {
  nanoid: generateSecureId,
}
