/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

/**
 * Receive and process PubSub MQTT Message Callback
 * 
 * @param {*} payload 
 */
function osiPiPointWriterMessageRouter(route, params) {

  try {

    if (!(piWebSdk)) {
      throw new Error("OSI Pi SDK Manager not initialized. Ensure AWS IoT Shadow configuration is complete and correct.");
    }

    switch (route) {

      // Publish OSI PiPoint Data-Writer Functions. 

      case "create-pi-point":
        createPiPoint(route, params);
        break;

      case "write-pi-point":
        writePiPoint(route, params);
        break;

      default:
        throw new Error(`Unknown message Route received by OSI Pi Point Data Writer: ${route}`);
    }

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// PubSub Managed calls to manage OSI Pi Streaming Data Connector. 
// Create / Update Pi data points functions. 

async function createPiPoint(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    // Mandatory params. PiSDK will error if not provoded valid value.
    const dataServerWebId = params.dataServerWebId;
    const piPointName = params.piPointName;

    // Optional params - PiSDK will provode defaut values shown if not provided
    const pointDescription = params.pointDescription;   // Default: ""
    const pointClass = params.pointClass;               // Default: "classic"
    const pointType = params.pointType;                 // Default: "Float32"
    const engineeringUnits = params.engineeringUnits;   // Default: ""

    // Get response to write PiPoint request
    const response = await piWebSdk.createPiPoint(dataServerWebId, piPointName, pointDescription, pointClass, pointType, engineeringUnits);

    // Publish response - Axios API call will throw an error if not a 2xx response. 
    await publishFormattedMessage(route, {"status" : response.status, "respnse" : response.data });

  } catch (err) {

    console.log;
    publishErrorResponse(route, err);
  }
}

async function writePiPoint(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    // Mandatory params. PiSDK will error if not provided valid value.
    const webid = params.webid;
    const timestamp = params.timestamp;
    const piPointValue = params.piPointValue;

    console.log(`##### [DEBUG] piPointValue: ${piPointValue}`);

    // Optional params - PiSDK will provode defaut values shown if not provided
    const unitsAbrev = params.unitsAbrev;                       // Default: ""
    const goodQuality = params.goodQuality;                     // Default: true
    const questionableQuality = params.questionableQuality;     // Default: false

    // Get response to write PiPoint request
    const response = await piWebSdk.writePiPoint(webid, timestamp, piPointValue, unitsAbrev, goodQuality, questionableQuality);

    // Publish response - Axios API call will throw an error if not a 2xx response. 
    await publishFormattedMessage(route, {"status" : response.status, "respnse" : response.data });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

module.exports = {
  osiPiPointWriterMessageRouter,
  createPiPoint,
  writePiPoint
};

// No easy way to remove circular dependencies between PubSub Tx and Rx consumers on the 
// same Greengrass client so add require statements after all exports completed.
const { publishFormattedMessage, publishErrorResponse } = require("../core/awsPubsubController");
const piWebSdk = require("../../osi-pi-sdk/piWebSdk");
