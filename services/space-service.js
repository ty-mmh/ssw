const { nanoid } = require('../utils/id-generator')
const {
  getAppSecret,
  hashPassphrase,
  validatePassphrase,
} = require('../utils/passphrase')

function createSpaceService({ spaceStore, env = process.env }) {
  const secret = getAppSecret(env)

  return {
    async createSpace(passphrase) {
      const validation = validatePassphrase(passphrase)
      if (!validation.valid) {
        return { status: 400, body: { success: false, error: validation.error } }
      }

      const now = new Date().toISOString()
      const space = {
        id: nanoid(),
        passphraseHash: hashPassphrase(validation.passphrase, secret),
        created_at: now,
        last_activity_at: now,
      }

      try {
        const created = await spaceStore.createSpace(space)
        return {
          status: 201,
          body: {
            success: true,
            message: '新しい空間を作成しました。',
            space: sanitizeSpace(created),
          },
        }
      } catch (error) {
        if (error.code === 'SPACE_EXISTS') {
          return {
            status: 409,
            body: {
              success: false,
              error: 'その合言葉は既に使用されています。',
            },
          }
        }
        throw error
      }
    },

    async enterSpace(passphrase) {
      const validation = validatePassphrase(passphrase)
      if (!validation.valid) {
        return { status: 400, body: { success: false, error: validation.error } }
      }

      const passphraseHash = hashPassphrase(validation.passphrase, secret)
      const space = await spaceStore.findByPassphraseHash(passphraseHash)
      if (!space) {
        return {
          status: 404,
          body: { success: false, error: 'その合言葉の空間は存在しません。' },
        }
      }

      await spaceStore.touchSpace(space.id, passphraseHash)
      return { status: 200, body: { success: true, space: sanitizeSpace(space) } }
    },
  }
}

function sanitizeSpace(space) {
  if (!space) return space
  const {
    passphrase,
    passphrase_hash,
    passphraseHash,
    ...safeSpace
  } = space
  return safeSpace
}

module.exports = {
  createSpaceService,
  sanitizeSpace,
}
