/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 * 
 * Creates and maintains WebSocket connections to the OSI Pi server.
 * 
 * Each WebSocket is allocated a number of OSI PI data points (PiPoints) that will be 
 * streamed (on-change data) over the connection. OSI Pi refer to this as a StreamSet:
 * https://docs.aveva.com/bundle/pi-web-api-reference/page/help/controllers/streamset.html
 * 
 * Here, we call a WebSocket with associated PiPoinst a 'Channel' Each channel described 
 * maintains the WebSocket Object as a reference to the associated PiPoints. 
 * 
 * 
 */

const WebSocket = require("ws");
const PiWebSocketChannel = require("./pi-objects/piWebsocketChannel");

let wssRootUrl, verifySsl;
let maxPiDataPointWebSockets, maxPiPointsPerWebSocket;
let onWebsocketMessage, onWebsocketChangedState;

// Pi Data Point stream request queue.
let queuedPiPointRequests = [];

// OSI Pi Websocket / PiPoint channel map. 
let websocketChannelMap = new Map();

const websocketReadyStateMap = {
  "connecting": 0,
  "open": 1,
  "closing": 2,
  "closed": 3
};

/**
 * Updates the config parameters for the class.
 * If piSecrets, piServerURL, piApiRootPath or verifySsl are changed then any queuedPiPointRequests and websocketChannelMap are flushed
 * and any open connector is gracefully closed.
 * 
 */
function webSocketManagerUpdateConfig(piSecrets, osiPiServerConfig, osiPiWebSocketManagerConfig, onWebsocketMessageCb, onWebsocketChangedStateCb) {

  console.log("[INFO] Updating OSI Pi WebSocket Client Manager Configuration....");

  // Basic validation of piSecrets
  if (!(piSecrets && piSecrets.username && piSecrets.password)) {
    throw new Error("AWS Secret provided is missing, invalid or doesn't contain username and / or password keys.");
  }

  // Validate piServerUrl 
  const piServerUrl = osiPiServerConfig.piServerUrl;
  if (!(typeof piServerUrl === "string" && piServerUrl.length > 3)) {
    throw new Error("'piServerUrl' not provided or invalid value in WebSockets Manager config update.");
  }

  // Validate piApiRootPath
  const piApiRootPath = osiPiServerConfig.piApiRootPath;
  if (!(typeof piApiRootPath === "string" && piApiRootPath.length > 0)) {
    throw new Error("'piApiRootPath' not provided or invalid value in WebSockets Manager config update.");
  }

  // Validate verifySsl
  const verifySslCandidate = osiPiServerConfig.verifySsl;
  if (isNaN(verifySslCandidate) || verifySslCandidate < 0 || verifySslCandidate > 1) {
    throw new Error("'verifySsl' not provided or invalid value in WebSockets Manager config update (int: 0 or 1)");
  }

  // Validate maxPiDataPointWebSockets - update to reportedCandidate if no errors.
  const maxPiDataPointWebSocketsCandidate = osiPiWebSocketManagerConfig.maxPiDataPointWebSockets;
  if (isNaN(maxPiDataPointWebSocketsCandidate) || maxPiDataPointWebSocketsCandidate < 1 || maxPiDataPointWebSocketsCandidate > 10000) {
    throw new Error("'maxPiDataPointWebSockets' not provided or invalid value (int: 1 - 10000)");
  }

  // Validate maxPiPointsPerWebSocket - update to reportedCandidate if no errors.
  const maxPiPointsPerWebSocketCandidate = osiPiWebSocketManagerConfig.maxPiPointsPerWebSocket;
  if (isNaN(maxPiPointsPerWebSocketCandidate) || maxPiPointsPerWebSocketCandidate < 1 || maxPiPointsPerWebSocketCandidate > 100) {
    throw new Error("'maxPiPointsPerWebSocket' not provided or invalid value (int: 1 - 100)");
  }

  // Validate onWebsocketMessage callback is a function.
  if (typeof onWebsocketMessageCb !== "function") {
    throw new Error("'onWebsocketMessage' callback not provided or not a function");
  }

  // Validate onWebsocketChangedState callback is a function.
  if (typeof onWebsocketChangedStateCb !== "function") {
    throw new Error("'onWebsocketChangedState' callback not provided or not a function");
  }

  // If all validations passed:

  // Calculate the WSS URL based on passed parameters. 
  let calculatedWssRootUrl = `wss://${piSecrets.username}:${piSecrets.password}@${piServerUrl}/${piApiRootPath}`;

  // If WSS params changed (i.e: wssRootUrl (including username, password, piServerUrl or piApiRootPath) or verifySsl), then clear all current connections. 
  if (calculatedWssRootUrl !== wssRootUrl || verifySsl !== verifySslCandidate) {

    // reset queuedPiPointRequests
    queuedPiPointRequests = [];

    // Delete any existing WebSocket / channels
    deleteAllChannels();

    // Reset websocketChannelMap
    websocketChannelMap.clear;
  }

  // Update local state params:

  // URL parameters 
  wssRootUrl = calculatedWssRootUrl;
  verifySsl = verifySslCandidate;

  // URL parameters 
  maxPiDataPointWebSockets = maxPiDataPointWebSocketsCandidate;
  maxPiPointsPerWebSocket = maxPiPointsPerWebSocketCandidate;

  // Message callbacks
  onWebsocketChangedState = onWebsocketChangedStateCb;
  onWebsocketMessage = onWebsocketMessageCb;

  console.log("[INFO] Updating OSI Pi WebSocket Client Manager Configuration - COMPLETE");
}

