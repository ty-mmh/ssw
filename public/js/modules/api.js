// public/js/modules/api.js
;(function () {
  'use strict'
  
  let currentPassphrase = null;

  async function call(endpoint, options = {}) {
    try {
      const response = await fetch(`/api${endpoint}`, {
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

  window.API = {
    setPassphraseForApi(passphrase) {
        currentPassphrase = passphrase;
    },

    async enterSpace(passphrase) {
      const { space } = await call('/spaces/enter', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
      })
      await window.Crypto.getOrCreateSpaceKey(space.id, passphrase)
      return space
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
      
      // [修正] テキスト専用の暗号化関数を呼び出す
      const encryptedPayload = await window.Crypto.encryptMessage(
        message,
        spaceId,
        activeSessionIds,
        currentPassphrase
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
        const fileBuffer = await file.arrayBuffer();

        // [修正] ファイル専用の暗号化関数を呼び出し、責務を分離
        const { encryptedFileBuffer, payloadForDb } = await window.Crypto.encryptFile(
            fileBuffer,
            spaceId,
            currentPassphrase
        );

        const encryptedFileBlob = new Blob([encryptedFileBuffer], { type: file.type });
        const uploadedFileInfo = await this.uploadFile(encryptedFileBlob, file.name);

        const metadata = {
            name: file.name,
            type: file.type,
            size: file.size
        };

        const { message: serverMessage } = await call('/messages/create', {
            method: 'POST',
            body: JSON.stringify({
                spaceId,
                message: uploadedFileInfo.filePath,
                encrypted: true,
                encryptedPayload: payloadForDb, // DBにはIVなど最低限の情報を保存
                messageType: messageType,
                metadata: metadata,
            }),
        });
        
        // ローカルでの再生に必要な完全なペイロードを返す
        return {
            ...serverMessage,
            text: `[${messageType === 'image' ? '画像' : '音声'}] ${file.name}`,
            timestamp: new Date(serverMessage.timestamp),
            encrypted_payload: payloadForDb,
        };
    },

    async loadMessagesFriendly(spaceId) {
      const { messages } = await call(`/messages/${spaceId}`)
      
      return await Promise.all(
        messages.map(async (msg) => {
          const messageWithDate = { ...msg, timestamp: new Date(msg.timestamp) }
          if (msg.encrypted && msg.encrypted_payload) {
            if (msg.message_type === 'image' || msg.message_type === 'audio') {
                try {
                    const response = await fetch(msg.encrypted_content);
                    if (!response.ok) throw new Error('ファイルの取得に失敗しました。');
                    const encryptedBuffer = await response.arrayBuffer();
                    const decryptedBuffer = await window.Crypto.decryptFile(encryptedBuffer, msg.encrypted_payload, spaceId);
                    const blob = new Blob([decryptedBuffer], { type: msg.metadata.type });
                    messageWithDate.blobUrl = URL.createObjectURL(blob);
                } catch(e) {
                    console.error(`メディア(ID: ${msg.id})の読み込み・復号化に失敗:`, e);
                    messageWithDate.text = `[メディアの読み込みに失敗しました]`;
                    messageWithDate.isError = true;
                }
            } else {
                try {
                    messageWithDate.text =
                      await window.Crypto.decryptMessageWithFallback(
                        msg.encrypted_payload,
                        spaceId
                      );
                } catch (e) {
                  console.error(`メッセージ(ID: ${msg.id})の復号化に失敗:`, e);
                  messageWithDate.text = `[復号化に失敗しました]`
                  messageWithDate.isError = true;
                }
            }
          }
          return messageWithDate
        }),
      )
    },
    async uploadFile(fileData, fileName) {
      const formData = new FormData()
      formData.append('file', fileData, fileName)

      try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
      } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.report('upload', error.message, { fileName });
        }
        throw error;
      }
    },
  }
})()