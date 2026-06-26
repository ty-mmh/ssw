const fs = require('fs')
const path = require('path')

describe('CDK infrastructure definition', () => {
  const stackSource = fs.readFileSync(
    path.join(__dirname, '..', 'infra', 'cdk', 'lib', 'ssw-serverless-stack.js'),
    'utf8',
  )

  test('uses expiresAtEpoch for connection TTL and includes budget context', () => {
    expect(stackSource).toContain("timeToLiveAttribute: 'expiresAtEpoch'")
    expect(stackSource).not.toContain("timeToLiveAttribute: 'ttlEpoch'")
    expect(stackSource).toContain("tryGetContext('budgetNotificationEmail')")
    expect(stackSource).toContain('MonthlyCostBudget')
  })

  test('does not grant HTTP Lambda wildcard websocket management permissions', () => {
    expect(stackSource).not.toContain("resources: ['*']")
    expect(stackSource).toContain("arnForObjects('spaces/*')")
    expect(stackSource).toContain('/POST/@connections/*')
  })

  test('configures browser upload CORS, static deployment, and websocket runtime config', () => {
    expect(stackSource).toContain('allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST]')
    expect(stackSource).toContain('StaticAssetDeployment')
    expect(stackSource).toContain("s3deploy.Source.asset(path.join(repoRoot, 'public')")
    expect(stackSource).toContain("exclude: ['uploads/*', 'uploads/**']")
    expect(stackSource).toContain("httpFunction.addEnvironment('PUBLIC_WS_URL'")
  })

  test('passes APP_SECRET parameter name instead of a secure dynamic reference', () => {
    expect(stackSource).toContain("require('aws-cdk-lib/aws-ssm')")
    expect(stackSource).toContain('APP_SECRET_PARAMETER_NAME')
    expect(stackSource).toContain('fromSecureStringParameterAttributes')
    expect(stackSource).toContain('appSecretParameter.grantRead(httpFunction)')
    expect(stackSource).toContain("'@aws-sdk/client-ssm'")
    expect(stackSource).not.toContain('ssmSecure')
    expect(stackSource).not.toContain('{{resolve:ssm-secure:/ssw/app-secret}}')
  })
})