//====================================
// PiPoint user requests queuing / processor

function queueStreamPiPointRequest(piPoint) {

  const piPointWebId = piPoint.getWebId();
  const piPointName = piPoint.getName();
  const piPointPath = piPoint.getPath();

  // Input validation
  if (!(piPointWebId && piPointPath)) {
    throw new Error("Must provide valid piPoint object - No PiPoint WebId or Path found.");
  }

  // TODO: Need to also support Asset Framework Element attributes as data points. 
  // TODO: below checks are clunky loops. Need to update.

  // Check PiPoint is not already streaming / requested. Return without re-queuing if it is. 
  if (getChannelByPiPointWebId(piPointWebId)) return;

  // Check PiPoint is not already queued Return without re-queuing if it is. 
  for (const queuedPoint of queuedPiPointRequests) {
    if (queuedPoint.webid === piPointWebId) return;
  }

  // Add to PiPoint request queue for processing. (If already queued will just overwrite).
  queuedPiPointRequests.push({ "webid": piPointWebId, "name": piPointName, "path": piPointPath });
}

function clearQueueStreamPiPointRequest() {

  //Clear any PiPoints queued for streaming but no processed yet.
  const queuedLen = queuedPiPointRequests.length;
  queuedPiPointRequests = [];
  return `${queuedLen} PiPoints cleared from streaming queue`;
}

/**
 * Asynchronously processes the requested PiPoint queue. 
 * Creates a channel with a WebSocket to the OSI server and assigns the next batch of PiPoints to the 
 * channel in a group. Once the WebSocket is open, the associated PiPoints will instantly 
 * begin streaming on-change data. 
 * 
 * @returns 
 */
