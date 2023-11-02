/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const topics = require("../../configs/pubsubTopics");
const { osiPiSdkControllerRouteMap, 
  osiPiStreamingDataControllerRouteMap, 
  osiPiPointDataWriterRouteMap 
} = require("../../routes/pubsubFunctionRoutes");
const { pubsubControllerRoutes } = require("../../routes/pubsubControlRoutes");

const { once } = require("events");
const { toUtf8 } = require("@aws-sdk/util-utf8-browser");
const { greengrasscoreipc } = require("aws-iot-device-sdk-v2");

let msgIdCnt = 0;
let greengrassClient;

async function activatePubsubController() {

  console.log("[INFO] Initializing and connecting to Greengrass IPC");

  // Init the Greengrass SDK Client.
  greengrassClient = greengrasscoreipc.createClient();

  // Connect the Greengrass IPC client. 
  await greengrassClient.connect();

  // Init Greengrass PubSub MQTT Subscribed Message Handlers
  for (let topic of topics.pubSubSubscribeTopics) {

    console.log(`[INFO] Subscribing to MQTT PubSub Topic: ${topic}`);
    await greengrassClient.subscribeToIoTCore({
      topicName: topic,
      qos: greengrasscoreipc.model.QOS.AT_LEAST_ONCE

      // On PubSub message callback
    }).on("message", (message) => pubsubMessageRouter(message)).activate();

    console.log(`[INFO] Subscribing to MQTT PubSub Topic: ${topic} - COMPLETE`);
  }

  console.log("[INFO] Initializing and connecting to Greengrass IPC - COMPLETE");
}

//====================================================
// PubSub Message Handlers / Routers and Publishers
//====================================================

function pubsubMessageRouter(rawPayload) {

  try {

    // Validate message payload structure
    if (!(rawPayload.message && rawPayload.message.payload && rawPayload.message.topicName)) {
      throw new Error("PubSub Received invalid message format.");
    }

    // Get the topic
    let topic = rawPayload.message.topicName;

    // Parse the raw payload to JSON.
    const payload = JSON.parse(toUtf8(new Uint8Array(rawPayload.message.payload)));

    // Log the message
    console.log(`[DEBUG]: PubSub Message Received Topic: ${topic} - Payload: `);
    console.log(payload);

    // Route Shadow Topics to Shadow Controller
    if (topic.startsWith(topics.shadowBaseTopic)) {

      shadowControllerMessageRouter(topic, payload);

      // Route Control Ingress topic via the payload route field. 
    } else if (topic === topics.commandIngressTopic || topic === topics.groupAdminIngressTopic) {

      const route = payload.route;
      const params = payload.params;

      // Route OSI PI SDK Messages
      if (osiPiSdkControllerRouteMap.includes(route)) {
        osiPiSdkMessageRouter(route, params);

        // Route OSI PI Streaming Data Controller Messages
      } else if (osiPiStreamingDataControllerRouteMap.includes(route)) {
        osiPiStreamingDataMessageRouter(route, params);

        // Route OSI PI Point Data writer Messages
      } else if (osiPiPointDataWriterRouteMap.includes(route)) {
        osiPiPointWriterMessageRouter(route, params);

      } else {
        throw new Error(`Received PubSub message on unsupported Route: ${route}`);
      }

    } else {
      throw new Error(`Received PubSub message on unsupported topic: ${topic}`);
    }

  } catch (err) {
    publishErrorResponse(pubsubControllerRoutes.errorRoute, err);
  }
}

// Publish message functions 
async function publishRawMessage(topic, pubMsg, logMsg = true) {

  try {

    if (logMsg) {
      console.log(`[DEBUG] PubSub Message Published - topic: ${topic}`);
      console.log(pubMsg);
    }

    let jsonMessage = JSON.stringify(pubMsg);

    await greengrassClient.publishToIoTCore({
      topicName: topic,
      payload: jsonMessage,
      qos: greengrasscoreipc.model.QOS.AT_LEAST_ONCE
    });

  } catch (err) {
    console.log("[ERROR] Publish Raw message failed: Error Message:");
    console.log(err);
  }
}

async function publishFormattedMessage(route, messageObject, status = 200, topic = topics.commandEgressTopic, logMsg = true) {

  try {

    let pubMsg = {
      "id": ++msgIdCnt,
      "route": route,
      "status": status,
      "response": messageObject
    };

    // Set logMsg to log on status error codes or log on request messages to help debugging.
    logMsg = logMsg || status < 200 || status > 299;

    await publishRawMessage(topic, pubMsg, logMsg);

  } catch (err) {
    console.log("[ERROR] Publish Formatted message failed: Error Message:");
    console.log(err);
  }
}

async function publishErrorResponse(route, publishError) {

  try {
    let status = 500;
    // If is a Axios response with status code then assign that to status.
    if (publishError.response && publishError.response.status) {
      status = publishError.response.status;
    }

    const errMessage = typeof publishError === "object" ? publishError.toString() : publishError;

    await publishFormattedMessage(route, errMessage, status);

  } catch (err) {
    console.log("[ERROR] Publish Error Reponses message failed: Error Message:");
    console.log(err);
  }
}

async function awaitConnectionClose() {

  // Wait until the Greengrass connection is killed or dropped, use this to hold up the process.
  await once(greengrassClient, greengrasscoreipc.Client.DISCONNECTION);
}

async function closeConnection() {
  if (greengrassClient) greengrassClient.close();
}

module.exports = {
  activatePubsubController,
  publishRawMessage,
  publishFormattedMessage,
  publishErrorResponse,
  awaitConnectionClose,
  closeConnection
};

// No easy way to remove circular dependencies between PubSub Tx and Rx consumers on the 
// same Greengrass client so add require statements after all exports completed.

const { shadowControllerMessageRouter } = require("./awsIoTShadowController");
const { osiPiSdkMessageRouter } = require("./osiPiSdkController");
const { osiPiPointWriterMessageRouter } = require("../functions/osiPiPointWriter");
const { osiPiStreamingDataMessageRouter } = require("../functions/osiPiStreamingDataController");
