class MemorySessionStore {
  constructor() {
    this.connections = new Map()
  }

  async connect(connectionId, expiresAtEpoch) {
    this.connections.set(connectionId, { connectionId, expiresAtEpoch })
  }

  async joinSpace(connectionId, spaceId, publicKey = null) {
    const current = this.connections.get(connectionId) || { connectionId }
    this.connections.set(connectionId, {
      ...current,
      spaceId,
      sessionId: connectionId,
      publicKey,
    })
    return this.getSpaceConnections(spaceId)
  }

  async savePublicKey(connectionId, publicKey) {
    const current = this.connections.get(connectionId)
    if (current) this.connections.set(connectionId, { ...current, publicKey })
  }

  async disconnect(connectionId) {
    this.connections.delete(connectionId)
  }

  async removeConnection(connectionId) {
    this.connections.delete(connectionId)
  }

  async getSpaceConnections(spaceId) {
    return Array.from(this.connections.values()).filter(
      (connection) => connection.spaceId === spaceId,
    )
  }
}

class DynamoDbSessionStore {
  constructor(options = {}) {
    this.tableName = options.tableName || process.env.CONNECTIONS_TABLE
    this.client = options.documentClient || createDocumentClient()
  }

  async connect(connectionId, expiresAtEpoch) {
    const { PutCommand } = require('@aws-sdk/lib-dynamodb')
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { connectionId, expiresAtEpoch },
      }),
    )
  }

  async joinSpace(connectionId, spaceId, publicKey = null) {
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { connectionId },
        UpdateExpression:
          'SET spaceId = :spaceId, sessionId = :sessionId, publicKey = :publicKey',
        ExpressionAttributeValues: {
          ':spaceId': spaceId,
          ':sessionId': connectionId,
          ':publicKey': publicKey,
        },
      }),
    )
    return this.getSpaceConnections(spaceId)
  }

  async savePublicKey(connectionId, publicKey) {
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { connectionId },
        UpdateExpression: 'SET publicKey = :publicKey',
        ExpressionAttributeValues: { ':publicKey': publicKey },
      }),
    )
  }

  async disconnect(connectionId) {
    await this.removeConnection(connectionId)
  }

  async removeConnection(connectionId) {
    const { DeleteCommand } = require('@aws-sdk/lib-dynamodb')
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { connectionId },
      }),
    )
  }

  async getSpaceConnections(spaceId) {
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb')
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: process.env.CONNECTIONS_SPACE_INDEX || 'spaceId-index',
        KeyConditionExpression: 'spaceId = :spaceId',
        ExpressionAttributeValues: { ':spaceId': spaceId },
      }),
    )
    return result.Items || []
  }
}

function createDocumentClient() {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')
  return DynamoDBDocumentClient.from(new DynamoDBClient({}))
}

module.exports = {
  MemorySessionStore,
  DynamoDbSessionStore,
}
