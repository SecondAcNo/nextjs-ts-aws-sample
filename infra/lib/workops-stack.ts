import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "node:path";
import { Construct } from "constructs";

export class WorkOpsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Project", "WorkOpsPortfolio");
    cdk.Tags.of(this).add("CostProfile", "FreeTierOrShortDemo");

    const databaseUrl = new cdk.CfnParameter(this, "DatabaseUrl", {
      description: "PostgreSQL connection string for the AWS demo database.",
      noEcho: true,
      type: "String",
    });

    const cognitoDomainPrefix = new cdk.CfnParameter(this, "CognitoDomainPrefix", {
      description: "Globally unique Cognito Hosted UI domain prefix for the AWS demo.",
      type: "String",
    });

    const userPool = new cognito.UserPool(this, "WorkOpsUserPool", {
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: false,
      mfa: cognito.Mfa.OFF,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      userPoolName: "workops-portfolio-users",
    });

    const userPoolClient = userPool.addClient("WorkOpsWebClient", {
      accessTokenValidity: cdk.Duration.minutes(60),
      authFlows: {
        userSrp: true,
      },
      generateSecret: false,
      idTokenValidity: cdk.Duration.minutes(60),
      oAuth: {
        callbackUrls: ["http://localhost:3000/"],
        flows: {
          authorizationCodeGrant: true,
        },
        logoutUrls: ["http://localhost:3000/"],
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(5),
      userPoolClientName: "workops-portfolio-web",
    });

    const userPoolDomain = userPool.addDomain("WorkOpsUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: cognitoDomainPrefix.valueAsString,
      },
    });

    const apiLogGroup = new logs.LogGroup(this, "WorkOpsApiLogGroup", {
      logGroupName: "/aws/lambda/workops-portfolio-api",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const apiFunction = new nodejs.NodejsFunction(this, "WorkOpsApiFunction", {
      architecture: lambda.Architecture.ARM_64,
      bundling: {
        format: nodejs.OutputFormat.CJS,
        target: "node20",
      },
      depsLockFilePath: path.join(__dirname, "..", "..", "pnpm-lock.yaml"),
      entry: path.join(__dirname, "..", "..", "apps", "api", "src", "lambda", "handler.ts"),
      environment: {
        AUTH_MODE: "cognito",
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        DATABASE_URL: databaseUrl.valueAsString,
      },
      functionName: "workops-portfolio-api",
      handler: "handler",
      logGroup: apiLogGroup,
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
    });

    const httpApi = new apigatewayv2.HttpApi(this, "WorkOpsHttpApi", {
      apiName: "workops-portfolio-api",
      corsPreflight: {
        allowHeaders: ["authorization", "content-type", "x-dev-user-email"],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["http://localhost:3000"],
      },
    });

    const apiIntegration = new integrations.HttpLambdaIntegration(
      "WorkOpsApiIntegration",
      apiFunction,
    );

    httpApi.addRoutes({
      integration: apiIntegration,
      methods: [apigatewayv2.HttpMethod.ANY],
      path: "/{proxy+}",
    });

    httpApi.addRoutes({
      integration: apiIntegration,
      methods: [apigatewayv2.HttpMethod.ANY],
      path: "/",
    });

    new cdk.CfnOutput(this, "CostAssumption", {
      value: "Free tier first. Short demo operation should stay around a few hundred JPY.",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, "CognitoHostedUiBaseUrl", {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: httpApi.apiEndpoint,
    });

    new cdk.CfnOutput(this, "ApiFunctionName", {
      value: apiFunction.functionName,
    });
  }
}
