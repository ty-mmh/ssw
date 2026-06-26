;(function () {
  'use strict'

  window.SSW_CONFIG = {
    apiBaseUrl: '',
    wsUrl: '',
    pollingIntervalMs: 5000,
    ...(window.SSW_CONFIG || {}),
  }
})()
