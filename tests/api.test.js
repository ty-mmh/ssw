// tests/api.test.js

// 依存するモジュールをモック化
window.Crypto = {
  getOrCreateSpaceKey: jest.fn(),
  encryptMessageHybrid: jest.fn(),
  decryptMessageWithFallback: jest.fn(),
}
window.SessionManager = {
  getActiveSessionsForSpace: jest.fn(),
}
window.ErrorHandler = {
  report: jest.fn(),
}

// api.jsを読み込む
require('../public/js/modules/api.js')

describe('API Module', () => {
  beforeEach(() => {
    // fetchをモック化し、各テストで振る舞いを定義できるようにする
    global.fetch = jest.fn()
    jest.clearAllMocks()
  })

  test('enterSpace: 成功時に空間情報を返し、キーを生成すべき', async () => {
    const mockSpace = { id: 's1', passphrase: 'p1' }
    // fetchが成功した際のレスポンスを定義
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, space: mockSpace }),
    })

    const space = await window.API.enterSpace('p1')

    // fetchが正しい引数で呼び出されたか
    expect(fetch).toHaveBeenCalledWith('/api/spaces/enter', expect.any(Object))
    // Cryptoモジュールの関数が呼び出されたか
    expect(window.Crypto.getOrCreateSpaceKey).toHaveBeenCalledWith(
      mockSpace.id,
      mockSpace.passphrase,
    )
    // 正しい空間情報が返されたか
    expect(space).toEqual(mockSpace)
  })

  test('sendMessageFriendly: 暗号化してからメッセージを送信すべき', async () => {
    const mockEncryptedPayload = { type: 'deterministic', data: 'encrypted' }
    window.Crypto.encryptMessageHybrid.mockResolvedValue(mockEncryptedPayload)
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          message: { id: 'm1', timestamp: new Date().toISOString() },
        }),
    })

    await window.API.sendMessageFriendly('s1', 'hello')

    // Cryptoモジュールの暗号化関数が呼び出されたか
    expect(window.Crypto.encryptMessageHybrid).toHaveBeenCalled()
    // fetchが暗号化ペイロードを含んで呼び出されたか
    expect(fetch).toHaveBeenCalledWith(
      '/api/messages/create',
      expect.objectContaining({
        body: expect.stringContaining(
          '"encryptedPayload":{"type":"deterministic"',
        ),
      }),
    )
  })
})
