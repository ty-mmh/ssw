const fs = require('fs')
const os = require('os')
const path = require('path')

describe('Lambda HTTP handler', () => {
  let tempDir
  let originalEnv

  beforeEach(() => {
    jest.resetModules()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssw-lambda-'))
    originalEnv = { ...process.env }
    process.env.STORAGE_DRIVER = 'sqlite'
    process.env.FILE_DRIVER = 'local'
    process.env.SQLITE_DB_PATH = path.join(tempDir, 'lambda.db')
    process.env.APP_SECRET = 'lambda-secret'
  })

  afterEach(() => {
    try {
      require('../lambda/http').resetForTesting()
    } catch (error) {
      // Module may not have been required if a test fails before loading it.
    }
    process.env = originalEnv
    jest.dontMock('@aws-sdk/client-ssm')
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('creates and enters a space without returning plaintext passphrase', async () => {
    const { handler } = require('../lambda/http')
    const createResponse = await handler(
      event('POST', '/api/spaces/create', { passphrase: 'room' }),
    )
    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.body).not.toContain('room')

    const enterResponse = await handler(
      event('POST', '/api/spaces/enter', { passphrase: 'room' }),
    )
    expect(enterResponse.statusCode).toBe(200)
    expect(enterResponse.body).not.toContain('room')
  })

  test('resolves APP_SECRET from SSM parameter before creating services', async () => {
    delete process.env.APP_SECRET
    process.env.APP_SECRET_PARAMETER_NAME = '/ssw/app-secret'
    const ssm = mockSsm({ Parameter: { Value: 'lambda-ssm-secret' } })
    const { handler } = require('../lambda/http')

    const createResponse = await handler(
      event('POST', '/api/spaces/create', { passphrase: 'room' }),
    )
    expect(createResponse.statusCode).toBe(201)
    expect(process.env.APP_SECRET).toBe('lambda-ssm-secret')

    const enterResponse = await handler(
      event('POST', '/api/spaces/enter', { passphrase: 'room' }),
    )
    expect(enterResponse.statusCode).toBe(200)
    expect(ssm.GetParameterCommand).toHaveBeenCalledWith({
      Name: '/ssw/app-secret',
      WithDecryption: true,
    })
  })

  test('creates and lists messages through Lambda shape', async () => {
    const { handler } = require('../lambda/http')
    const createSpace = await handler(
      event('POST', '/api/spaces/create', { passphrase: 'room' }),
    )
    const space = JSON.parse(createSpace.body).space

    const createMessage = await handler(
      event('POST', '/api/messages/create', {
        spaceId: space.id,
        message: '[ENCRYPTED]',
        encrypted: true,
        encryptedPayload: { type: 'deterministic' },
        messageType: 'text',
      }),
    )
    expect(createMessage.statusCode).toBe(201)

    const listMessages = await handler({
      requestContext: { http: { method: 'GET' } },
      rawPath: `/api/messages/${space.id}`,
      pathParameters: { spaceId: space.id },
      queryStringParameters: {},
    })
    expect(JSON.parse(listMessages.body).messages).toHaveLength(1)
  })

  test('rejects invalid presign requests before signing', async () => {
    const { handler } = require('../lambda/http')

    const uploadResponse = await handler(
      event('POST', '/api/files/presign-upload', {
        spaceId: '../space',
        messageId: 'message-1',
        fileName: 'photo.png',
        contentType: 'image/png',
      }),
    )
    expect(uploadResponse.statusCode).toBe(400)

    const downloadResponse = await handler({
      requestContext: { http: { method: 'GET' } },
      rawPath: '/api/files/presign-download',
      queryStringParameters: { key: 'https://example.test/file.bin' },
    })
    expect(downloadResponse.statusCode).toBe(400)
  })

  test('signs downloads only when the storage key is referenced by an active message', async () => {
    const { handler } = require('../lambda/http')
    const createSpace = await handler(
      event('POST', '/api/spaces/create', { passphrase: 'room' }),
    )
    const space = JSON.parse(createSpace.body).space
    const storageKey = '/uploads/file-123.png'

    await handler(
      event('POST', '/api/messages/create', {
        spaceId: space.id,
        message: storageKey,
        encrypted: true,
        encryptedPayload: { type: 'file' },
        messageType: 'image',
        metadata: { type: 'image/png' },
      }),
    )

    const foundResponse = await handler({
      requestContext: { http: { method: 'GET' } },
      rawPath: '/api/files/presign-download',
      queryStringParameters: { key: storageKey },
    })
    expect(foundResponse.statusCode).toBe(200)
    expect(JSON.parse(foundResponse.body).downloadUrl).toBe(storageKey)

    const missingResponse = await handler({
      requestContext: { http: { method: 'GET' } },
      rawPath: '/api/files/presign-download',
      queryStringParameters: { key: '/uploads/missing.png' },
    })
    expect(missingResponse.statusCode).toBe(404)
  })
})

function event(method, rawPath, body) {
  return {
    requestContext: { http: { method } },
    rawPath,
    body: JSON.stringify(body),
  }
}

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
