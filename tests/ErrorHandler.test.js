// tests/ErrorHandler.test.js
require('../public/js/modules/ErrorHandler.js')

describe('ErrorHandler Module', () => {
  beforeEach(() => {
    window.ErrorHandler._clearHistoryForTesting()
    jest.clearAllMocks()
  })

  test('report: エラーを報告し、リスナーに通知すべき', () => {
    const mockListener = jest.fn()
    window.ErrorHandler.addListener(mockListener)

    window.ErrorHandler.report('test', 'This is a test error', {
      severity: 'high',
    })

    expect(mockListener).toHaveBeenCalledTimes(1)
    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'test',
        message: 'This is a test error',
        severity: 'high',
      }),
    )
  })
})
