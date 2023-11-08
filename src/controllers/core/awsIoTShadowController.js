/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 * Provides interface and remote config management from the AWS IoT Shadow service. 
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const topics = require("../../configs/pubsubTopics");
const { iotShadowControllerRoutes } = require("../../routes/pubsubControlRoutes");
const { defaultShadowConfig } = require("../../configs/shadowConfigDefault");

// Initialize a null reported state and empty desired state. 
let desiredState = {};
let reportedState = {};
let isShadowInitilized;

/**
 * Clears any persistent shadow reported state, then requests the AWS IoT Shadow configuration from 
 * AWS IoT Core. The response triggers a workflow to create / initialise the default shadow config
 * and / or read the existing requested config and apply to the component controllers. 
 */
async function initIoTShadowConfig() {

  console.log("\n[INFO] Initializing AWS IoT Shadow Config....");

  //Prevents processing shadow updates during the initialization procedure. 
  isShadowInitilized = false;

  // Publish null reported state to clear any persistent configs.
  // This will also create a empty shadow document if it doesn't exist.
  console.log("\n[INFO] Clearing any persistent shadow reported state.");
  let shadowUpdate = {};
  shadowUpdate.state = {};
  shadowUpdate.state.reported = null;
  await publishRawMessage(topics.configShadowUpdate, shadowUpdate);

  // Publish Shadow Get Request, the response triggers the shadow initialization workflow.
  await publishRawMessage(topics.configShadowGet, {});
}

/**
 * PubSub message router for the shadow controller. 
 * @param {*} topic 
 * @param {*} payload 
 */
async function shadowControllerMessageRouter(topic, payload) {

  try {

    switch (topic) {

      case topics.configShadowGetAccepted:
        await getShadowAccepted(payload);
        break;

      case topics.configShadowUpdateDelta:
        await shadowDelta(payload);
        break;

      case topics.configShadowGetRejected:
        await getShadowRejected(payload);
        break;

      default:
        console.log(`[INFO] Received unmanaged IoT shadow Message on Topic: ${topic} - Message:`);
        console.log(payload);
    }

  } catch (err) {
    publishErrorResponse(iotShadowControllerRoutes.errorRoute, err);
  }
}

/**
 * Processes a get Shadow accepted request by extracting the desired state and forwarding to updateShadowConfig()
 * as the state to apply. Is used in the initial component initialization but can force a shadow config refresh 
 * by want externally generated Shadow Get request to this components config shadow. 
 * 
 * @param {*} payload 
 * @returns 
 */
async function getShadowAccepted(payload) {

  console.log("[INFO] Processing AWS IoT shadow GET Accepted response. ");

  // If no desired state found during initilisation then create the default shadow, otherwise is an error state. 
  if (!(payload.state && payload.state.desired)) {

    if (!isShadowInitilized) {
      await createDefaultShadow();
      return;
    } else {
      throw new Error("Config Shadow GET Accepted missing or empty desired state");
    }
  }

  // If received a Get Shadow Accepts with a desired state attached is end of this initialization workflow process.
  isShadowInitilized = true;

  // Update the shadow config with received desired state. 
  await updateShadowConfig(payload.state.desired);
}

async function shadowDelta(payload) {

  // Ignore shadow delta updates untill completed initilizing the shadow doc.
  if (!isShadowInitilized) return;

  if (!payload.state) throw new Error("Config Shadow DELTA missing payload state node");

  console.log("\n[INFO] Received AWS IoT config shadow Delta Update:");
  console.log(payload.state);

  await updateShadowConfig(payload.state);
}

async function getShadowRejected(payload) {

  console.log("[INFO] Processing AWS IoT config shadow GET Rejected response.");

  // If requested shadow not found then create with default values, otherwise just notify the GET reject message. 
  if (payload.code === 404) {
    await createDefaultShadow();
  } else {
    publishErrorResponse(iotShadowControllerRoutes.errorRoute, { "action": "get-shadow-config-rejected", "payload": payload });
  }
}

/**
 * Create a default shadow document with desired state from the default Shadow template.
 * Creating a desired state will trigger a shadow updated responds that will be processed as normal. 
 */
async function createDefaultShadow() {

  try {

    console.log("[INFO] Updating Default Shadow from template. ");

    // Set desired and reported state to a deep copy of the default config.
    deepMergeObject(desiredState, {...defaultShadowConfig});
    deepMergeObject(reportedState, {...defaultShadowConfig});

    // Publish the Shadow update to AWS IoT Shadow Service
    let shadowUpdate = {};
    shadowUpdate.state = {};
    shadowUpdate.state.desired = desiredState;
    shadowUpdate.state.reported = reportedState;
    await publishRawMessage(topics.configShadowUpdate, shadowUpdate);

    let message = {};
    message.action = "created-default-shadow-config";
    message.shadow = topics.configShadowName;
    message.shadowUpdate = shadowUpdate;
    await publishFormattedMessage(iotShadowControllerRoutes.actionRoute, message);

    // This is the end of this shadow initialization workflow where needed to create a default config.
    isShadowInitilized = true;

  } catch (err) {
    publishErrorResponse(iotShadowControllerRoutes.errorRoute, err);
  }
}

