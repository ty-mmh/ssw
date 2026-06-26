const crypto = require('crypto')

class S3FileStore {
  constructor(options = {}) {
    this.bucketName = options.bucketName || process.env.UPLOADS_BUCKET
    this.client = options.s3Client || createS3Client()
    this.maxFileSizeBytes =
      options.maxFileSizeBytes ||
      (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024
  }

  async createPresignedUpload({ spaceId, messageId, fileName, contentType }) {
    const { createPresignedPost } = require('@aws-sdk/s3-presigned-post')
    const storageKey = buildStorageKey(spaceId, messageId, fileName)
    const post = await createPresignedPost(this.client, {
      Bucket: this.bucketName,
      Key: storageKey,
      Conditions: [
        ['content-length-range', 1, this.maxFileSizeBytes],
        ['starts-with', '$Content-Type', contentType || ''],
      ],
      Fields: {
        'Content-Type': contentType || 'application/octet-stream',
      },
      Expires: 300,
    })
    return {
      mode: 's3-post',
      storageKey,
      uploadUrl: post.url,
      fields: post.fields,
    }
  }

  async createPresignedDownload(storageKey) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3')
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
    const downloadUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      }),
      { expiresIn: 300 },
    )
    return { downloadUrl }
  }
}

function createS3Client() {
  const { S3Client } = require('@aws-sdk/client-s3')
  return new S3Client({})
}

function buildStorageKey(spaceId, messageId, fileName = 'upload.bin') {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin'
  const random = crypto.randomBytes(16).toString('hex')
  return `spaces/${spaceId}/messages/${messageId}/${random}.${ext}`
}

module.exports = {
  S3FileStore,
  createS3Client,
  buildStorageKey,
}
