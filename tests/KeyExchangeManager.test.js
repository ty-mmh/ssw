// tests/KeyExchangeManager.test.js
require('../public/js/modules/KeyExchangeManager.js')
describe('KeyExchangeManager Module', () => {
  const spaceId = 'test-space',
    mySessId = 'mySess'
  const mockSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() }
  beforeEach(() => {
    jest.clearAllMocks()
    window.KeyExchangeManager._clearStateForTesting()
    window.SessionManager.getCurrentSession.mockReturnValue({
      sessionId: mySessId,
    })
  })
  test('初期化でキーペア生成とリスナー設定を行う', async () => {
    await window.KeyExchangeManager.initialize(mockSocket, spaceId)
    expect(window.KeyExchangeManager.getMyPrivateKey()).not.toBeNull()
    expect(mockSocket.on).toHaveBeenCalledWith(
      'public-key-received',
      expect.any(Function),
    )
  })
  test('公開鍵をアナウンスする', async () => {
    await window.KeyExchangeManager.initialize(mockSocket, spaceId)
    await window.KeyExchangeManager.announcePublicKey()
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'public-key-announcement',
      expect.any(Object),
    )
  })
})
