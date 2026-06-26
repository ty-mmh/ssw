const { createStores } = require('../storage/create-stores')
const {
  DynamoDbMessageStore,
  DynamoDbSpaceStore,
} = require('../storage/dynamodb-store')
const { SqliteSpaceStore } = require('../storage/sqlite-store')

describe('DynamoDB stores', () => {
  test('creates spaces with passphraseHash uniqueness and maps conflicts', async () => {
    const client = { send: jest.fn().mockResolvedValue({}) }
    const store = new DynamoDbSpaceStore({
      tableName: 'Spaces',
      documentClient: client,
    })

    await store.createSpace({
      id: 'space-1',
      passphraseHash: 'hash-1',
      created_at: '2026-01-01T00:00:00.000Z',
      last_activity_at: '2026-01-01T00:00:00.000Z',
    })

    expect(client.send.mock.calls[0][0].input).toEqual(
      expect.objectContaining({
        TableName: 'Spaces',
        ConditionExpression: 'attribute_not_exists(passphraseHash)',
      }),
    )

    client.send.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' })
    await expect(
      store.createSpace({
        id: 'space-2',
        passphraseHash: 'hash-1',
        created_at: '2026-01-01T00:00:00.000Z',
        last_activity_at: '2026-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'SPACE_EXISTS' })
  })

  test('queries messages by space and filters by expiresAtEpoch', async () => {
    const client = {
      send: jest.fn().mockResolvedValue({
        Items: [
          {
            messageId: 'm1',
            spaceId: 'space-1',
            encryptedContent: '[ENCRYPTED]',
            timestamp: '2026-01-01T00:01:00.000Z',
            expiresAt: '2026-01-02T00:01:00.000Z',
            isDeleted: 0,
            encrypted: 1,
            encryptedPayload: { type: 'deterministic' },
            messageType: 'text',
          },
        ],
      }),
    }
    const store = new DynamoDbMessageStore({
      tableName: 'Messages',
      documentClient: client,
    })

    const messages = await store.listMessages('space-1', {
      since: '2026-01-01T00:00:00.000Z',
      now: new Date('2026-01-01T00:30:00.000Z'),
    })

    expect(client.send.mock.calls[0][0].input).toEqual(
      expect.objectContaining({
        KeyConditionExpression: 'spaceId = :spaceId AND sortKey > :sinceSortKey',
        FilterExpression: 'isDeleted = :isDeleted AND expiresAtEpoch > :now',
        ScanIndexForward: true,
      }),
    )
    expect(messages[0]).toEqual(
      expect.objectContaining({
        id: 'm1',
        encrypted_payload: { type: 'deterministic' },
      }),
    )
  })

  test('looks up active media messages before download signing', async () => {
    const storageKey =
      'spaces/space-1/messages/message-1/0123456789abcdef0123456789abcdef.png'
    const client = {
      send: jest.fn().mockResolvedValue({
        Items: [
          {
            messageId: 'm1',
            spaceId: 'space-1',
            encryptedContent: storageKey,
            timestamp: '2026-01-01T00:01:00.000Z',
            expiresAt: '2026-01-02T00:01:00.000Z',
            expiresAtEpoch: 1767312060,
            isDeleted: 0,
            encrypted: 1,
            encryptedPayload: { type: 'file' },
            messageType: 'image',
          },
        ],
      }),
    }
    const store = new DynamoDbMessageStore({
      tableName: 'Messages',
      documentClient: client,
    })

    const message = await store.findActiveMediaMessageByStorageKey(storageKey, {
      now: new Date('2026-01-01T00:30:00.000Z'),
    })

    expect(client.send.mock.calls[0][0].input).toEqual(
      expect.objectContaining({
        KeyConditionExpression: 'spaceId = :spaceId',
        FilterExpression:
          'encryptedContent = :storageKey AND isDeleted = :isDeleted AND expiresAtEpoch > :now',
        ExpressionAttributeValues: expect.objectContaining({
          ':spaceId': 'space-1',
          ':storageKey': storageKey,
        }),
      }),
    )
    expect(message).toEqual(expect.objectContaining({ id: 'm1' }))
  })

  test('selects DynamoDB only when STORAGE_DRIVER=dynamodb', () => {
    const dynamoStores = createStores({
      env: { STORAGE_DRIVER: 'dynamodb', FILE_DRIVER: 'local' },
      dynamoDb: { documentClient: { send: jest.fn() } },
    })
    expect(dynamoStores.spaceStore).toBeInstanceOf(DynamoDbSpaceStore)

    const sqliteStores = createStores({
      env: { STORAGE_DRIVER: 'sqlite', FILE_DRIVER: 'local' },
      db: createMemoryDb(),
    })
    expect(sqliteStores.spaceStore).toBeInstanceOf(SqliteSpaceStore)
    sqliteStores.db.close()
  })
})

function createMemoryDb() {
  const Database = require('better-sqlite3')
  return new Database(':memory:')
}