async function activateQueuedPiPointsForStreaming() {

  // Iterate through queuedPiPointRequests and create the Pi StreamSets Channel WebSocket’s for the requested PiPoints.
  let processedChannels = 0, processedPiPoints = 0;
  while (queuedPiPointRequests.length > 0) {

    // Throws error back to calling function
    if (websocketChannelMap.size >= maxPiDataPointWebSockets) {
      throw new Error("Exceeded max allowed WebSockets, must close existing Channels before opening any more.");
    }

    // Generate random ID for the channel.
    let channelId = "channel-" + Math.random().toString(36).slice(2);

    // Catch Websocket create errors in execution loop and moves to next iteration.
    try {

      // Copy and delete the next batch of PiPoints from the queuedPiPointRequests list.
      let channelGroupPiPoints = queuedPiPointRequests.splice(0, maxPiPointsPerWebSocket);

      // Create the Websocket with the given PiPoints
      let webSocket = await _createWebSocket(channelId, channelGroupPiPoints);

      // If the WebSocket initiates without exception then store the channel in the websocketChannelMap list. 
      websocketChannelMap.set(channelId, { "websocket": webSocket, "piPoints": channelGroupPiPoints });

      processedChannels++;
      processedPiPoints += channelGroupPiPoints.length;

    } catch (err) {
      // This if the WebSocket failed to initiate all together such as when the local OS won't accept any 
      // more TCP connections. The WebSocket won't be added to the initiated list so is effectively deleted from the queue.
      onWebsocketChangedState("failed-deleted", channelId, err.toString());
    }
  }

  const message = {};
  message.processedChannels = processedChannels;
  message.processedPiPoints = processedPiPoints;

  return message;
}

async function _createWebSocket(channelId, channelGroupPiPoints) {

  // Create the Pi WebSocket (wss) StreamSet URL and add WebId query for all channel PiPoints
  let channelUrl = `${wssRootUrl}/streamsets/channel?heartbeatRate=10`;
  for (const piPoint of channelGroupPiPoints) {
    channelUrl += `&webid=${piPoint["webid"]}`;
  }

  // Create the channels WebSocket with the attached PiPoint WebIds, this will try to create the connection immediately.
  // TODO: Set rejectUnauthorized == SSL cert verification? use shadow-config variable to set if is - set to true otherwise.
  const webSocket = new WebSocket(channelUrl, { rejectUnauthorized: false });

  // Add WebSocket state-change callbacks
  webSocket.onopen = function (event) {
    onWebsocketChangedState("open", channelId, event);
  };

  webSocket.onerror = function (event) {
    onWebsocketChangedState("errored", channelId, event);
  };

  webSocket.onclose = function (event) {
    onWebsocketChangedState("close", channelId, event);
  };

  webSocket.onmessage = function (event) {
    onWebsocketMessage(event);
  };

  // Wait for up to 100mS (10 Cnt x 10mS) if the socket isn't connected yet.  
  // This prevents excessive load on the Pi Server and local OS from blocking new connections. 
  await new Promise(resolve => setTimeout(resolve, 10));
  for (let loopCnt = 0; loopCnt < 10; loopCnt++) {
    if (webSocket.readyState === webSocket.CONNECTING) {
      await new Promise(resolve => setTimeout(resolve, 10));
    } else {
      break;
    }
  }

  return webSocket;
}

// Queued Pi Point Getters

/**
 * Return a deep copy of the Queued Pi Points list. 
 * @returns 
 */
function getQueuedPiPoints() {
  return queuedPiPointRequests.slice(0);
}

function getNumberQueuedPiPoints() {
  return queuedPiPointRequests.length;
}

// Channel / WebSocket Getters

function getChannels() {

  const channels = [];

  for (const [channelId, channelMap] of websocketChannelMap.entries()) {
    let webSocketState = channelMap.websocket.readyState;
    channels.push(new PiWebSocketChannel(channelId, webSocketState, channelMap.piPoints));
  }

  return channels;
}

/**
* Returns a representation of a (OSI Pi WebSocket / StreamSet) Channel with matching websocket state.
* 
* Here, a Channel is a mapping of WebSocket and allocated PiPoints in following format:
*  channel: { "websocket": webSocket, "piPoints": channelGroupPiPoints }
*  channelGroupPiPoints: [{ "webid": piPointWebId, "path": piPointPath }]
* 
* @param {*} piPointWebId 
* @returns 
*/
function getChannelByWebsocketState(websocketState) {

  const channels = [];

  // Convert human readable state to WS integer state
  const websocketStateInt = websocketReadyStateMap[websocketState.toLowerCase()];

  for (const [channelId, channelMap] of websocketChannelMap.entries()) {

    const currentState = channelMap.websocket.readyState;

    if (currentState === websocketStateInt) {
      channels.push(new PiWebSocketChannel(channelId, currentState, channelMap.piPoints));
    }
  }

  return channels;
}

