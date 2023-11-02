/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 * 
 * Presents the state and mapping of an OSI Pi StreamSet:
 * (https://docs.aveva.com/bundle/pi-web-api-reference/page/help/controllers/streamset.html)
 * 
 * This is a WebSocket connection to the OSI Pi server with requested PiPoints 
 * to stream on-change data in real time. 
 * 
 * Note: This is an abstraction of the WebSocket state for user requests,
 * it's not a reference to the WebSocket itself. 
 * 
 */

// Channel WebSocket Connection state.
const webSocketStateOptions = {
  0: "connecting",
  1: "open",
  2: "closing",
  3: "closed"
};

class PiWebSocketChannel {

  constructor(channelId, websocketState, piPoints ) {

    this.channelId = channelId;
    this.websocketState = webSocketStateOptions[websocketState];
    this.piPoints = piPoints;
    this.numberPiPoints = piPoints.length;
  }

  getChannelId() { return this.channelId; }
  getWebsocketState() { return this.websocketState; }
  getPiPoints() { return this.piPoints; }
  getNumberPiPoints() { return this.numberPiPoints; }
}

module.exports = PiWebSocketChannel;
