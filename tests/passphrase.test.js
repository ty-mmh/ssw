const {
  hashPassphrase,
  normalizePassphrase,
  validatePassphrase,
} = require('../utils/passphrase')

describe('Passphrase contract', () => {
  test('normalizes by trimming only', () => {
    expect(normalizePassphrase('  secret  ')).toBe('secret')
  })

  test('validates empty and long passphrases', () => {
    expect(validatePassphrase('   ').valid).toBe(false)
    expect(validatePassphrase('a'.repeat(101)).valid).toBe(false)
    expect(validatePassphrase('valid').valid).toBe(true)
  })

  test('hash is stable and secret-dependent without leaking plaintext', () => {
    const hashA = hashPassphrase(' secret ', 'secret-a')
    const hashB = hashPassphrase('secret', 'secret-a')
    const hashC = hashPassphrase('secret', 'secret-b')

    expect(hashA).toBe(hashB)
    expect(hashA).not.toBe(hashC)
    expect(hashA).not.toContain('secret')
  })
})
