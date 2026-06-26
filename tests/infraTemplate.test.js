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
})
