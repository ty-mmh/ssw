const { sanitizeSpace } = require('../services/space-service')
const {
  assertAllowedS3DownloadKey,
  getSpaceIdFromS3StorageKey,
} = require('../utils/file-validation')

class DynamoDbSpaceStore {
  constructor(options = {}) {
    this.tableName = options.tableName || process.env.SPACES_TABLE
    this.client = options.documentClient || createDocumentClient()
  }

  async createSpace(space) {
    const { PutCommand } = require('@aws-sdk/lib-dynamodb')
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            passphraseHash: space.passphraseHash,
            spaceId: space.id,
            createdAt: space.created_at,
            lastActivityAt: space.last_activity_at,
          },
          ConditionExpression: 'attribute_not_exists(passphraseHash)',
        }),
      )
      return sanitizeSpace({
        id: space.id,
        created_at: space.created_at,
        last_activity_at: space.last_activity_at,
      })
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        const exists = new Error('Space already exists')
        exists.code = 'SPACE_EXISTS'
        throw exists
      }
      throw error
    }
  }

  async findByPassphraseHash(passphraseHash) {
    const { GetCommand } = require('@aws-sdk/lib-dynamodb')
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { passphraseHash },
      }),
    )
    if (!result.Item) return null
    return {
      id: result.Item.spaceId,
      created_at: result.Item.createdAt,
      last_activity_at: result.Item.lastActivityAt,
    }
  }

  async touchSpace(spaceId, passphraseHash) {
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { passphraseHash },
        UpdateExpression: 'SET lastActivityAt = :lastActivityAt',
        ConditionExpression: 'spaceId = :spaceId',
        ExpressionAttributeValues: {
          ':lastActivityAt': new Date().toISOString(),
          ':spaceId': spaceId,
        },
      }),
    )
  }
}

class DynamoDbMessageStore {
  constructor(options = {}) {
    this.tableName = options.tableName || process.env.MESSAGES_TABLE
    this.client = options.documentClient || createDocumentClient()
  }

  async listMessages(spaceId, options = {}) {
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb')
    const nowEpoch = Math.floor((options.now || new Date()).getTime() / 1000)
    const expressionValues = {
      ':spaceId': spaceId,
      ':now': nowEpoch,
    }
    let keyCondition = 'spaceId = :spaceId'
    if (options.since) {
      const since = new Date(options.since)
      if (Number.isNaN(since.getTime())) {
        const error = new Error('Invalid since timestamp')
        error.code = 'INVALID_SINCE'
        throw error
      }
      expressionValues[':sinceSortKey'] = `${since.toISOString()}#`
      keyCondition += ' AND sortKey > :sinceSortKey'
    }
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyCondition,
        FilterExpression: 'isDeleted = :isDeleted AND expiresAtEpoch > :now',
        ExpressionAttributeValues: {
          ...expressionValues,
          ':isDeleted': 0,
        },
        ScanIndexForward: true,
      }),
    )
    return (result.Items || []).map(fromDynamoMessage)
  }

  async createMessage(message) {
    const { PutCommand } = require('@aws-sdk/lib-dynamodb')
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toDynamoMessage(message),
        ConditionExpression: 'attribute_not_exists(spaceId) AND attribute_not_exists(sortKey)',
      }),
    )
    return message
  }

  async cleanupExpiredMessages() {
    return 0
  }

  async findActiveMediaMessageByStorageKey(storageKey, options = {}) {
    assertAllowedS3DownloadKey(storageKey)
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb')
    const nowEpoch = Math.floor((options.now || new Date()).getTime() / 1000)
    const spaceId = getSpaceIdFromS3StorageKey(storageKey)
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'spaceId = :spaceId',
        FilterExpression:
          'encryptedContent = :storageKey AND isDeleted = :isDeleted AND expiresAtEpoch > :now',
        ExpressionAttributeValues: {
          ':spaceId': spaceId,
          ':storageKey': storageKey,
          ':isDeleted': 0,
          ':now': nowEpoch,
        },
        ScanIndexForward: true,
      }),
    )
    const [item] = result.Items || []
    return item ? fromDynamoMessage(item) : null
  }
}

function createDocumentClient() {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')
  return DynamoDBDocumentClient.from(new DynamoDBClient({}))
}

function toDynamoMessage(message) {
  return {
    spaceId: message.space_id,
    sortKey: `${message.timestamp}#${message.id}`,
    messageId: message.id,
    encryptedContent: message.encrypted_content,
    timestamp: message.timestamp,
    expiresAt: message.expires_at,
    expiresAtEpoch: message.expires_at_epoch,
    isDeleted: message.is_deleted,
    encrypted: message.encrypted,
    encryptedPayload: message.encrypted_payload,
    messageType: message.message_type,
    metadata: message.metadata,
  }
}

function fromDynamoMessage(item) {
  return {
    id: item.messageId,
    space_id: item.spaceId,
    encrypted_content: item.encryptedContent,
    timestamp: item.timestamp,
    expires_at: item.expiresAt,
    is_deleted: item.isDeleted,
    encrypted: item.encrypted,
    encrypted_payload: item.encryptedPayload || null,
    message_type: item.messageType,
    metadata: item.metadata || null,
  }
}

module.exports = {
  DynamoDbSpaceStore,
  DynamoDbMessageStore,
  createDocumentClient,
  toDynamoMessage,
  fromDynamoMessage,
}
