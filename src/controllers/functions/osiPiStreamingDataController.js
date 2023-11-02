/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const v8 = require("node:v8");
const topics = require("../../configs/pubsubTopics");

// OSI Pi: PiPoints search options. 
const searchOptions = {
  "contains": 1,
  "exact-match": 2,
  "starts-with": 3,
  "ends-with": 4,
};

let memoryUsage = 0, dropDataPoints = false;
const memoryUsageDropTrigger = 45, memoryUsageRestartTrigger = 44;

setInterval(memoryMonitor, 20000);

/**
 * Receive and process PubSub MQTT Message Callback
 * 
 * @param {*} payload 
 */
function osiPiStreamingDataMessageRouter(route, params) {

  try {

    if (!(piWebSdk)) {
      throw new Error("OSI Pi SDK Manager not initialized. Ensure AWS IoT Shadow configuration is complete and correct.");
    }

    switch (route) {

      // Publish OSI PiPoint WebSocket Manager Channel Functions. 

      case "publish-channels":
        publishChannels(route, params);
        break;

      case "publish-channel-stats":
        publishChannelStats(route, params);
        break;

      case "publish-channels-by-state":
        publishChannelsByState(route, params);
        break;

      case "publish-channel-by-channel-id":
        publishChannelByChannelId(route, params);
        break;

      case "publish-channel-by-pi-point-webid":
        publishChannelByPiPointWebId(route, params);
        break;

      case "publish-channel-by-pi-point-path":
        publishChannelByPiPointPath(route, params);
        break;

      case "publish-channels-by-pi-point-path-regex":
        publishChannelsByPiPointPathRegEx(route, params);
        break;

      case "publish-all-channel-numbers":
        publishAllChannelNumbers(route, params);
        break;

      case "publish-channel-numbers-by-pi-point-path-regex":
        publishChannelNumbersByPiPointPathRegEx(route, params);
        break;

        // Stream / Queue Pi Points for Streaming Data Functions.

      case "queue-pi-points-for-streaming-by-query":
        queuePiPointsForStreamingByQuery(route, params);
        break;

      case "publish-queued-pi-points":
        publishQueuedPiPoints(route, params);
        break;

      case "publish-number-queued-pi-points":
        publishNumberQueuedPiPoints(route, params);
        break;

      case "clear-queued-pi-points-for-streaming":
        clearQueuedPiPoints(route, params);
        break;

      case "activate-queued-pi-points-for-streaming":
        activateQueuedPiPointsForStreaming(route, params);
        break;

        // Close WebSocket Channels Functions.

      case "close-all-channels":
        closeAllChannels(route, params);
        break;

      case "close-channel-by-channel-id":
        closeChannelByChannelId(route, params);
        break;

      case "close-channel-by-pi-point-webid":
        closeChannelByPiPointWebId(route, params);
        break;

      case "close-channels-by-pi-point-path-regex":
        closeChannelsByPiPointPathRegEx(route, params);
        break;

        // Re/Open WebSocket Channels Functions.

      case "open-channel-by-channel-id":
        openChannelByChannelId(route, params);
        break;

      case "open-all-closed-channels":
        openAllClosedChannels(route, params);
        break;

        // Delete WebSocket Channels Functions.

      case "delete-all-channels":
        deleteAllChannels(route, params);
        break;

      case "delete-channel-by-channel-id":
        deleteChannelByChannelId(route, params);
        break;

      case "delete-channels-by-pi-point-path-regex":
        deleteChannelsByPiPointPathRegEx(route, params);
        break;

      // Delete / Clear Pi Data points from buffer
      case "delete-pi-data-buffer-queue":
        deletePiDataQueue(route, params);
        break;

      default:
        throw new Error(`Unknown message Route received by OSI Pi Streaming Data Controller: ${route}`);
    }

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// WebSocket Manager message and state changed callbacks

function onWebsocketMessage(event) {

  try {
    // If reached memory threshold prevent new data points from being buffered
    // until the queue is cleared back to a usable level. 
    if (dropDataPoints) return;

    const piData = JSON.parse(event.data);
    awsSitewisePublisher.queuePiData(piData);

  } catch (err) {
    console.log("[ERROR]: Parsing or Queuing OSI PI WebSocket Data!");
  }
}

function onWebsocketChangedState(state, channelId, event) {

  try {

    const message = {};
    message.channelId = channelId;
    message.websocketStatus = state;
    message.event = (typeof event == "object") ? JSON.stringify(event) : event;

    const topic = `${topics.piWebsocketStateChangeTopic}/${state}`;
    publishFormattedMessage("web-socket-state-changed", message, 200, topic);

  } catch (err) {
    //Catch (async / callback) errors in processing WebSocket changes
    console.log("[ERROR] WebSocket Status update error. Error:");
    console.log(err);
  }
}

function memoryMonitor() {

  try {

    // Get current memory stats usage.
    const memStats = v8.getHeapStatistics();
    const memoryUsageCandicate = Math.round((memStats.total_heap_size / memStats.heap_size_limit) * 100);

    // Warn on transition from under to over threshold:

    const isOverThreasholdTrigger = (memoryUsageCandicate >= memoryUsageDropTrigger && memoryUsage <= memoryUsageDropTrigger);
    if (isOverThreasholdTrigger) {
      dropDataPoints = true;
      const msg = `[WARN]: Memory utilization ${memoryUsageCandicate}% exceeding threshold - dropping new OSI Pi data points.`;
      publishFormattedMessage("memory-utilisation-event", msg, 199);
    }

    // Notify in transition back below memory threshold
    const isUnderThreasholdTrigger = (memoryUsageCandicate <= memoryUsageRestartTrigger && memoryUsage >= memoryUsageRestartTrigger);
    if (isUnderThreasholdTrigger) {
      dropDataPoints = false;
      const msg = `[INFO]: Memory utilization ${memoryUsageCandicate}% returning below restart data threshold, accepting new OSI Pi data points.`;
      publishFormattedMessage("memory-utilisation-event", msg, 199);
    }

    memoryUsage = memoryUsageCandicate;

  } catch (err) {
    console.log("[ERROR] Error calculating and / or processing memory utilisation management. Error: ");
    console.log(err);
  }
}

// PubSub Managed calls to manage OSI Pi Streaming Data Connector. 
// Publish OSI PiPoint WebSocket Manager Channel Functions. 

async function publishChannels(route) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const channels = piWebSocketManager.getChannels();
    const numChannels = channels.length;

    // Split the channels into groups of 100 to make sure they fit in a single MQTT message
    const pointsPerMessage = 100;
    for (let startIndex = 0; startIndex < numChannels; startIndex += pointsPerMessage) {

      const messagechannels = channels.slice(startIndex, startIndex + pointsPerMessage);

      const message = {};
      message.startIndex = startIndex;
      message.numberChannels = messagechannels.length;

      const channelDetail = [];
      for (const channel of messagechannels) {
        channelDetail.push({
          "channelId": channel.getChannelId(),
          "websocket-status": channel.getWebsocketState(),
          "numPiPoints": channel.getNumberPiPoints()
        });
      }
      message.channels = channelDetail;

      // Publish the current message. 
      await publishFormattedMessage(route, message, 206);
    }

    await publishFormattedMessage(route, { "itemsReturned": channels.length });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelStats(route) {

  try {

    // Create objects to store per channel state and PiPoint counts. 
    const channelStateOptions = ["connecting", "open", "closing", "closed"];
    const channelStatesCount = {}, channelPiPointsCount = {};

    // initialize the WebSocket State and Channel PiPoint Counts to zero
    for (let channelState of channelStateOptions) {
      channelStatesCount[channelState] = 0;
      channelPiPointsCount[channelState] = 0;
    }

    // Get list of all available channels on system and add totals counts/
    const channels = piWebSocketManager.getChannels();
    const totalChannels = channels.length;
    let totalPiPoints = 0;

    // Iterate and allocate channels by state. 
    for (const channel of channels) {

      const channelState = channel.getWebsocketState();
      const numChannelPiPoints = channel.getNumberPiPoints();

      // Add counts to per channel / points stats states
      channelStatesCount[channelState]++;
      channelPiPointsCount[channelState] += numChannelPiPoints;

      // Add counts to total PiPoints
      totalPiPoints += numChannelPiPoints;
    }

    // Return stats message. 
    const message = {};
    message.channelStatesCount = channelStatesCount;
    message.channelPiPointsCount = channelPiPointsCount;
    message.totalChannels = totalChannels;
    message.totalPiPoints = totalPiPoints;

    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelsByState(route, params) {

  try {

    const websocketState = params.websocketState;
    if (!websocketState) throw new Error("Must include websocketState value in params.");

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const channels = piWebSocketManager.getChannelByWebsocketState(websocketState);
    const numChannels = channels.length;

    // Split the channels into groups of 100 to make sure they fit in a single MQTT message
    const pointsPerMessage = 100;
    for (let startIndex = 0; startIndex < numChannels; startIndex += pointsPerMessage) {

      const messagechannels = channels.slice(startIndex, startIndex + pointsPerMessage);

      const message = {};
      message.startIndex = startIndex;
      message.numberChannels = messagechannels.length;

      const channelDetail = [];
      for (const channel of messagechannels) {
        channelDetail.push({
          "channelId": channel.getChannelId(),
          "websocket-status": channel.getWebsocketState(),
          "numPiPoints": channel.getNumberPiPoints()
        });
      }
      message.channels = channelDetail;

      // Publish the current message. 
      await publishFormattedMessage(route, message, 206);
    }

    await publishFormattedMessage(route, { "itemsReturned": channels.length });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelByChannelId(route, params) {

  try {

    const channelId = params.channelId;
    if (!channelId) throw new Error("Must include channelId value in params.");

    // Returns channel object or throws and error if doesn't exist.
    const channel = piWebSocketManager.getChannelByChannelId(channelId);

    const message = {};
    message.channelid = channelId;
    message.channel = channel;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelByPiPointWebId(route, params) {

  try {

    const piPointWebId = params.piPointWebId;
    if (!piPointWebId) throw new Error("Must include piPointWebId value in params.");

    const channel = piWebSocketManager.getChannelByPiPointWebId(piPointWebId);

    if (!channel) {
      throw new Error(`PiPoint WebId: ${piPointWebId} isn't registered in a streaming channel session`);
    }

    const message = {};
    message.webid = piPointWebId;
    message.channel = channel;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelByPiPointPath(route, params) {

  try {

    const piPointPath = params.piPointPath;
    if (!piPointPath) throw new Error("Must include piPointPath value in params.");

    const channel = piWebSocketManager.getChannelByPiPointPath(piPointPath);

    if (!channel) {
      throw new Error(`PiPoint Path: ${piPointPath} isn't registered in a streaming channel session`);
    }

    const message = {};
    message.channel = channel;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelsByPiPointPathRegEx(route, params) {

  try {

    const piPointPathRegex = params.piPointPathRegex;
    if (!piPointPathRegex) throw new Error("Must include piPointPathRegex value in params.");

    const channels = piWebSocketManager.getChannelsByPiPointPathRegex(piPointPathRegex);
    const response = [];
    let totalNumPiPoints = 0;

    // Return a simplified channel object without the full list of attached PiPoints for brevity.
    for (const channel of channels) {

      totalNumPiPoints += channel.getNumberPiPoints();

      response.push({
        "channelId": channel.getChannelId(),
        "websocket-status": channel.getWebsocketState(),
        "numPiPoints": channel.getNumberPiPoints()
      });
    }

    const message = {};
    message.piPointPathRegex = piPointPathRegex;
    message.numChannels = channels.length;
    message.totalNumPiPoints = totalNumPiPoints;
    message.channels = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishChannelNumbersByPiPointPathRegEx(route, params) {

  try {

    const piPointPathRegex = params.piPointPathRegex;
    if (!piPointPathRegex) throw new Error("Must include piPointPathRegex value in params.");

    const channelNumbers = piWebSocketManager.getChannelNumbersByPiPointPathRegex(piPointPathRegex);

    const message = {};
    message.channelNumbers = channelNumbers;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishAllChannelNumbers(route) {

  try {
    // Set Regex to all for publish all Channel numbers
    const piPointPathRegex = "/*";

    const channelNumbers = piWebSocketManager.getChannelNumbersByPiPointPathRegex(piPointPathRegex);

    const message = {};
    message.channelNumbers = channelNumbers;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// Stream / Queue Pi Points for Streaming Data Functions.
async function queuePiPointsForStreamingByQuery(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piPoints = [];
    const dataServerWebId = params.dataServerWebId;
    const queryString = params.queryString;
    const searchOption = params.searchOption;

    if (!dataServerWebId) throw new Error("Must include dataServerWebId value, list all data servers via publish-pi-data-servers route");
    if (!queryString) throw new Error("Must include a queryString. For example: Enter 'tag:=*' to return all values (use cautiously and at your own risk!)");

    // Get the optional Pi searchOption val and convert to required in val. Set default 1 (search value 'contains' queryString)
    const searchOptionVal = searchOptions[searchOption] || 1;

    do {

      // Get this iteration of matching piPoints from current startIndex to maxItemCount
      piPoints = await piWebSdk.getPiPointsByQuery(dataServerWebId, queryString, searchOptionVal, startIndex);

      // Don't send last message after startIndex with zero return values. 
      if (piPoints.length === 0) break;

      // Queue the PiPoint WebId to have a WebSocket opened to start receiving streaming data from Pi Server. 
      for (const piPoint of piPoints) {
        piWebSocketManager.queueStreamPiPointRequest(piPoint);
      }

      // Publish this iteration of Queued PiPoints to PubSub 
      const message = {};
      message.startIndex = startIndex;
      message.numberPiPointsQueued = piPoints.length;
      message.totalPiPointsQueued = piWebSocketManager.getNumberQueuedPiPoints();

      // Publish the 206 partial response update messages. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piPoints.length;

    } while (piPoints.length > 0);

    // Publish the final tallies for queued PiPoints
    const message = {};
    message.queryString = queryString;
    message.searchOption = Object.keys(searchOptions).find(key => searchOptions[key] === searchOptionVal);
    message.piPointsQueued = startIndex;
    message.totalPiPointsQueued = piWebSocketManager.getNumberQueuedPiPoints();
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function clearQueuedPiPoints(route) {
  try {
    const response = piWebSocketManager.clearQueueStreamPiPointRequest();
    await publishFormattedMessage(route, response, 200);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

/**
*  Get list of Queued PiPoints waiting to be processed and publish result.
* 
* @param {'*'} route 
*/
async function publishQueuedPiPoints(route) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    const queuedPiPoints = piWebSocketManager.getQueuedPiPoints();
    const numPiPoints = queuedPiPoints.length;

    const pointsPerMessage = 250;

    for (let startIndex = 0; startIndex < numPiPoints; startIndex += pointsPerMessage) {

      const messagePoints = queuedPiPoints.slice(startIndex, startIndex + pointsPerMessage);

      const message = {};
      message.startIndex = startIndex;
      message.numberQueuedPiPoints = messagePoints.length;
      message.queuedPiPoints = messagePoints;
      await publishFormattedMessage(route, message, 206);
    }

    await publishFormattedMessage(route, { "itemsReturned": numPiPoints });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishNumberQueuedPiPoints(route) {

  try {

    const totalPiPointsQueued = piWebSocketManager.getNumberQueuedPiPoints();

    const message = {};
    message.totalPiPointsQueued = totalPiPointsQueued;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function activateQueuedPiPointsForStreaming(route) {
  try {

    await publishFormattedMessage(route, "request-ack-processing - Monitor WebSocket state change messages for connections status updates", 202);
    const msg = await piWebSocketManager.activateQueuedPiPointsForStreaming();
    await publishFormattedMessage(route, msg, 200);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// Close WebSocket Channels Functions.

async function closeAllChannels(route) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const response = piWebSocketManager.closeAllChannels();

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function closeChannelByChannelId(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const channelId = params.channelId;
    if (!channelId) throw new Error("Must include channelId value in params.");

    // Closes Channel Id (or throws Error if doesn't exist.)
    const response = piWebSocketManager.closeChannelByChannelId(channelId);

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function closeChannelByPiPointWebId(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const piPointWebId = params.piPointWebId;
    if (!piPointWebId) throw new Error("Must include piPointWebId value in params.");

    const channel = piWebSocketManager.getChannelByPiPointWebId(piPointWebId);

    if (!channel) {
      throw new Error(`PiPoint WebId: ${piPointWebId} isn't registered in a streaming channel session`);
    }

    // Closes Channel Id
    const response = piWebSocketManager.closeChannelByChannelId(channel.getChannelId());

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function closeChannelsByPiPointPathRegEx(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const piPointPathRegex = params.piPointPathRegex;
    if (!piPointPathRegex) throw new Error("Must include piPointPathRegex value in params.");

    const response = piWebSocketManager.closeChannelsByPiPointPathRegEx(piPointPathRegex);

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// Open WebSocket Channels Functions.

async function openChannelByChannelId(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const channelId = params.channelId;
    if (!channelId) throw new Error("Must include channelId value in params.");

    // Opens Channel WebSocket
    const response = await piWebSocketManager.openChannelByChannelId(channelId);

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function openAllClosedChannels(route) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    // Opens all Channel WebSockets currently in closed state
    const response = await piWebSocketManager.openAllClosedChannels();

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// Delete WebSocket Channels Functions.

async function deleteAllChannels(route) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const response = piWebSocketManager.deleteAllChannels();

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function deleteChannelByChannelId(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const channelId = params.channelId;
    if (!channelId) throw new Error("Must include channelId value in params.");

    // Closes Channel Id (or throws Error if doesn't exist.)
    const response = piWebSocketManager.deleteChannelByChannelId(channelId);

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function deleteChannelsByPiPointPathRegEx(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const piPointPathRegex = params.piPointPathRegex;
    if (!piPointPathRegex) throw new Error("Must include piPointPathRegex value in params.");

    const response = piWebSocketManager.deleteChannelsByPiPointPathRegEx(piPointPathRegex);

    const message = {};
    message.response = response;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// Clear / Delete Sitewise Publish Buffer

async function deletePiDataQueue(route, params) {

  try {

    await publishFormattedMessage(route, "request-ack-processing", 202);

    const deletePercentQueue = params.deletePercentQueue;
    if (isNaN(deletePercentQueue) || deletePercentQueue < 1 || deletePercentQueue > 100) {
      throw new Error("'deletePercentQueue' missing from params or invalid value received. (int: 1 - 100)");
    }

    awsSitewisePublisher.deletePiDataQueue(deletePercentQueue);

    const message = {};
    message.deletePercentQueue = deletePercentQueue;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

module.exports = {
  osiPiStreamingDataMessageRouter,
  onWebsocketMessage,
  onWebsocketChangedState,
};

// No easy way to remove circular dependencies between PubSub Tx and Rx consumers on the 
// same Greengrass client so add require statements after all exports completed.
const { publishFormattedMessage, publishErrorResponse } = require("../core/awsPubsubController");
const piWebSocketManager = require("../../osi-pi-sdk/piWebSocketManager");
const awsSitewisePublisher = require("../../osi-pi-sdk/awsSitewisePublisher");
const piWebSdk = require("../../osi-pi-sdk/piWebSdk");
