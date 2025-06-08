// public/js/modules/ErrorHandler.js
;(function () {
  'use strict'
  const errorHistory = []
  const errorListeners = new Set()
  const recordNotification = (notificationInfo) => {
    const record = {
      id: `notify_${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      ...notificationInfo,
    }
    errorHistory.push(record)
    if (errorHistory.length > 50) errorHistory.shift()
    errorListeners.forEach((listener) => listener(record))
  }
  window.ErrorHandler = {
    initialize() {
      window.addEventListener('error', (e) =>
        recordNotification({ category: 'javascript', message: e.message }),
      )
      window.addEventListener('unhandledrejection', (e) =>
        recordNotification({
          category: 'promise',
          message: e.reason?.message || 'Promise error',
        }),
      )
    },
    report(category, message, options = {}) {
      recordNotification({ category, message, ...options })
    },
    addListener(listener) {
      errorListeners.add(listener)
    },
    removeListener(listener) {
      errorListeners.delete(listener)
    },
    _clearHistoryForTesting: () => {
      errorHistory.length = 0
    },
  }
})()