/**
* Returns a representation of a (OSI Pi WebSocket / StreamSet) Channel with matching Channel ID. 
* 
* Errors if no matching ChannelId found.
* 
* Here, a Channel is a mapping of WebSocket and allocated PiPoints in following format:
*  channel: { "websocket": webSocket, "piPoints": channelGroupPiPoints }
*  channelGroupPiPoints: [{ "webid": piPointWebId, "path": piPointPath }]
* 
* @param {*} piPointWebId 
* @returns 
*/
function getChannelByChannelId(channelId) {

  if (!websocketChannelMap.has(channelId)) {
    throw new Error(`Channel ID ${channelId} does not exist.`);
  }

  let channelMap = websocketChannelMap.get(channelId);
  let webSocketState = channelMap.websocket.readyState;
  return new PiWebSocketChannel(channelId, webSocketState, channelMap.piPoints);

}

/**
 * Returns a representation of a (OSI Pi Websocket / StreamSet) Channel that 
 * is configured to stream data from the given PiPoint WebId. 
 * 
 * Returns false if no matching PiPoint WebId found.
 * 
 * Here, a Channel is a mapping of WebSocket and allocated PiPoints in following format:
 *  channel: { "websocket": webSocket, "piPoints": channelGroupPiPoints }
 *  channelGroupPiPoints: [{ "webid": piPointWebId, "path": piPointPath }]
 * 
 * @param {*} piPointWebId 
 * @returns 
 */
function getChannelByPiPointWebId(piPointWebId) {

  // Iterate through all channels and associated PiPoints and return Channel representation if match found. 
  for (const [channelId, channelMap] of websocketChannelMap.entries()) {
    for (const piPoints of channelMap.piPoints) {
      if (piPointWebId == piPoints.webid) {
        let webSocketState = channelMap.websocket.readyState;
        return new PiWebSocketChannel(channelId, webSocketState, channelMap.piPoints);
      }
    }
  }

  // Return false if not found. 
  return false;
}

/**
 * Returns a representation of a (OSI Pi WebSocket / StreamSet) Channel that 
 * is configured to stream data from the given PiPoint Path. 
 * 
 * Returns false if no matching PiPoint path found.
 * 
 * Here, a Channel is a mapping of WebSocket and allocated PiPoints in following format:
 *  channel: { "websocket": webSocket, "piPoints": channelGroupPiPoints }
 *  channelGroupPiPoints: [{ "webid": piPointWebId, "path": piPointPath }]
 * 
 * @param {*} piPointPath 
 * @returns 
 */
function getChannelByPiPointPath(piPointPath) {

  // Iterate through all channels and associated PiPoints and return Channel representation if match found. 
  for (const [channelId, channelMap] of websocketChannelMap.entries()) {
    for (const piPoints of channelMap.piPoints) {
      if (piPointPath == piPoints.path) {
        const webSocketState = channelMap.websocket.readyState;
        return new PiWebSocketChannel(channelId, webSocketState, channelMap.piPoints);
      }
    }
  }

  // Return false if not found. 
  return false;
}

/**
 * Returns the representation of an array of (OSI Pi Websocket / StreamSet) Channels that 
 * are configured to stream data from any PiPoint Path that matches the given piPointPathRegex. 
 * 
 * @param {*} piPointPathRegex 
 * @returns 
 */
function getChannelsByPiPointPathRegex(piPointPathRegex) {

  const channels = {};
  const regex = new RegExp(piPointPathRegex);

  // Iterate through all channels and associated PiPoints and return Channel representations is any regEx match found. 
  for (const [channelId, channelMap] of websocketChannelMap.entries()) {
    for (const piPoints of channelMap.piPoints) {
      if (regex.test(piPoints.path)) {

        // Don't add the same channel multiple times (even though may have multiple matching PiPoint paths.)
        if (!(channelId in channels)) {

          let webSocketState = channelMap.websocket.readyState;
          channels[channelId] = new PiWebSocketChannel(channelId, webSocketState, channelMap.piPoints);

        }
      }
    }
  }

  return Object.values(channels);
}

