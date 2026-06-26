// public/js/modules/api.js
;(function () {
  'use strict'

  let currentPassphrase = null

  function getConfig() {
    return window.SSW_CONFIG || {}
  }

  function apiUrl(endpoint) {
    const baseUrl = getConfig().apiBaseUrl || ''
    return `${baseUrl.replace(/\/$/, '')}/api${endpoint}`
  }

  async function call(endpoint, options = {}) {
    try {
      const response = await fetch(apiUrl(endpoint), {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data
    } catch (error) {
      if (window.ErrorHandler) {
        window.ErrorHandler.report('api', error.message, { endpoint })
      }
      throw error
    }
  }

  async function fetchBinary(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('ファイルの取得に失敗しました。')
    return await response.arrayBuffer()
  }

  async function resolveDownloadUrl(encryptedContent) {
    if (!encryptedContent) return encryptedContent
    if (
      encryptedContent.startsWith('/uploads/') ||
      encryptedContent.startsWith('http://') ||
      encryptedContent.startsWith('https://') ||
      encryptedContent.startsWith('blob:')
    ) {
      return encryptedContent
    }
    const { downloadUrl } = await call(
      `/files/presign-download?key=${encodeURIComponent(encryptedContent)}`,
    )
    return downloadUrl
  }

  window.API = {
    setPassphraseForApi(passphrase) {
      currentPassphrase = passphrase
    },

    getApiUrl(endpoint) {
      return apiUrl(endpoint)
    },

    async enterSpace(passphrase) {
      const { space } = await call('/spaces/enter', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      })
      await window.Crypto.getOrCreateSpaceKey(space.id, passphrase)
      return { ...space, localPassphrase: passphrase }
    },

    async createSpace(passphrase) {
      return await call('/spaces/create', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      })
    },

    async sendMessageFriendly(spaceId, message) {
      const activeSessionIds =
        window.SessionManager.getActiveSessionsForSpace(spaceId)

      const encryptedPayload = await window.Crypto.encryptMessage(
        message,
        spaceId,
        activeSessionIds,
        currentPassphrase,
      )

      const { message: serverMessage } = await call('/messages/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          message: '[ENCRYPTED]',
          encrypted: true,
          encryptedPayload,
          messageType: 'text',
        }),
      })
      return {
        ...serverMessage,
        text: message,
        timestamp: new Date(serverMessage.timestamp),
      }
    },

    async sendMediaMessage(spaceId, file, messageType) {
      const fileBuffer = await file.arrayBuffer()
      const { encryptedFileBuffer, payloadForDb } =
        await window.Crypto.encryptFile(fileBuffer, spaceId, currentPassphrase)

      const encryptedFileBlob = new Blob([encryptedFileBuffer], {
        type: file.type,
      })
      const messageId = `media_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`
      const uploadedFileInfo = await this.uploadFile(
        encryptedFileBlob,
        file.name,
        {
          spaceId,
          messageId,
          contentType: file.type,
        },
      )

      const metadata = {
        name: file.name,
        type: file.type,
        size: file.size,
      }

      const { message: serverMessage } = await call('/messages/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          message: uploadedFileInfo.storageKey || uploadedFileInfo.filePath,
          encrypted: true,
          encryptedPayload: payloadForDb,
          messageType,
          metadata,
        }),
      })

      return {
        ...serverMessage,
        text: `[${messageType === 'image' ? '画像' : '音声'}] ${file.name}`,
        timestamp: new Date(serverMessage.timestamp),
        encrypted_payload: payloadForDb,
      }
    },

    async loadMessagesFriendly(spaceId, options = {}) {
      const query = options.since
        ? `?since=${encodeURIComponent(options.since)}`
        : ''
      const { messages } = await call(`/messages/${spaceId}${query}`)

      return await Promise.all(
        messages.map(async (msg) => {
          const messageWithDate = { ...msg, timestamp: new Date(msg.timestamp) }
          if (msg.encrypted && msg.encrypted_payload) {
            if (msg.message_type === 'image' || msg.message_type === 'audio') {
              try {
                const downloadUrl = await resolveDownloadUrl(
                  msg.encrypted_content,
                )
                const encryptedBuffer = await fetchBinary(downloadUrl)
                const decryptedBuffer = await window.Crypto.decryptFile(
                  encryptedBuffer,
                  msg.encrypted_payload,
                  spaceId,
                )
                const blob = new Blob([decryptedBuffer], {
                  type: msg.metadata.type,
                })
                messageWithDate.blobUrl = URL.createObjectURL(blob)
              } catch (e) {
                console.error(`メディア(ID: ${msg.id})の復号に失敗`, e)
                messageWithDate.text = '[メディアの読み込みに失敗しました]'
                messageWithDate.isError = true
              }
            } else {
              try {
                messageWithDate.text =
                  await window.Crypto.decryptMessageWithFallback(
                    msg.encrypted_payload,
                    spaceId,
                  )
              } catch (e) {
                console.error(`メッセージ(ID: ${msg.id})の復号に失敗`, e)
                messageWithDate.text = '[復号に失敗しました]'
                messageWithDate.isError = true
              }
            }
          }
          return messageWithDate
        }),
      )
    },

    async resolveDownloadUrl(encryptedContent) {
      return await resolveDownloadUrl(encryptedContent)
    },

    async downloadEncryptedContent(encryptedContent) {
      const downloadUrl = await resolveDownloadUrl(encryptedContent)
      return await fetchBinary(downloadUrl)
    },

    async uploadFile(fileData, fileName, options = {}) {
      const presign = await call('/files/presign-upload', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: options.spaceId,
          messageId: options.messageId,
          fileName,
          contentType: options.contentType || fileData.type,
        }),
      })

      if (presign.mode === 's3-post') {
        const formData = new FormData()
        Object.entries(presign.fields || {}).forEach(([key, value]) => {
          formData.append(key, value)
        })
        formData.append('file', fileData, fileName)
        const response = await fetch(presign.uploadUrl, {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) throw new Error(`S3 upload failed: ${response.status}`)
        return { storageKey: presign.storageKey }
      }

      const formData = new FormData()
      formData.append('file', fileData, fileName)
      const response = await fetch(apiUrl('/files/upload'), {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data
    },
  }
})()
