/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const defaultShadowConfig = {
  "region": "ap-southeast-2",
  "osiPiServerConfig": {
    "piServerUrl": "",
    "piApiRootPath": "piwebapi",
    "maxPiApiRequestPerSec": 25,
    "maxPiApiQueryResponseItems": 1000,
    "authMode": "basic",
    "verifySsl": 1
  },
  "awsSitewisePublisherConfig": {
    "sitewiseMaxTqvPublishRate": 5000,
    "sitewisePropertyAliasBatchSize": 10,
    "sitewisePropertyValueBatchSize": 10,
    "sitewisePropertyPublishMaxAgeSecs": 300
  },
  "osiPiWebSocketManagerConfig": {
    "maxPiDataPointWebSockets": 5000,
    "maxPiPointsPerWebSocket": 100
  },
  "awsSeceretsManagerConfig": {
    "piCredentialsAwsSecretsArn": ""
  },
  "systemTelemetryConfig": {
    "telemetryUpdateSecs": 10
  }
};

module.exports = {
  defaultShadowConfig
};
