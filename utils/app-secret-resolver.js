let cachedSecret = null
let cachedClient = null

async function resolveAppSecret(env = process.env) {
  if (env.APP_SECRET) return env.APP_SECRET

  if (cachedSecret) {
    env.APP_SECRET = cachedSecret
    return cachedSecret
  }

  const parameterName = env.APP_SECRET_PARAMETER_NAME
  if (!parameterName) return undefined

  const { GetParameterCommand } = require('@aws-sdk/client-ssm')
  const result = await getClient().send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    }),
  )
  const secret = result.Parameter?.Value
  if (!secret) {
    throw new Error(`APP_SECRET parameter was empty: ${parameterName}`)
  }

  cachedSecret = secret
  env.APP_SECRET = secret
  return secret
}

function getClient() {
  if (!cachedClient) {
    const { SSMClient } = require('@aws-sdk/client-ssm')
    cachedClient = new SSMClient({})
  }
  return cachedClient
}

function resetAppSecretCacheForTesting() {
  cachedSecret = null
  cachedClient = null
}

module.exports = {
  resolveAppSecret,
  resetAppSecretCacheForTesting,
}