function getChannelNumbersByPiPointPathRegex(piPointPathRegex) {
  let channels = getChannelsByPiPointPathRegex(piPointPathRegex);

  let channelCnt = channels.length;
  let piPointCnt = 0;

  for (const channel of channels) {
    piPointCnt += channel.getPiPoints().length;
  }

  return {
    "channels": channelCnt,
    "piPoints": piPointCnt
  };
}

// Close Channel / WebSocket Functions

/**
 * Closes the WebSocket of all channels, leaves a reference to the closed channels 
 *  on the system so they can be re-opend with the same channelId and PiPoints.
 * 
 * @returns 
 */
function closeAllChannels() {

  let numChannels = 0, numPiPoints = 0;

  for (const [channelId, channelMap] of websocketChannelMap.entries()) {

    numChannels++;
    numPiPoints += channelMap.piPoints.length;
    closeChannelByChannelId(channelId);
  }

  return `Closed ${numChannels} WebSocket Channels and ${numPiPoints} PiPoints streaming data sessions.`;
}

/**
 * Closes the WebSocket channel with the given channelId. 
 * 
 * Errors if the channelId doesn't exist.
 * 
 * @param {*} channelId 
 * @returns 
 */
function closeChannelByChannelId(channelId) {

  if (!websocketChannelMap.has(channelId)) {
    throw new Error(`Channel ID ${channelId} does not exist.`);
  }

  // Gets channel object or error if doesn't exist.
  const channelMap = websocketChannelMap.get(channelId);
  const numPiPoints = channelMap.piPoints.length;
  const webSocket = channelMap.websocket;

  // Set manuallyClosed so won't be automatically reopened if enabled.
  channelMap.manuallyClosed = true;

  // close the WebSocket
  webSocket.close();

  return `Closed OSI Pi WebSocket Channel ${channelId} - ${numPiPoints} associated PiPoints removed.`;
}

/**
 * Closes the WebSocket channel containing the PiPoint with the given WebId.
 * Leaves a reference to the closed channels on the system so they can be 
 * re-opend with the same channelId and PiPoints.
 * 
 * Note: This closes the WebSocket and effects all PiPoints associated with this channel.
 * 
 * @param {*} channelId 
 * @returns 
 */
function closeChannelByPiPointWebId(piPointWebId) {

  // Get channel
  let channel = getChannelByPiPointWebId(piPointWebId);

  if (!channel) {
    throw new Error(`Request to close Channel By PiPoint WebId ${piPointWebId} failed. Channel ID does not exist.`);
  }

  return closeChannelByChannelId(channel.getChannelId());
}

/**
 * Closes any WebSocket channels containing PiPoint paths that match the given piPointPathRegex. 
 * Note: This closes the WebSocket and affects all PiPoints associated with this channel.
 * 
 * 
 * @param {*} channelId 
 * @returns 
 */
function closeChannelsByPiPointPathRegEx(piPointPathRegex) {

  let channels = getChannelsByPiPointPathRegex(piPointPathRegex);

  let channelCnt = channels.length;
  let piPointCnt = 0;

  for (const channel of channels) {
    piPointCnt += channel.getPiPoints().length;
    closeChannelByChannelId(channel.getChannelId());
  }

  return `Closed ${channelCnt} OSI Pi WebSocket Channel/s - ${piPointCnt} associated PiPoints removed.`;

}

