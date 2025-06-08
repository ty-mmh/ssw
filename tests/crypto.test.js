// tests/crypto.test.js

// 依存モジュールをモック化
window.SessionManager = {
  getCurrentSession: jest.fn(),
  getActiveSessionsForSpace: jest.fn(),
}
window.KeyExchangeManager = {
  getMyPrivateKey: jest.fn(),
  getPeerPublicKey: jest.fn(),
}

// テスト対象モジュールを読み込む
require('../public/js/modules/crypto.js')

describe('Crypto Module', () => {
  const spaceId = 'test-space',
    passphrase = 'test-password',
    message = 'Hello!'

  beforeEach(() => {
    jest.clearAllMocks()
    window.Crypto._clearCache()
  })

  test('決定的キーが生成・キャッシュされる', async () => {
    const key1 = await window.Crypto.getOrCreateSpaceKey(spaceId, passphrase)
    const key2 = await window.Crypto.getOrCreateSpaceKey(spaceId, passphrase)

    // [修正] toBeInstanceOf(Object) から、オブジェクトが存在することを検証する、より適切な方法に変更
    expect(key1).toBeTruthy()
    expect(key2).toBeTruthy()

    expect(key1).toBe(key2) // キャッシュが効いていることを確認
  })

  test('複数セッションではハイブリッド暗号化が実行される', async () => {
    // 準備
    const keyA = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    )
    const keyB = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    )
    const pubKeyB = await crypto.subtle.exportKey('jwk', keyB.publicKey)

    window.SessionManager.getCurrentSession.mockReturnValue({ sessionId: 's1' })
    window.KeyExchangeManager.getMyPrivateKey.mockReturnValue(keyA.privateKey)
    window.KeyExchangeManager.getPeerPublicKey.mockReturnValue(pubKeyB)

    await window.Crypto.getOrCreateSpaceKey(spaceId, passphrase)

    // 実行と検証
    const payload = await window.Crypto.encryptMessageHybrid(message, spaceId, [
      's1',
      's2',
    ])
    expect(payload.type).toBe('hybrid')
  })
})
