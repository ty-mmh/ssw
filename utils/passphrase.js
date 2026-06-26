const crypto = require('crypto')

const DEFAULT_APP_SECRET = 'ssw-local-development-secret'

function normalizePassphrase(passphrase) {
  if (typeof passphrase !== 'string') return ''
  return passphrase.trim()
}

function validatePassphrase(passphrase) {
  const normalized = normalizePassphrase(passphrase)
  if (!normalized) {
    return { valid: false, error: '合言葉を入力してください。' }
  }
  if (normalized.length > 100) {
    return { valid: false, error: '合言葉は100文字以内で入力してください。' }
  }
  return { valid: true, passphrase: normalized }
}

function getAppSecret(env = process.env) {
  return env.APP_SECRET || DEFAULT_APP_SECRET
}

function hashPassphrase(passphrase, secret = getAppSecret()) {
  const normalized = normalizePassphrase(passphrase)
  return crypto
    .createHmac('sha256', secret)
    .update(normalized, 'utf8')
    .digest('hex')
}

module.exports = {
  DEFAULT_APP_SECRET,
  normalizePassphrase,
  validatePassphrase,
  getAppSecret,
  hashPassphrase,
}
