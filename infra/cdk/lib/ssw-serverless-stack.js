const cdk = require('aws-cdk-lib')
const path = require('path')
const apigwv2 = require('aws-cdk-lib/aws-apigatewayv2')
const integrations = require('aws-cdk-lib/aws-apigatewayv2-integrations')
const cloudfront = require('aws-cdk-lib/aws-cloudfront')
const origins = require('aws-cdk-lib/aws-cloudfront-origins')
const budgets = require('aws-cdk-lib/aws-budgets')
const dynamodb = require('aws-cdk-lib/aws-dynamodb')
const iam = require('aws-cdk-lib/aws-iam')
const lambda = require('aws-cdk-lib/aws-lambda')
const nodejs = require('aws-cdk-lib/aws-lambda-nodejs')
const s3 = require('aws-cdk-lib/aws-s3')
const s3deploy = require('aws-cdk-lib/aws-s3-deployment')

class SswServerlessStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const spacesTable = new dynamodb.Table(this, 'SpacesTable', {
      partitionKey: { name: 'passphraseHash', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      partitionKey: { name: 'spaceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sortKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAtEpoch',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAtEpoch',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'spaceId-index',
      partitionKey: { name: 'spaceId', type: dynamodb.AttributeType.STRING },
    })

    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 300,
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ expiration: cdk.Duration.days(7) }],
    })

    const staticBucket = new s3.Bucket(this, 'StaticBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const appSecret = cdk.SecretValue.ssmSecure('/ssw/app-secret').unsafeUnwrap()

    const repoRoot = path.join(__dirname, '..', '..', '..')
    const lambdaBundling = {
      externalModules: ['better-sqlite3'],
      nodeModules: [
        '@aws-sdk/client-apigatewaymanagementapi',
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-s3',
        '@aws-sdk/lib-dynamodb',
        '@aws-sdk/s3-presigned-post',
        '@aws-sdk/s3-request-presigner',
      ],
    }

    const httpFunction = new nodejs.NodejsFunction(this, 'HttpFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(repoRoot, 'lambda', 'http.js'),
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      handler: 'handler',
      bundling: lambdaBundling,
      environment: {
        STORAGE_DRIVER: 'dynamodb',
        FILE_DRIVER: 's3',
        SESSION_DRIVER: 'dynamodb',
        SPACES_TABLE: spacesTable.tableName,
        MESSAGES_TABLE: messagesTable.tableName,
        CONNECTIONS_TABLE: connectionsTable.tableName,
        CONNECTIONS_SPACE_INDEX: 'spaceId-index',
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        APP_SECRET: appSecret,
      },
    })

    spacesTable.grantReadWriteData(httpFunction)
    messagesTable.grantReadWriteData(httpFunction)
    httpFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [uploadsBucket.arnForObjects('spaces/*')],
      }),
    )

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowHeaders: ['content-type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    })
    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration(
        'HttpIntegration',
        httpFunction,
      ),
    })

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(staticBucket),
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split('/', httpApi.apiEndpoint)),
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    })

    new s3deploy.BucketDeployment(this, 'StaticAssetDeployment', {
      sources: [
        s3deploy.Source.asset(path.join(repoRoot, 'public'), {
          exclude: ['uploads/*', 'uploads/**'],
        }),
      ],
      destinationBucket: staticBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    const websocketFunction = new nodejs.NodejsFunction(this, 'WebSocketFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(repoRoot, 'lambda', 'websocket.js'),
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      handler: 'handler',
      bundling: lambdaBundling,
      environment: {
        STORAGE_DRIVER: 'dynamodb',
        FILE_DRIVER: 's3',
        SESSION_DRIVER: 'dynamodb',
        CONNECTIONS_TABLE: connectionsTable.tableName,
        CONNECTIONS_SPACE_INDEX: 'spaceId-index',
      },
    })
    connectionsTable.grantReadWriteData(websocketFunction)

    const websocketIntegration = new integrations.WebSocketLambdaIntegration(
      'WebSocketIntegration',
      websocketFunction,
    )
    const websocketApi = new apigwv2.WebSocketApi(this, 'WebSocketApi', {
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: { integration: websocketIntegration },
      disconnectRouteOptions: { integration: websocketIntegration },
      defaultRouteOptions: { integration: websocketIntegration },
    })
    websocketApi.addRoute('joinSpace', { integration: websocketIntegration })
    websocketApi.addRoute('newMessage', { integration: websocketIntegration })
    websocketApi.addRoute('publicKeyAnnouncement', {
      integration: websocketIntegration,
    })
    const websocketStage = new apigwv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: websocketApi,
      stageName: 'prod',
      autoDeploy: true,
    })
    httpFunction.addEnvironment('PUBLIC_WS_URL', websocketStage.url)
    websocketFunction.addEnvironment(
      'WEBSOCKET_CALLBACK_URL',
      `https://${websocketApi.apiId}.execute-api.${this.region}.${this.urlSuffix}/${websocketStage.stageName}`,
    )
    websocketFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:${this.partition}:execute-api:${this.region}:${this.account}:${websocketApi.apiId}/${websocketStage.stageName}/POST/@connections/*`,
        ],
      }),
    )

    const budgetNotificationEmail = this.node.tryGetContext('budgetNotificationEmail')
    const budgetAmountUsd = Number(this.node.tryGetContext('budgetAmountUsd') || 5)
    if (budgetNotificationEmail) {
      new budgets.CfnBudget(this, 'MonthlyCostBudget', {
        budget: {
          budgetName: `${this.stackName}-monthly-cost-budget`,
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: {
            amount: budgetAmountUsd,
            unit: 'USD',
          },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: 'GREATER_THAN',
              notificationType: 'ACTUAL',
              threshold: 80,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [
              {
                subscriptionType: 'EMAIL',
                address: budgetNotificationEmail,
              },
            ],
          },
          {
            notification: {
              comparisonOperator: 'GREATER_THAN',
              notificationType: 'FORECASTED',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [
              {
                subscriptionType: 'EMAIL',
                address: budgetNotificationEmail,
              },
            ],
          },
        ],
      })
    } else {
      new cdk.CfnOutput(this, 'BudgetSetupRequired', {
        value:
          'No budgetNotificationEmail context was provided. Re-run synth/deploy with -c budgetNotificationEmail=<email> to create an AWS Budget notification.',
      })
    }

    new cdk.CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint })
    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: websocketStage.url,
    })
    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
    })
  }
}

module.exports = {
  SswServerlessStack,
}
