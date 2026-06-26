const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const SAFE_S3_KEY_PATTERN =
  /^spaces\/[A-Za-z0-9_-]{1,128}\/messages\/[A-Za-z0-9_-]{1,128}\/[a-f0-9]{32}\.[A-Za-z0-9]{1,16}$/
const SAFE_S3_KEY_CAPTURE_PATTERN =
  /^spaces\/([A-Za-z0-9_-]{1,128})\/messages\/([A-Za-z0-9_-]{1,128})\/[a-f0-9]{32}\.[A-Za-z0-9]{1,16}$/
const SAFE_LOCAL_UPLOAD_PATTERN = /^\/uploads\/[A-Za-z0-9_.-]{1,255}$/
const ALLOWED_CONTENT_TYPE_PREFIXES = ['image/', 'audio/']

function createInvalidFileRequestError(message) {
  const error = new Error(message)
  error.code = 'INVALID_FILE_REQUEST'
  error.status = 400
  return error
}

function assertPresignedUploadInput(input = {}) {
  const { spaceId, messageId, fileName, contentType } = input

  if (!SAFE_ID_PATTERN.test(spaceId || '')) {
    throw createInvalidFileRequestError('spaceId is invalid.')
  }
  if (!SAFE_ID_PATTERN.test(messageId || '')) {
    throw createInvalidFileRequestError('messageId is invalid.')
  }
  if (
    typeof fileName !== 'string' ||
    fileName.length < 1 ||
    fileName.length > 255
  ) {
    throw createInvalidFileRequestError('fileName is invalid.')
  }
  if (
    typeof contentType !== 'string' ||
    !ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) =>
      contentType.startsWith(prefix),
    )
  ) {
    throw createInvalidFileRequestError('contentType is not allowed.')
  }

  return { spaceId, messageId, fileName, contentType }
}

function assertAllowedS3DownloadKey(storageKey) {
  if (SAFE_S3_KEY_PATTERN.test(storageKey || '')) return storageKey
  throw createInvalidFileRequestError('storage key is invalid.')
}

function getSpaceIdFromS3StorageKey(storageKey) {
  const match = SAFE_S3_KEY_CAPTURE_PATTERN.exec(storageKey || '')
  if (!match) throw createInvalidFileRequestError('storage key is invalid.')
  return match[1]
}

function assertAllowedLocalDownloadKey(storageKey) {
  if (SAFE_LOCAL_UPLOAD_PATTERN.test(storageKey || '')) return storageKey
  throw createInvalidFileRequestError('storage key is invalid.')
}

function assertAllowedDownloadKey(storageKey) {
  if (SAFE_S3_KEY_PATTERN.test(storageKey || '')) return storageKey
  if (SAFE_LOCAL_UPLOAD_PATTERN.test(storageKey || '')) return storageKey
  throw createInvalidFileRequestError('storage key is invalid.')
}

function getSafeFileExtension(fileName = 'upload.bin') {
  const rawExtension = fileName.includes('.') ? fileName.split('.').pop() : 'bin'
  const extension = rawExtension.replace(/[^A-Za-z0-9]/g, '').slice(0, 16)
  return extension || 'bin'
}

function isInvalidFileRequest(error) {
  return error?.code === 'INVALID_FILE_REQUEST'
}

module.exports = {
  assertAllowedDownloadKey,
  assertAllowedLocalDownloadKey,
  assertAllowedS3DownloadKey,
  assertPresignedUploadInput,
  createInvalidFileRequestError,
  getSpaceIdFromS3StorageKey,
  getSafeFileExtension,
  isInvalidFileRequest,
}
