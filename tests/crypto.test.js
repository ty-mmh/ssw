// tests/crypto.test.js

// minified ファイルを直接 require する代わりに、fs で読み込んで eval
const fs = require('fs')
const path = require('path')

// crypto.js を読み込んで実行
const cryptoCode = fs.readFileSync(
  path.join(__dirname, '../public/js/modules/crypto.js'),
  'utf8',
)

// グローバル環境で crypto.js を実行
eval(cryptoCode)

describe('Crypto Module', () => {
  const spaceId = 'test-space',
    passphrase = 'test-password',
    message = 'Hello!'

  beforeEach(() => {
    jest.clearAllMocks()
    if (
      global.window &&
      global.window.Crypto &&
      global.window.Crypto._clearCache
    ) {
      global.window.Crypto._clearCache()
    }
  })

  test('決定的キーが生成・キャッシュされる', async () => {
    const key1 = await global.window.Crypto.getOrCreateSpaceKey(
      spaceId,
      passphrase,
    )
    const key2 = await global.window.Crypto.getOrCreateSpaceKey(
      spaceId,
      passphrase,
    )
    expect(key1).toBe(key2)
  })

  test('単独セッションでは決定的暗号化', async () => {
    global.window.SessionManager.getActiveSessionsForSpace.mockReturnValue([
      's1',
    ])
    await global.window.Crypto.getOrCreateSpaceKey(spaceId, passphrase)
    const payload = await global.window.Crypto.encryptMessageHybrid(
      message,
      spaceId,
      ['s1'],
    )
    expect(payload.type).toBe('deterministic')
    const decrypted = await global.window.Crypto.decryptMessageWithFallback(
      payload,
      spaceId,
    )
    expect(decrypted).toBe(message)
  })

  test('複数セッションではハイブリッド暗号化が実行される', async () => {
    const keyA = await global.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    )
    const keyB = await global.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    )
    const pubKeyB = await global.crypto.subtle.exportKey('jwk', keyB.publicKey)

    global.window.SessionManager.getCurrentSession.mockReturnValue({
      sessionId: 's1',
    })
    global.window.KeyExchangeManager.getMyPrivateKey.mockReturnValue(
      keyA.privateKey,
    )
    global.window.KeyExchangeManager.getPeerPublicKey.mockReturnValue(pubKeyB)

    await global.window.Crypto.getOrCreateSpaceKey(spaceId, passphrase)
    const payload = await global.window.Crypto.encryptMessageHybrid(
      message,
      spaceId,
      ['s1', 's2'],
    )
    expect(payload.type).toBe('hybrid')
  })
})
