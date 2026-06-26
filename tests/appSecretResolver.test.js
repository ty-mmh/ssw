describe('app secret resolver', () => {
  let originalEnv

  beforeEach(() => {
    jest.resetModules()
    originalEnv = { ...process.env }
    delete process.env.APP_SECRET
    delete process.env.APP_SECRET_PARAMETER_NAME
  })

  afterEach(() => {
    process.env = originalEnv
    jest.resetModules()
    jest.dontMock('@aws-sdk/client-ssm')
  })

  test('returns local APP_SECRET without calling SSM', async () => {
    const ssm = mockSsm({ Parameter: { Value: 'ssm-secret' } })
    process.env.APP_SECRET = 'local-secret'
    const { resolveAppSecret } = require('../utils/app-secret-resolver')

    await expect(resolveAppSecret()).resolves.toBe('local-secret')
    expect(ssm.send).not.toHaveBeenCalled()
  })

  test('resolves SecureString parameter with decryption and stores APP_SECRET', async () => {
    const ssm = mockSsm({ Parameter: { Value: 'ssm-secret' } })
    process.env.APP_SECRET_PARAMETER_NAME = '/ssw/app-secret'
    const { resolveAppSecret } = require('../utils/app-secret-resolver')

    await expect(resolveAppSecret()).resolves.toBe('ssm-secret')

    expect(ssm.GetParameterCommand).toHaveBeenCalledWith({
      Name: '/ssw/app-secret',
      WithDecryption: true,
    })
    expect(process.env.APP_SECRET).toBe('ssm-secret')
  })

  test('caches resolved parameter value', async () => {
    const ssm = mockSsm({ Parameter: { Value: 'ssm-secret' } })
    process.env.APP_SECRET_PARAMETER_NAME = '/ssw/app-secret'
    const { resolveAppSecret } = require('../utils/app-secret-resolver')

    await resolveAppSecret()
    delete process.env.APP_SECRET
    await expect(resolveAppSecret()).resolves.toBe('ssm-secret')

    expect(ssm.send).toHaveBeenCalledTimes(1)
    expect(process.env.APP_SECRET).toBe('ssm-secret')
  })
})

function mockSsm(response) {
  const send = jest.fn().mockResolvedValue(response)
  const SSMClient = jest.fn(() => ({ send }))
  const GetParameterCommand = jest.fn(function GetParameterCommand(input) {
    this.input = input
  })
  jest.doMock('@aws-sdk/client-ssm', () => ({
    SSMClient,
    GetParameterCommand,
  }))
  return { send, SSMClient, GetParameterCommand }
}
