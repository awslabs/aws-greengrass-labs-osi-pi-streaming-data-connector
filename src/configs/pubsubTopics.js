/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const { componentShortName } = require("../configs/componentName");

const iotThingName = process.env.AWS_IOT_THING_NAME;

// PubSub MQTT Control Topics. 
const commandEgressTopic = `osi-pi/${componentShortName}/${iotThingName}/egress`;
const commandIngressTopic = `osi-pi/${componentShortName}/${iotThingName}/ingress`;

// All component group admin ingress topic. 
const groupAdminIngressTopic = `osi-pi/${componentShortName}/ingress`;

// Async control / telemetry update topics.
const piWebsocketStateChangeTopic = `osi-pi/${componentShortName}/${iotThingName}/websocket-state`;
const telemetryUpdateTopic = `osi-pi/${componentShortName}/${iotThingName}/telemetry`;

// PubSub Config Shadow Subscribe Topics
const configShadowName = `osi-pi-${componentShortName}-config`;
const shadowBaseTopic = `$aws/things/${iotThingName}/shadow`;
const configShadow = `${shadowBaseTopic}/name/${configShadowName}`;

const configShadowGet = `${configShadow}/get`;
const configShadowGetAccepted = `${configShadowGet}/accepted`;
const configShadowGetRejected = `${configShadowGet}/rejected`;

const configShadowUpdate =  `${configShadow}/update`;
const configShadowUpdateAccepted = `${configShadowUpdate}/accepted`;
const configShadowUpdateDelta = `${configShadowUpdate}/delta`;

// Group the PubSub subscribe topics. 
const pubSubSubscribeTopics = [
  commandIngressTopic,
  groupAdminIngressTopic,
  configShadowGetAccepted,
  configShadowGetRejected,
  configShadowUpdateDelta
];

module.exports = {
  commandIngressTopic,
  groupAdminIngressTopic,
  commandEgressTopic,
  piWebsocketStateChangeTopic,
  telemetryUpdateTopic,
  shadowBaseTopic,
  configShadowName,
  configShadowUpdate,
  configShadowGet,
  configShadowGetAccepted,
  configShadowGetRejected,
  configShadowUpdateAccepted,
  configShadowUpdateDelta,
  pubSubSubscribeTopics
};
