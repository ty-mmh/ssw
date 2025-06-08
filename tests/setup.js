// tests/setup.js
const { TextEncoder, TextDecoder } = require('util')

// グローバル設定
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64')
global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')

// crypto の設定を修正
const crypto = require('crypto').webcrypto
global.crypto = crypto

// crypto.subtle の設定を明示的に追加
if (crypto && crypto.subtle) {
  global.crypto.subtle = crypto.subtle
}

// document の設定
global.document = {
  dispatchEvent: jest.fn(),
}

jest.spyOn(global.document, 'dispatchEvent')

// window オブジェクトの設定
global.window = global.window || {}

// Utils の設定を追加
global.Utils = {}

Object.assign(global.window, {
  SessionManager: {
    _clearStateForTesting: jest.fn(),
    setCurrentSession: jest.fn(),
    setSocket: jest.fn(),
    addSessionToSpace: jest.fn(),
    removeSessionFromSpace: jest.fn(),
    updateEncryptionLevel: jest.fn(),
    syncAllSessions: jest.fn(),
    getCurrentSession: jest.fn(),
    getActiveSessionsForSpace: jest.fn(),
    getEncryptionLevelForSpace: jest.fn(),
    leaveSession: jest.fn(),
  },
  KeyExchangeManager: {
    _clearStateForTesting: jest.fn(),
    initialize: jest.fn(),
    announcePublicKey: jest.fn(),
    getMyPrivateKey: jest.fn(),
    getPeerPublicKey: jest.fn(),
  },
})