async function updateShadowConfig(deltaConfig) {

  try {

    // Create a merged config candidate with new delta confg and existing reportedState 
    // with precedent of new delta overwriting any existing reported state 
    
    let configCandidate = {};
    deepMergeObject(configCandidate, {...reportedState});
    deepMergeObject(configCandidate, {...deltaConfig});
    
    // Delete any unsupported keys provided by user in configCandidate
    deleteUnsupportedConfigKeys(defaultShadowConfig, configCandidate);

    // Get / log the desiredStateCandidate.
    console.log("\n[INFO] Applying AWS IoT Shadow Configuration Candidate:");
    console.log(configCandidate);

    // Don't process default config updates as is just a template for users. 
    if (deepEqual(configCandidate, defaultShadowConfig)) {
      console.log("[INFO] Default config found in requested update, returning without publishing change.");
      return;
    }

    // Don't process configCandidate if doesn't change reported state to avoid update loop.
    if (deepEqual(configCandidate, reportedState)) {
      console.log("[INFO] Calculated Configuration candidate will not result in any changes, returning without processing update.");
      return;
    }

    // Apply config - will validate all fields in configCandidate and throw error before updating reported if fail. 

    // Get OSI Pi credentials stored in AWS Secrets Manager
    const region = configCandidate.region;
    const awsSeceretsManagerConfig = configCandidate.awsSeceretsManagerConfig;
    const piSecrets = await getPiSecrets(region, awsSeceretsManagerConfig);

    // Update PiWebSdk Config
    const osiPiServerConfig = configCandidate.osiPiServerConfig;
    piWebSdkUpdateConfig(piSecrets, osiPiServerConfig);

    // Update Sitewise Publisher Config
    const awsSitewisePublisherConfig = configCandidate.awsSitewisePublisherConfig;
    sitewisePublisherUpdateConfig(region, awsSitewisePublisherConfig);

    // Update OSI Pi WebSocket Manager Config 
    const osiPiWebSocketManagerConfig = configCandidate.osiPiWebSocketManagerConfig;
    webSocketManagerUpdateConfig(piSecrets, osiPiServerConfig, osiPiWebSocketManagerConfig, onWebsocketMessage, onWebsocketChangedState);

    // Update System Telemetry Config
    const systemTelemetryConfig = configCandidate.systemTelemetryConfig;
    setTelemetryUpdateInterval(systemTelemetryConfig);

    console.log("[INFO] Applying AWS IoT Shadow Update Desired State Candidate - COMPLETE");

    // If configCandidate all applied successfully then update to reportedState and publish to AWS IoT Shadow service. 
    console.log("\n[INFO] Updating and publishing applied reported Shadow state.");
    reportedState = configCandidate;

    // Publish the reported state applied to AWS IoT Shadow Service
    let shadowUpdate = {};
    shadowUpdate.state = {};
    shadowUpdate.state.reported = reportedState;

    // Publish the Shadow update to shadow update topic. 
    await publishRawMessage(topics.configShadowUpdate, shadowUpdate);

    // Publish the update to the control topic
    let message = {};
    message.action = "applied-shadow-config-success";
    message.shadow = topics.configShadowName;
    message.shadowUpdate = shadowUpdate;
    await publishFormattedMessage(iotShadowControllerRoutes.actionRoute, message);

  } catch (err) {

    // Publish the error to the control topic.
    publishErrorResponse(iotShadowControllerRoutes.errorRoute, err);
  }
}

// Shadow object merge / comparison Helpers.

function deepEqual(object1, object2) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    const val1 = object1[key];
    const val2 = object2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (
      areObjects && !deepEqual(val1, val2) ||
      !areObjects && val1 !== val2
    ) {
      return false;
    }
  }

  return true;
}

function deepMergeObject(target = {}, source = {}) {

  // Iterating through all the keys of source object
  Object.keys(source).forEach((key) => {

    if (isObjectNotArray(source[key])) {

      // If source  property has nested object, call the function recursively.
      if (!target[key]) target[key] = {};
      deepMergeObject(target[key], { ...source[key] });

    } else if (isObjectIsArray(source[key])) {

      // If source property has nested object, call the function recursively.
      target[key] = [...source[key]];

    } else {
      // else merge the object source to target
      target[key] = source[key];
    }
  });

}

function deleteUnsupportedConfigKeys({ ...referenceObject }, compareObject) {

  for (const testKey of Object.keys(compareObject)) {

    if (testKey in referenceObject) {

      // If the referenceObject value is a nested object then recurse this function. 
      if (isObjectNotArray(referenceObject[testKey])) {
        deleteUnsupportedConfigKeys(referenceObject[testKey], compareObject[testKey]);
      }

    } else {
      // If compare key not in referenceObject then delete from compareObject.
      delete compareObject[testKey];
    }
  }
}

function isObject(object) {
  return object != null && typeof object === "object";
}

function isObjectNotArray(item) {
  return (item && typeof item === "object" && !Array.isArray(item));
}

function isObjectIsArray(item) {
  return (item && typeof item === "object" && Array.isArray(item));
}

module.exports = {
  initIoTShadowConfig,
  shadowControllerMessageRouter
};

// No easy way to remove circular dependencies between PubSub Tx and Rx consumers on the 
// same Greengrass client so add require statements after all exports completed.
const { publishRawMessage, publishFormattedMessage, publishErrorResponse } = require("./awsPubsubController");
const { onWebsocketMessage, onWebsocketChangedState } = require("../functions/osiPiStreamingDataController");
const { setTelemetryUpdateInterval } = require("./systemTelemetryController");

const { getPiSecrets } = require("../../osi-pi-sdk/awsSecretsManager");
const { piWebSdkUpdateConfig } = require("../../osi-pi-sdk/piWebSdk");
const { sitewisePublisherUpdateConfig } = require("../../osi-pi-sdk/awsSitewisePublisher");
const { webSocketManagerUpdateConfig } = require("../../osi-pi-sdk/piWebSocketManager");
