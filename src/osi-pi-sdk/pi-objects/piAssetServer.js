/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiBaseObject = require("./piBaseObject");

class PiAssetServer extends PiBaseObject {

  constructor(webid, name, path, id, isConnected, serverVersion, serverTime) {
    super(webid, name, path);

    this.id = id;
    this.isConnected = isConnected;
    this.serverVersion = serverVersion;
    this.serverTime = serverTime;
  }

  getId() { return this.id; }
  getIsConnected() { return this.isConnected; }
  getServerVersion() { return this.serverVersion; }
  getServerTime() { return this.serverTime; }
}

module.exports = PiAssetServer;
