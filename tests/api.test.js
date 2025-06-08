// tests/api.test.js
window.Crypto = {
  getOrCreateSpaceKey: jest.fn(),
  encryptMessageHybrid: jest.fn(),
  decryptMessageWithFallback: jest.fn(),
}
window.SessionManager = { getActiveSessionsForSpace: jest.fn() }
window.ErrorHandler = { report: jest.fn() }
require('../public/js/modules/api.js')

describe('API Module', () => {
  beforeEach(() => {
    global.fetch = jest.fn() // fetchをモック化
    jest.clearAllMocks()
  })

  test('enterSpace: 成功時に空間情報を返し、キーを生成すべき', async () => {
    const mockSpace = { id: 's1', passphrase: 'p1' }
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, space: mockSpace }),
    })

    const space = await window.API.enterSpace('p1')

    expect(fetch).toHaveBeenCalledWith('/api/spaces/enter', expect.any(Object))
    expect(window.Crypto.getOrCreateSpaceKey).toHaveBeenCalledWith(
      mockSpace.id,
      mockSpace.passphrase,
    )
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

    expect(window.Crypto.encryptMessageHybrid).toHaveBeenCalledWith(
      'hello',
      's1',
      undefined,
    )
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
