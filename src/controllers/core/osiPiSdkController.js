/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

// OSI Pi: PiPoints search options. 
const searchOptions = {
  "contains": 1,
  "exact-match": 2,
  "starts-with": 3,
  "ends-with": 4,
};

/**
 * Receive and process PubSub MQTT Message Callback
 * 
 * @param {*} payload 
 */
function osiPiSdkMessageRouter(route, params) {

  try {

    switch (route) {

      case "publish-pi-root-path":
        publishPiRootPath(route);
        break;

      // Pi Asset Server Functions.
      case "publish-pi-asset-servers":
        publishPiAssetServers(route, params);
        break;

      case "publish-pi-asset-server-by-param":
        publishPiAssetServerByParam(route, params);
        break;

      // Pi Asset Database Functions.
      case "publish-pi-asset-database-by-param":
        publishPiAssetDatabaseByParam(route, params);
        break;

      case "publish-pi-asset-databases-by-asset-server-webid":
        publishPiAssetDatabasesByAssetServerWebId(route, params);
        break;

      // Pi Asset Elements Functions.
      case "publish-pi-asset-element-by-param":
        publishPiAssetElementByParam(route, params);
        break;

      case "publish-pi-asset-elements-by-query":
        publishPiAssetElementsByQuery(route, params);
        break;

      case "publish-number-asset-elements-by-query":
        publishNumberAssetElementsByQuery(route, params);
        break;

      case "publish-pi-asset-elements-by-asset-database-webid":
        publishPiAssetElementsByAssetDatabaseWebId(route, params);
        break;

      case "publish-pi-asset-element-children-by-webid":
        publishPiAssetElementChildrenByWebId(route, params);
        break;

      // Pi Asset Element Attrbute Functions.
      case "publish-pi-attribute-by-param":
        publishPiAttributeByParam(route, params);
        break;

      case "publish-pi-attribute-by-element-webid":
        publishPiAttributesByElementWebId(route, params);
        break;

      // Pi Asset Template Functions.
      case "publish-pi-element-template-by-param":
        publishPiElementTemplateByParam(route, params);
        break;

      case "publish-pi-element-templates-by-asset-database-webid":
        publishPiElementTemplatesByAssetDatabaseWebId(route, params);
        break;

      // Pi Asset Template Attribute Functions.
      case "publish-pi-template-attribute-by-param":
        publishPiTemplateAttributeByParam(route, params);
        break;

      case "publish-pi-template-attributes-by-template-webid":
        publishPiTemplateAttributesByTemplateWebId(route, params);
        break;

      // Pi Data Archive / Data Server  Functions.
      case "publish-pi-data-servers":
        publishPiDataServers(route, params);
        break;

      case "publish-pi-data-server-by-param":
        publishPiDataServerByParam(route, params);
        break;

      // Pi Data Archive / Pi (data) Points Functions.
      case "publish-pi-points-by-query":
        publishPiPointsByQuery(route, params);
        break;

      case "publish-number-pi-points-by-query":
        publishNumberPiPointsByQuery(route, params);
        break;

      default:
        throw new Error(`Unknown message Route received by OSI Pi SDK Controller: ${route}`);
    }

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

//===================================================
// OSI Pi SDK Functions

async function publishPiRootPath(route) {

  try {

    let piRootPath = await piWebSdk.getPiApiRoot();

    // Publish this iteration of PiPoints to PubSub 
    let message = {};
    message.piRootPath = piRootPath;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

// OSI Pi Asset Framework Server Functions. 

async function publishPiAssetServers(route) {

  try {

    let piAssetServers = await piWebSdk.getPiAssetServers();

    // Publish this iteration of PiPoints to PubSub 
    let message = {};
    message.numberPiAssetServers = piAssetServers.length;
    message.piAssetServers = piAssetServers;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

async function publishPiAssetServerByParam(route, params) {

  try {
    const webid = params.webid;
    const path = params.path;
    const name = params.name;

    // Get the Data Server Object.
    let piAssetServer = await piWebSdk.getPiAssetServerByParam(webid, path, name);

    // Publish the result
    let message = {};
    if (webid) message.webid = webid;
    if (path) message.path = path;
    if (name) message.name = name;
    message.piAssetServer = piAssetServer;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

// OSI Pi Asset Database Functions. 

async function publishPiAssetDatabasesByAssetServerWebId(route, params) {

  try {
    let assetServerWebId = params.assetServerWebId;
    if (!assetServerWebId) throw new Error("Must include 'assetServerWebId' value. List all Pi asset server WebIds via publish-pi-asset-servers route");

    let piAssetDatabases = await piWebSdk.getPiAssetDatabasesByAssetServerWebId(assetServerWebId);

    // Publish this iteration of PiPoints to PubSub 
    let message = {};
    message.assetServerWebId = assetServerWebId;
    message.numberPiAssetDatabases = piAssetDatabases.length;
    message.piAssetDatabases = piAssetDatabases;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

async function publishPiAssetDatabaseByParam(route, params) {

  try {
    let webid = params.webid;
    let path = params.path;

    // Get the Data Server Object.
    let piAssetServer = await piWebSdk.getPiAssetDatabaseByParam(webid, path);

    // Publish the result
    let message = {};
    if (webid) message.webid = webid;
    if (path) message.path = path;
    message.piAssetServer = piAssetServer;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

// OSI Pi Asset Element Functions. 

async function publishPiAssetElementByParam(route, params) {

  try {
    let webid = params.webid;
    let path = params.path;

    // Get the Data Server Object.
    let piAssetElement = await piWebSdk.getPiAssetElementByParam(webid, path);

    // Publish the result
    let message = {};
    if (webid) message.webid = webid;
    if (path) message.path = path;
    message.piAssetElement = piAssetElement;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

async function publishPiAssetElementsByQuery(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piAssetElements = [];
    const databaseWebId = params.databaseWebId;
    const queryString = params.queryString;

    if (!databaseWebId) throw new Error("Must include databaseWebId value, list all Asset Database details via publish-pi-asset-databases-by-asset-server-webid route");
    if (!queryString) throw new Error("Must include a queryString. For example: Enter 'name:=*' to return all Pi Asset Elements (use cautiously and at your own risk!)");

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 250;

    do {
      // Get this iteration of matching piPoints from current startIndex to maxItemCount

      piAssetElements = await piWebSdk.getPiAssetElementsByQuery(databaseWebId, queryString, startIndex, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (piAssetElements.length === 0) break;

      // Publish this iteration of Pi Elements to PubSub 
      let message = {};
      message.numberPiAssetElements = piAssetElements.length;
      message.startIndex = startIndex;
      message.queryString = queryString;
      message.piAssetElements = piAssetElements;

      // Publish the 206 partial response update message. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piAssetElements.length;

    } while (piAssetElements.length > 0);

    await publishFormattedMessage(route, { "databaseWebId": databaseWebId, "queryString": queryString, "itemsReturned": startIndex });

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

async function publishNumberAssetElementsByQuery(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, assetElementsReturned;
    const databaseWebId = params.databaseWebId;
    const queryString = params.queryString;

    if (!databaseWebId) throw new Error("Must include databaseWebId value, list all Asset Database details via publish-pi-asset-databases-by-asset-server-webid route");
    if (!queryString) throw new Error("Must include a queryString. For example: Enter 'name:=*' to return all Pi Asset Elements (use cautiously and at your own risk!)");

    do {
      // Get this iteration of returned Pi Points and add to count.
      assetElementsReturned = await piWebSdk.getNumberAssetElementsByQuery(databaseWebId, queryString, startIndex);
      startIndex += assetElementsReturned;

    } while (assetElementsReturned > 0);

    let message = {};
    message.databaseWebId = databaseWebId;
    message.queryString = queryString;
    message.returnedAssetElements = startIndex;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

async function publishPiAssetElementsByAssetDatabaseWebId(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piAssetElements = [];
    const assetDatabaseWebId = params.assetDatabaseWebId;
    let searchFullHierarchy = params.searchFullHierarchy;

    if (!assetDatabaseWebId) throw new Error("Must inclue 'assetDatabaseWebId' value. List all Pi asset server WebIds via publish-pi-asset-databases-by-asset-server-webid route");

    // Default searchFullHierarchy to false
    if (searchFullHierarchy == null) searchFullHierarchy = false;

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 250;

    do {

      piAssetElements = await piWebSdk.getPiAssetElementsByAssetDatabaseWebId(assetDatabaseWebId, searchFullHierarchy, startIndex, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (piAssetElements.length === 0) break;

      // Publish this iteration of PiPoints to PubSub 
      let message = {};
      message.startIndex = startIndex;
      message.assetDatabaseWebId = assetDatabaseWebId;
      message.numberPiAssetElements = piAssetElements.length;
      message.piAssetElements = piAssetElements;

      // Publish the 206 partial response update message. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piAssetElements.length;

    } while (piAssetElements.length > 0);

    await publishFormattedMessage(route, { "assetDatabaseWebId": assetDatabaseWebId, "itemsReturned": startIndex });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishPiAssetElementChildrenByWebId(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piAssetElements = [];
    let piElementWebId = params.piElementWebId;
    let searchFullHierarchy = params.searchFullHierarchy;

    if (!piElementWebId) throw new Error("Must inclue 'piElementWebId' value. List all Pi asset database Element WebIds via publish-pi-asset-element-templates-by-asset-database-webid route");

    // Default searchFullHierarchy to false
    if (searchFullHierarchy == null) searchFullHierarchy = false;

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 250;

    do {

      piAssetElements = await piWebSdk.getPiAssetElementChildrenByWebId(piElementWebId, searchFullHierarchy, startIndex, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (piAssetElements.length === 0) break;

      // Publish this iteration of PiPoints to PubSub 
      let message = {};
      message.numberPiAssetElements = piAssetElements.length;
      message.startIndex = startIndex;
      message.piElementWebId = piElementWebId;
      message.piAssetElements = piAssetElements;

      // Publish the 206 partial response update messages. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piAssetElements.length;

    } while (piAssetElements.length > 0);

    await publishFormattedMessage(route, { "piElementWebId": piElementWebId, "itemsReturned": startIndex });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// OSI Pi Element Attribute Functions. 

async function publishPiAttributeByParam(route, params) {

  try {
    let webid = params.webid;
    let path = params.path;

    // Get the Data Server Object.
    let piAttribute = await piWebSdk.getPiAttributeByParam(webid, path);

    // Publish the result
    let message = {};
    message.piAttribute = piAttribute;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }

}

async function publishPiAttributesByElementWebId(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piAttributes = [];
    const elementWebId = params.elementWebId;

    if (!elementWebId) throw new Error("Must include elementWebId value, list all Asset Elements details via publish-pi-asset-elements-by-query route");

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 200;

    do {

      // Get this iteration of returned Pi Points and add to count.
      piAttributes = await piWebSdk.getPiAssetAttributesByElementWebId(elementWebId, startIndex, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (piAttributes.length === 0) break;

      // Publish this iteration of Pi Attributes to PubSub 
      let message = {};
      message.startIndex = startIndex;
      message.numberPiApiAttributes = piAttributes.length;
      message.piAttributes = piAttributes;

      // Publish the 206 partial response update message. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piAttributes.length;

    } while (piAttributes.length > 0);

    await publishFormattedMessage(route, { "elementWebId": elementWebId, "itemsReturned": startIndex });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// OSI Pi Asset Element Template Functions. 

async function publishPiElementTemplatesByAssetDatabaseWebId(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    const assetDatabaseWebId = params.assetDatabaseWebId;
    if (!assetDatabaseWebId) throw new Error("Must inclue 'assetDatabaseWebId' value. List all Pi asset server WebIds via publish-pi-asset-databases-by-asset-server-webid route");

    // NOTE: GetElementTemnplate doesn't support startIndex so assume will only return < mqttPublishMaxItemCount items. 
    // Means can't use the same do / while loop pattern and instead need to break down what is returned.
    const piElementTemplates = await piWebSdk.getPiElementTemplatesByAssetDatabaseWebId(assetDatabaseWebId);
    const numTempates = piElementTemplates.length;

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 100;
    let startIndex = 0, publishPiElementTemplates = [];
    do {

      publishPiElementTemplates = piElementTemplates.splice(0, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (publishPiElementTemplates.length === 0) break;

      // Publish this iteration of PiPoints to PubSub 
      let message = {};
      message.startIndex = startIndex;
      message.numberPiElementTemplates = publishPiElementTemplates.length;
      message.piElementTemplates = publishPiElementTemplates;

      // Publish the 206 partial response update messages. 
      await publishFormattedMessage(route, message, 206);

      startIndex += publishPiElementTemplates.length;

    } while (publishPiElementTemplates.length > 0);

    await publishFormattedMessage(route, { "assetDatabaseWebId": assetDatabaseWebId, "itemsReturned": numTempates});

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishPiElementTemplateByParam(route, params) {

  try {
    let webid = params.webid;
    let path = params.path;

    // Get the Data Server Object.
    let piElementTemplate = await piWebSdk.getPiElementTemplateByParam(webid, path);

    // Publish the result
    let message = {};
    message.piElementTemplate = piElementTemplate;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// OSI Pi Element Template Attribute Functions. 

async function publishPiTemplateAttributeByParam(route, params) {

  try {
    let webid = params.webid;
    let path = params.path;

    // Get the Data Server Object.
    let piTemplateAttribute = await piWebSdk.getPiTemplateAttributeByParam(webid, path);

    // Publish the result
    let message = {};
    message.piTemplateAttribute = piTemplateAttribute;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishPiTemplateAttributesByTemplateWebId(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piTemplateAttributes = [];
    const templateWebid = params.templateWebid;

    if (!templateWebid) throw new Error("Must include templateWebid value, list all Asset Element Templates details via publish-pi-element-templates-by-asset-database-webid route");

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 200;

    do {

      // Get this iteration of returned Pi Points and add to count.
      piTemplateAttributes = await piWebSdk.getPiTemplateAttributesByTemplateWebId(templateWebid, startIndex, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (piTemplateAttributes.length === 0) break;

      // Publish this iteration of Pi Attributes to PubSub 
      let message = {};
      message.startIndex = startIndex;
      message.numberPiTemplateAttributes = piTemplateAttributes.length;
      message.templateWebid = templateWebid;
      message.piTemplateAttributes = piTemplateAttributes;

      // Publish the 206 partial response update messages. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piTemplateAttributes.length;

    } while (piTemplateAttributes.length > 0);

    await publishFormattedMessage(route, { "templateWebid": templateWebid, "itemsReturned": startIndex });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// OSI Pi Data Archive Server Functions. 

async function publishPiDataServers(route) {

  try {
    let piDataServers = await piWebSdk.getPiDataServers(route);

    // Publish this iteration of PiPoints to PubSub 
    let message = {};
    message.numberPiDataServers = piDataServers.length;
    message.piDataServers = piDataServers;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishPiDataServerByParam(route, params) {

  try {
    let webid = params.webid;
    let path = params.path;
    let name = params.name;

    // Get the Data Server Object.
    let piDataServer = await piWebSdk.getPiDataServerByParam(webid, path, name);

    // Publish the result
    let message = {};
    message.webid = webid;
    message.piDataServer = piDataServer;

    // Publish the PubSub message. 
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

// OSI PiPoint from Data Archive Server Query Functions. 

async function publishPiPointsByQuery(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piPoints = [];
    const dataServerWebId = params.dataServerWebId;
    const queryString = params.queryString;
    const searchOption = params.searchOption;

    if (!dataServerWebId) throw new Error("Must include dataServerWebId value, list all data server details via publish-pi-data-servers route");
    if (!queryString) throw new Error("Must include a queryString. For example: Enter 'tag:=*' to return all values (use cautiously and at your own risk!)");

    // Get the optional Pi searchOption value and convert to required in val. Sed default 1 (search value 'contains' queryString)
    let searchOptionVal = searchOptions[searchOption];
    if (!searchOptionVal) searchOptionVal = 1;

    // Manually reduce MaxItems that will return in a call to fit in a single MQTT response message.
    const mqttPublishMaxItemCount = 250;

    do {
      // Get this iteration of matching piPoints from current startIndex to maxItemCount

      piPoints = await piWebSdk.getPiPointsByQuery(dataServerWebId, queryString, searchOptionVal, startIndex, mqttPublishMaxItemCount);

      // Don't send last message after startIndex with zero return values. 
      if (piPoints.length === 0) break;

      // Publish this iteration of PiPoints to PubSub 
      let message = {};
      message.startIndex = startIndex;
      message.numberPiPoints = piPoints.length;
      message.dataServerWebId = dataServerWebId;
      message.queryString = queryString;
      message.searchOption = Object.keys(searchOptions).find(key => searchOptions[key] === searchOptionVal);
      message.piPointItems = piPoints;

      // Publish the 206 partial response update message. 
      await publishFormattedMessage(route, message, 206);

      // Update startIndex for next iteration. 
      startIndex += piPoints.length;

    } while (piPoints.length > 0);

    await publishFormattedMessage(route, { "dataServerWebId": dataServerWebId, "queryString": queryString, "itemsReturned": startIndex });

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

async function publishNumberPiPointsByQuery(route, params) {

  try {
    await publishFormattedMessage(route, "request-ack-processing", 202);

    let startIndex = 0, piPointsReturned = 0;
    const dataServerWebId = params.dataServerWebId;
    const queryString = params.queryString;
    const searchOption = params.searchOption;

    if (!dataServerWebId) throw new Error("Must include dataServerWebId value, list all data servers via publish-pi-data-servers route");
    if (!queryString) throw new Error("Must include a queryString. For example: Enter 'tag:=*' to return all values (use cautiously and at your own risk!)");

    // Get the optional Pi searchOption val and convert to required in val. Sed default 1 (search value 'contains' queryString)
    let searchOptionVal = searchOptions[searchOption];
    if (!searchOptionVal) searchOptionVal = 1;

    do {

      // Get this iteration of returned Pi Points and add to count.
      piPointsReturned = await piWebSdk.getNumberPiPointsByQuery(dataServerWebId, queryString, searchOptionVal, startIndex);

      startIndex += piPointsReturned;

    } while (piPointsReturned > 0);

    let message = {};
    message.dataServerWebId = dataServerWebId;
    message.queryString = queryString;
    message.searchOption = Object.keys(searchOptions).find(key => searchOptions[key] === searchOptionVal);
    message.piPointsReturned = startIndex;
    await publishFormattedMessage(route, message);

  } catch (err) {
    publishErrorResponse(route, err);
  }
}

module.exports = {
  osiPiSdkMessageRouter
};

// No easy way to remove circular dependencies between PubSub Tx and Rx consumers on the 
// same Greengrass client so add require statements after all exports completed.
const { publishFormattedMessage, publishErrorResponse } = require("./awsPubsubController");
const piWebSdk = require("../../osi-pi-sdk/piWebSdk");


