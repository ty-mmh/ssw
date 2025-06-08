// tests/utils.test.js

// utils.js を require して Utils をグローバルに設定
const utilsModule = require('../public/js/modules/utils.js')
global.Utils = utilsModule.Utils

describe('Utils Module', () => {
  describe('validatePassphrase', () => {
    test('正常な合言葉は有効と判断されるべき', () => {
      const result = global.Utils.validatePassphrase('これは有効な合言葉')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    test('空の文字列は無効と判断されるべき', () => {
      const result = global.Utils.validatePassphrase('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('合言葉を入力してください。')
    })

    test('スペースのみの文字列は無効と判断されるべき', () => {
      const result = global.Utils.validatePassphrase('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('合言葉を入力してください。')
    })

    test('100文字を超える文字列は無効と判断されるべき', () => {
      const longPassphrase = 'a'.repeat(101)
      const result = global.Utils.validatePassphrase(longPassphrase)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('合言葉は100文字以内で入力してください。')
    })
  })

  // [追加] formatTime 関数のテストスイート
  describe('formatTime', () => {
    test('Dateオブジェクトを正しくフォーマットすべき', () => {
      // 2025年6月8日 10時30分
      const date = new Date(2025, 5, 8, 10, 30)
      // 日本のロケールでは '06/08 10:30' のような形式になる
      expect(global.Utils.formatTime(date)).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/)
    })

    test('ISO文字列を正しくフォーマットすべき', () => {
      const dateStr = '2025-06-08T01:30:00.000Z' // UTCでの1:30は、JSTでは10:30
      expect(global.Utils.formatTime(dateStr)).toMatch(/\d{2}\/\d{2} 10:30/)
    })

    test('不正な入力に対してフォールバック文字列を返すべき', () => {
      expect(global.Utils.formatTime(null)).toBe('不明な時刻')
      expect(global.Utils.formatTime(undefined)).toBe('不明な時刻')
      expect(global.Utils.formatTime('invalid-date')).toBe('無効な日時')
    })
  })

  // [追加] getMessageTimeRemaining 関数のテストスイート
  describe('getMessageTimeRemaining', () => {
    const baseTime = new Date('2025-06-08T12:00:00.000Z')

    // jestのタイマーモック機能を使って、テスト中の「現在時刻」を固定
    beforeAll(() => {
      jest.useFakeTimers()
      jest.setSystemTime(baseTime)
    })

    // テスト終了後にタイマーモックを解除
    afterAll(() => {
      jest.useRealTimers()
    })

    test('有効期限が2日後の場合、「あと2日」と表示すべき', () => {
      const expires_at = new Date(
        baseTime.getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString()
      const result = global.Utils.getMessageTimeRemaining(expires_at)
      expect(result.text).toBe('あと2日')
      expect(result.expired).toBe(false)
    })

    test('有効期限が5時間後の場合、「あと5時間」と表示すべき', () => {
      const expires_at = new Date(
        baseTime.getTime() + 5 * 60 * 60 * 1000,
      ).toISOString()
      const result = global.Utils.getMessageTimeRemaining(expires_at)
      expect(result.text).toBe('あと5時間')
      expect(result.expired).toBe(false)
    })

    test('有効期限が30分後の場合、「あと30分」と表示すべき', () => {
      const expires_at = new Date(
        baseTime.getTime() + 30 * 60 * 1000,
      ).toISOString()
      const result = global.Utils.getMessageTimeRemaining(expires_at)
      expect(result.text).toBe('あと30分')
      expect(result.expired).toBe(false)
    })

    test('有効期限が1分未満の場合、「まもなく削除」と表示すべき', () => {
      const expires_at = new Date(baseTime.getTime() + 30 * 1000).toISOString()
      const result = global.Utils.getMessageTimeRemaining(expires_at)
      expect(result.text).toBe('まもなく削除')
      expect(result.expired).toBe(false)
    })

    test('有効期限が過ぎている場合、「削除済み」と表示すべき', () => {
      const expires_at = new Date(baseTime.getTime() - 1000).toISOString()
      const result = global.Utils.getMessageTimeRemaining(expires_at)
      expect(result.text).toBe('削除済み')
      expect(result.expired).toBe(true)
    })
  })
})
