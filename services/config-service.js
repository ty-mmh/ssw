function getRuntimeConfig(env = process.env) {
  const maxFileSizeMb = parseInt(env.MAX_FILE_SIZE_MB, 10) || 10
  return {
    maxFileSize: maxFileSizeMb * 1024 * 1024,
    apiBaseUrl: env.PUBLIC_API_BASE_URL || '',
    wsUrl: env.PUBLIC_WS_URL || '',
    pollingIntervalMs: parseInt(env.POLLING_INTERVAL_MS, 10) || 5000,
  }
}

module.exports = {
  getRuntimeConfig,
}
