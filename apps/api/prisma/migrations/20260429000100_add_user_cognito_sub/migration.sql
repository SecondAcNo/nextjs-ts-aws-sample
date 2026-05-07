-- Add a nullable Cognito subject for AWS authentication.
-- Local MVP users keep this value null until they are linked to Cognito.
ALTER TABLE "User" ADD COLUMN "cognitoSub" TEXT;

CREATE UNIQUE INDEX "User_cognitoSub_key" ON "User"("cognitoSub");
