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
})

function event(method, rawPath, body) {
  return {
    requestContext: { http: { method } },
    rawPath,
    body: JSON.stringify(body),
  }
}
