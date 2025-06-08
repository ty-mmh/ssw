// tests/icons.test.js
require('../public/js/modules/icons.js')

describe('Icons Module', () => {
  test('Iconsオブジェクトが正しくwindowに登録されるべき', () => {
    expect(window.Icons).toBeDefined()
  })

  test('主要なアイコンコンポーネントが存在すべき', () => {
    expect(typeof window.Icons.Lock).toBe('function')
    expect(typeof window.Icons.Shield).toBe('function')
    expect(typeof window.Icons.MessageCircle).toBe('function')
  })
})
