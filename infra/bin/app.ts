#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { WorkOpsStack } from "../lib/workops-stack";

const app = new cdk.App();

new WorkOpsStack(app, "WorkOpsPortfolioStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
});
