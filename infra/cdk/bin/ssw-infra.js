#!/usr/bin/env node
const cdk = require('aws-cdk-lib')
const { SswServerlessStack } = require('../lib/ssw-serverless-stack')

const app = new cdk.App()
new SswServerlessStack(app, 'SswServerlessStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
})
