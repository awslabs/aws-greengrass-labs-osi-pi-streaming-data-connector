/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

async function getPiSecrets(region, awsSeceretsManagerConfig) {

  console.log("[INFO] Requesting OSI Pi credentials from AWS Secret Manager....");

  // Validate region
  if (!(typeof region === "string" && region.length >= 9)) {
    throw new Error("'region' not provided or invalid value in AWS IoT Shadow config update");
  }

  // Validate piCredentialsAwsSecretsArn
  const piCredentialsAwsSecretsArn = awsSeceretsManagerConfig.piCredentialsAwsSecretsArn;
  if (!(typeof piCredentialsAwsSecretsArn === "string" && piCredentialsAwsSecretsArn.startsWith("arn"))) {
    throw new Error("'piCredentialsAwsSecretsArn' not provided or invalid value in Secrets Manager config update");
  }

  // Init AWS Secrets manager and get PISecrets credentials. 
  const secretsClient = new SecretsManagerClient({ region: region });
  const secretsCommand = new GetSecretValueCommand({ SecretId: piCredentialsAwsSecretsArn });

  // Below is a hot mess but getting error on Greengrass reload and GG not getting a security token 
  // and so, the first AWS API command (this one) is failing with CredentialsProviderError.
  // Only happens when the device or the Greengrass process is restarted - not when re-deploying the component. 
  let response;
  const maxErrorCnt = 3;
  for (let i = 0; i < maxErrorCnt; i++) {
    try {
      response = await secretsClient.send(secretsCommand);
      // If command doesn't throw an error, then break from the loop
      console.log(`[INFO]: Successfully read Secrets Manager Entry with ARN: ${piCredentialsAwsSecretsArn}`);
      break;

    } catch (err) {
      console.log(`[ERROR]: Error Reading Secret Manager Entry: ${err.toString()}`);
      console.log(`Error count: ${i} - will retry in 3 sec.......`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Check return status was returned after maxErrorCnt tries and status code is 200 OK.
  if (!(response && (response["$metadata"]))) {
    throw new Error(`Failed to access Pi Server Credentials at AWS Secrets Manager ARN ${piCredentialsAwsSecretsArn}`);
  }

  if (response["$metadata"].httpStatusCode !== 200) {
    console.log("[ERROR] Secrets Manager error:");
    console.log(response);
    throw new Error(`Failed to access Pi Server Credentials at AWS Secrets Manager ARN ${piCredentialsAwsSecretsArn}`);
  }

  // Parse piSecrets to Object 
  const piSecrets = JSON.parse(response.SecretString);

  if (!(piSecrets.username && piSecrets.password)) {
    throw new Error(`AWS Secret Manager ARN ${piCredentialsAwsSecretsArn} provided doesn't contain mandatory username and / or password keys.`);
  }

  console.log("[INFO] Requesting OSI Pi credentials from AWS Secret Manager - COMPLETE");

  // If all validations passed then return piSecrets
  return piSecrets;

}

module.exports = {
  getPiSecrets
};
