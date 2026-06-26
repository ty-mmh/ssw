jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn().mockResolvedValue({
    url: 'https://uploads.example.test',
    fields: { key: 'signed-field' },
  }),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://download.example.test/file'),
}))

const { createPresignedPost } = require('@aws-sdk/s3-presigned-post')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { S3FileStore, buildStorageKey } = require('../storage/s3-file-store')

describe('S3FileStore', () => {
  test('creates presigned upload without plaintext file contents or keys', async () => {
    const store = new S3FileStore({
      bucketName: 'uploads',
      s3Client: {},
      maxFileSizeBytes: 1024,
    })

    const result = await store.createPresignedUpload({
      spaceId: 'space-1',
      messageId: 'message-1',
      fileName: 'photo.png',
      contentType: 'image/png',
    })

    expect(result).toEqual(
      expect.objectContaining({
        mode: 's3-post',
        uploadUrl: 'https://uploads.example.test',
      }),
    )
    expect(result.storageKey).toMatch(
      /^spaces\/space-1\/messages\/message-1\/[a-f0-9]{32}\.png$/,
    )
    expect(JSON.stringify(result)).not.toContain('plaintext')
    expect(JSON.stringify(result)).not.toContain('passphrase')
    expect(createPresignedPost.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        Bucket: 'uploads',
        Conditions: expect.arrayContaining([['content-length-range', 1, 1024]]),
      }),
    )
  })

  test('creates download URLs on demand', async () => {
    const store = new S3FileStore({ bucketName: 'uploads', s3Client: {} })

    await expect(
      store.createPresignedDownload('spaces/s/messages/m/file.bin'),
    ).resolves.toEqual({ downloadUrl: 'https://download.example.test/file' })
    expect(getSignedUrl).toHaveBeenCalled()
  })

  test('builds hard-to-guess storage keys', () => {
    expect(buildStorageKey('s', 'm', 'voice.webm')).toMatch(
      /^spaces\/s\/messages\/m\/[a-f0-9]{32}\.webm$/,
    )
  })
})
