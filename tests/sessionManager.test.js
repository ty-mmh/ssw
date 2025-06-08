// tests/sessionManager.test.js
require('../public/js/modules/sessionManager.js')
describe('SessionManager Module', () => {
  const spaceId = 'test-space',
    sA = 'sA',
    sB = 'sB'
  const mockSocket = { on: jest.fn(), emit: jest.fn() }
  beforeEach(() => {
    jest.clearAllMocks()
    window.SessionManager._clearStateForTesting()
    window.SessionManager.setSocket(mockSocket)
  })
  test('自身のセッションを正しく確立すべき', () => {
    window.SessionManager.setCurrentSession(sA, spaceId)
    expect(window.SessionManager.getCurrentSession().sessionId).toBe(sA)
  })
  test('ピア参加でレベルがhybridになる', () => {
    window.SessionManager.setCurrentSession(sA, spaceId)
    window.SessionManager.addSessionToSpace(spaceId, sB)
    expect(
      window.SessionManager.getEncryptionLevelForSpace(spaceId).level,
    ).toBe('hybrid')
    expect(document.dispatchEvent).toHaveBeenCalled()
  })
})
