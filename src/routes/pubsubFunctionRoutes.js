/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 * Provides mapping from MQTT Route (command) field to calling function across all 
 * AWS OSI Pi Integration Library components.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const osiPiSdkControllerRouteMap = [

  // Pi Asset Server Functions.
  "publish-pi-root-path",

  // Pi Asset Server Functions.
  "publish-pi-asset-servers",
  "publish-pi-asset-server-by-param",

  // Pi Asset Database Functions.
  "publish-pi-asset-database-by-param",
  "publish-pi-asset-databases-by-asset-server-webid",

  // Pi Asset Elements Functions.
  "publish-pi-asset-element-by-param",
  "publish-pi-asset-elements-by-query",
  "publish-number-asset-elements-by-query",
  "publish-pi-asset-elements-by-asset-database-webid",
  "publish-pi-asset-element-children-by-webid",

  // Pi Asset Element Attribute Functions.
  "publish-pi-attribute-by-param",
  "publish-pi-attribute-by-element-webid",

  // Pi Asset Template Functions.
  "publish-pi-element-template-by-param",
  "publish-pi-element-templates-by-asset-database-webid",

  // Pi Asset Template Attribute Functions.
  "publish-pi-template-attribute-by-param",
  "publish-pi-template-attributes-by-template-webid",

  // Pi Data Archive / Data Server Functions.
  "publish-pi-data-servers",
  "publish-pi-data-server-by-param",

  // Pi Data Archive / Pi (data) Points Functions.
  "publish-pi-points-by-query",
  "publish-number-pi-points-by-query"
];

const osiPiStreamingDataControllerRouteMap = [

  // Stream / Queue Pi Points for data streaming over WebSockets
  "queue-pi-points-for-streaming-by-query",
  "publish-queued-pi-points",
  "publish-number-queued-pi-points",
  "clear-queued-pi-points-for-streaming",
  "activate-queued-pi-points-for-streaming",

  // Publish OSI PiPoint WebSocket Manager Channel Functions. 
  "publish-channels",
  "publish-channel-stats",
  "publish-channels-by-state",
  "publish-channel-by-channel-id",
  "publish-channel-by-pi-point-webid",
  "publish-channel-by-pi-point-path",
  "publish-channels-by-pi-point-path-regex",
  "publish-all-channel-numbers",
  "publish-channel-numbers-by-pi-point-path-regex",

  // Close WebSocket Channels
  "close-all-channels",
  "close-channel-by-channel-id",
  "close-channel-by-pi-point-webid",
  "close-channels-by-pi-point-path-regex",

  // Open WebSocket Channels
  "open-channel-by-channel-id",
  "open-all-closed-channels",

  // Close and Delete reference to WebSocket Channels
  "delete-all-channels",
  "delete-channel-by-channel-id",
  "delete-channels-by-pi-point-path-regex",

  // Delete / Clear Pi Data points from buffer
  "delete-pi-data-buffer-queue"
];

const osiPiPointDataWriterRouteMap = [

  // Create / Write / Update Pi Data Points.
  "create-pi-point",
  "write-pi-point"
];

module.exports = {
  osiPiSdkControllerRouteMap,
  osiPiStreamingDataControllerRouteMap,
  osiPiPointDataWriterRouteMap
};

