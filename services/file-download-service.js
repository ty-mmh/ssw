async function storageKeyHasActiveMessage(messageStore, storageKey) {
  if (!messageStore?.findActiveMediaMessageByStorageKey) return true
  return Boolean(
    await messageStore.findActiveMediaMessageByStorageKey(storageKey, {
      now: new Date(),
    }),
  )
}

module.exports = {
  storageKeyHasActiveMessage,
}