// Re/Open Channel / WebSocket Functions
async function openChannelByChannelId(channelId) {

  try {

    // Validate channel exists.
    if (!websocketChannelMap.has(channelId)) {
      throw new Error(`Channel ID ${channelId} does not exist.`);
    }

    // Gets channel object
    const channelMap = websocketChannelMap.get(channelId);

    // Remove the manuallyClosed param if set from a previous close function
    channelMap.manuallyClosed = null;

    // Re-init the channels WebSocket with given channel PiPoints. 
    channelMap.websocket = await _createWebSocket(channelId, channelMap.piPoints);

    return `Open OSI Pi WebSocket Channel ${channelId} request complete - monitor websocket-state change topics for status.`;

  } catch (err) {
    // This if the WebSocket failed to initiate all together such as when the local OS won't accept any 
    // more TCP connections. The WebSocket won't be added to the initiated list so is effectively deleted from the queue.
    onWebsocketChangedState("failed-deleted", channelId, err.toString());
  }
}

async function openAllClosedChannels() {

  // Get all closed channels
  let closedChannels = getChannelByWebsocketState("closed");

  let piPointCnt = 0;
  for (const channel of closedChannels) {

    // Opens Channel WebSocket
    await openChannelByChannelId(channel.getChannelId());
    piPointCnt += channel.getNumberPiPoints();
  }

  return `Open OSI Pi WebSockets for ${closedChannels.length} Channels with ${piPointCnt} total PiPoints request complete - monitor websocket-state change topics for status.`;
}

// Delete Channel / WebSocket Functions

/**
 * Closeds and deletes all Websocket channels on the system.
 * @returns 
 */
function deleteAllChannels() {

  let numChannels = 0, numPiPoints = 0;

  // close and delete the channel
  for (const [channelId, channelMap] of websocketChannelMap.entries()) {

    // Close the channel
    numChannels++;
    numPiPoints += channelMap.piPoints.length;
    closeChannelByChannelId(channelId);

    // Delete the channel from the channel list.
    websocketChannelMap.delete(channelId);
  }

  return `Closed and Deleted ${numChannels} WebSocket Channels and ${numPiPoints} PiPoints streaming data sessions.`;
}

/**
 * Closes and Deletes the WebSocket channel with the given channelId. 
 * 
 * Errors if the channelId doesn't exist.
 * 
 * @param {*} channelId 
 * @returns 
 */
function deleteChannelByChannelId(channelId) {

  // Close the channel
  let closeResponse = closeChannelByChannelId(channelId);

  // Delete the channel from the channel list.
  websocketChannelMap.delete(channelId);

  return `Closed and Deleted and ${closeResponse}`;
}

/**
 * Closes and Deletes any WebSocket channels containing PiPoint paths that match the given piPointPathRegex. 
 * Note: This closes the WebSocket and affects all PiPoints associated with this channel.
 * 
 * 
 * @param {*} channelId 
 * @returns 
 */
function deleteChannelsByPiPointPathRegEx(piPointPathRegex) {

  let channels = getChannelsByPiPointPathRegex(piPointPathRegex);

  let channelCnt = channels.length;
  let piPointCnt = 0;

  for (const channel of channels) {
    piPointCnt += channel.getPiPoints().length;
    deleteChannelByChannelId(channel.getChannelId());
  }

  return `Closed ${channelCnt} OSI Pi WebSocket Channel/s - ${piPointCnt} associated PiPoints removed.`;

}


module.exports = {
  webSocketManagerUpdateConfig,
  queueStreamPiPointRequest,
  clearQueueStreamPiPointRequest,
  activateQueuedPiPointsForStreaming,
  getQueuedPiPoints,
  getNumberQueuedPiPoints,
  getChannels,
  getChannelByWebsocketState,
  getChannelByChannelId,
  getChannelByPiPointWebId,
  getChannelByPiPointPath,
  getChannelsByPiPointPathRegex,
  getChannelNumbersByPiPointPathRegex,
  closeAllChannels,
  closeChannelByChannelId,
  closeChannelByPiPointWebId,
  closeChannelsByPiPointPathRegEx,
  openChannelByChannelId,
  openAllClosedChannels,
  deleteAllChannels,
  deleteChannelByChannelId,
  deleteChannelsByPiPointPathRegEx
};
