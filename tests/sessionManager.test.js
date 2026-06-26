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
  test('session-left updates active sessions and encryption level', () => {
    window.SessionManager.setCurrentSession(sA, spaceId)
    window.SessionManager.addSessionToSpace(spaceId, sB)
    document.dispatchEvent.mockClear()

    const sessionLeftHandler = mockSocket.on.mock.calls.find(
      ([eventName]) => eventName === 'session-left',
    )[1]
    sessionLeftHandler({ spaceId, sessionId: sB })

    expect(window.SessionManager.getActiveSessionsForSpace(spaceId)).toEqual([
      sA,
    ])
    expect(
      window.SessionManager.getEncryptionLevelForSpace(spaceId),
    ).toMatchObject({ level: 'deterministic', sessionCount: 1 })
    expect(document.dispatchEvent).toHaveBeenCalled()
  })
})
