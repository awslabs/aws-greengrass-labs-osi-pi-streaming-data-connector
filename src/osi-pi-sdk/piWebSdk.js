/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const axios = require("axios");
require("axios-debug-log/enable");
const axiosThrottle = require("axios-request-throttle");

// Pi API Objects
const PiServerRoot = require("./pi-objects/piServerRoot");
const PiAssetServer = require("./pi-objects/piAssetServer");
const PiAssetDatabase = require("./pi-objects/piAssetDatabase");
const PiAssetElement = require("./pi-objects/piAssetElement");
const PiAssetElementTemplate = require("./pi-objects/piAssetElementTemplate");
const PiAssetElementAttribute = require("./pi-objects/piAssetElementAttribute");
const PiAssetElementTemplateAttribute = require("./pi-objects/piAssetElementTemplateAttribute");
const PiDataServer = require("./pi-objects/piDataServer");
const PiDataPoint = require("./pi-objects/piDataPoint");

// Selected Fields query value filters for requests to PiWeb API

const baseSelectFields = "WebId;Name;Path";
const itemsSelectFields = "Items.WebId;Items.Name;Items.Path";

const piServerSelectField = `${baseSelectFields};Id;IsConnected;ServerVersion;ServerTime`;
const piServersSelectField = `${itemsSelectFields};Items.Id;Items.IsConnected;Items.ServerVersion;Items.ServerTime`;

const assetElementSelectField = `${baseSelectFields};TemplateName;Links.Template;Links.Parent;CategoryNames;ExtendedProperties;HasChildren`;
const assetElementsSelectField = `${itemsSelectFields};Items.TemplateName;Items.Links.Template;Items.Links.Parent;Items.CategoryNames;Items.ExtendedProperties;Items.HasChildren`;

const assetElementTemplateSelectField = `${baseSelectFields};BaseTemplate;NamingPattern;CategoryNames;InstanceType;ExtendedProperties`;
const assetElementTemplatesSelectField = `${itemsSelectFields};Items.BaseTemplate;Items.NamingPattern;Items.CategoryNames;Items.InstanceType;Items.ExtendedProperties`;

const assetElementAttributeSelectField = `${baseSelectFields};Type;DefaultUnitsName;DefaultUnitsNameAbbreviation;HasChildren;Links.Point`;
const assetElementAttributesSelectField = `${itemsSelectFields};Items.Type;Items.DefaultUnitsName;Items.DefaultUnitsNameAbbreviation;Items.HasChildren;Items.Links.Point`;

const assetElementTemplateAttributeSelectField = `${baseSelectFields};Type;DefaultUnitsName;DefaultUnitsNameAbbreviation;DefaultValue;HasChildren`;
const assetElementTemplateAttributesSelectField = `${itemsSelectFields};Items.Type;Items.DefaultUnitsName;Items.DefaultUnitsNameAbbreviation;Items.DefaultValue;Items.HasChildren`;

const dataPointSelectField = `${baseSelectFields};PointClass;PointType;EngineeringUnits;Zero;Span;Future`;
const dataPointsSelectField = `${itemsSelectFields};Items.PointClass;Items.PointType;Items.EngineeringUnits;Items.Zero;Items.Span;Items.Future`;

let maxPiApiQueryResponseItems = 1000;

function piWebSdkUpdateConfig(piSecrets, osiPiServerConfig) {

  console.log("[INFO] Initializing OSI Pi Web SDK Configuration....");

  //========================================
  // Basic validation of provided configs:

  // Validate piSecrets
  if (!(piSecrets && piSecrets.username && piSecrets.password)) {
    throw new Error("AWS Secret provided is missing, invalid or doesn't contain username and / or password keys.");
  }

  // Validate piServerUrl - update to reportedCandidate if no errors.
  const piServerUrl = osiPiServerConfig.piServerUrl;
  if (!(typeof piServerUrl === "string" && piServerUrl.length > 3)) {
    throw new Error("'piServerUrl' not provided or invalid format in config update.");
  }

  // Validate piApiRootPath - update to reportedCandidate if no errors.
  const piApiRootPath = osiPiServerConfig.piApiRootPath;
  if (!(typeof piApiRootPath === "string" && piApiRootPath.length > 0)) {
    throw new Error("'piApiRootPath' not provided or invalid format in config update.");
  }

  // Validate verifySsl - update to reportedCandidate if no errors.
  const verifySsl = osiPiServerConfig.verifySsl;
  if (isNaN(verifySsl) || verifySsl < 0 || verifySsl > 1) {
    throw new Error("'verifySsl' not provided or invalid value in OSI Pi Web SDK Manager config update (int: 0 or 1)");
  }

  // Validate piServerUrl - update to reportedCandidate if no errors.
  const authMode = osiPiServerConfig.authMode;
  if (!authMode === "basic") {
    throw new Error("'authMode' not provided or invalid value in OSI Pi Web SDK Manager config update (string: 'basic')");
  }

  // Validate maxPiApiRequestPerSec - update to reportedCandidate if no errors.
  const maxPiApiRequestPerSec = osiPiServerConfig.maxPiApiRequestPerSec;
  if (isNaN(maxPiApiRequestPerSec) || maxPiApiRequestPerSec < 1 || maxPiApiRequestPerSec > 250) {
    throw new Error("'maxPiApiRequestPerSec' not provided or invalid value in OSI Pi Web SDK Manager config update (int: 1 - 250)");
  }

  // Validate maxPiApiQueryResponseItems - update to reportedCandidate if no errors.
  const maxPiApiQueryResponseItemsCandidate = osiPiServerConfig.maxPiApiQueryResponseItems;
  if (isNaN(maxPiApiQueryResponseItemsCandidate) || maxPiApiQueryResponseItemsCandidate < 100 || maxPiApiQueryResponseItemsCandidate > 1000) {
    throw new Error("'maxPiApiQueryResponseItems' not provided or invalid value in OSI Pi Web SDK Manager config update (int: 100 - 1000)");
  }

  //========================================
  // Apply the provided config to local settings, 

  // Set system wide vars from configs provided. 
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = verifySsl;
  maxPiApiQueryResponseItems = maxPiApiQueryResponseItemsCandidate;

  // Calculate Pi Server root path and set Axios default throttling and headers from provided settings. 
  const baseUrl = `https://${piServerUrl}/${piApiRootPath}/`;
  axios.defaults.baseURL = baseUrl;
  axios.defaults.headers.common["Content-Type"] = "application/json";
  axiosThrottle.use(axios, { requestsPerSecond: maxPiApiRequestPerSec });

  console.log("[INFO] Setting Pi Server Base URL: ");
  console.log(baseUrl);

  // Calculate Basic Mode auth headers from AWS Secrets manager credentials and set to Axios defaults.
  const encodedToken = Buffer.from(piSecrets.username + ":" + piSecrets.password).toString("base64");
  axios.defaults.headers.common["Authorization"] = `Basic ${encodedToken}`;
  axios.defaults.timeout === 5000;

  console.log("[INFO] Initializing OSI Pi Web SDK Configuration - COMPLETE");

}

/**
   * Get Pi Root Server Links. 
   * 
   * @returns PiServerRoot
   */
async function getPiApiRoot() {

  const response = await axios.get();
  return new PiServerRoot(response.data.Links);
}

// Pi Asset Server Functions

/**
   * Polls the Pi Server and returns all discovered Pi Asset Servers as PiAssetServer objects.
   * 
   * @returns PiAssetServer[]
   */
async function getPiAssetServers() {

  const piAssetServers = [];
  const url = `assetservers?maxCount=${maxPiApiQueryResponseItems}&selectedFields=${piServersSelectField}`;
  const response = await axios.get(url);

  if (response.data.Items) {
    for (const item of response.data.Items) {
      piAssetServers.push(new PiAssetServer(item.WebId, item.Name, item.Path, item.Id, item.IsConnected, item.ServerVersion, item.ServerTime));
    }
  }

  return piAssetServers;
}

/**
 * Return the Pi Asset server object that matches the search parameters of webid, path or name.
 * Must provide exactly 1 of the search parameters, will not accept multiple search parameters. 
 * 
 * @param {*} webid 
 * @param {*} path 
 * @param {*} name 
 * @returns 
 */
async function getPiAssetServerByParam(webid, path, name, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path, name]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path' || 'name'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `assetservers/${webid}?startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${piServerSelectField}`;

  } else if (path) {
    url = `assetservers?path=${path}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${piServerSelectField}`;

  } else if (name) {
    url = `assetservers?name=${name}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${piServerSelectField}`;
  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiAssetServer(data.WebId, data.Name, data.Path, data.Id, data.IsConnected, data.ServerVersion, data.ServerTime);

}

// Pi Asset Database Functions

/**
* Return the Pi Asset Database object that matches the search parameters of webid, path or name.
* Must provide exactly 1 of the search parameters, will not accept multiple search parameters. 
* 
* @param {*} webId 
* @param {*} path 
* @param {*} name 
* @returns 
*/
async function getPiAssetDatabaseByParam(webid, path, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `assetdatabases/${webid}?startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${baseSelectFields}`;

  } else if (path) {
    url = `assetdatabases?path=${path}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${baseSelectFields}`;

  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiAssetServer(data.WebId, data.Name, data.Path);
}

/**
 Polls the Pi Server and returns all discovered Pi Asset Databases attached to the given AssetServerWebID as PiAssetDatabase objects.
 * 
 * @param {*} assetServerWebId 
 * @returns PiAssetDatabase[]
 */
async function getPiAssetDatabasesByAssetServerWebId(assetServerWebId, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const piAssetDatabase = [];
  const url = `assetservers/${assetServerWebId}/assetdatabases?startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${itemsSelectFields}`;
  const response = await axios.get(url);

  if (response.data.Items) {
    for (const item of response.data.Items) {
      piAssetDatabase.push(new PiAssetDatabase(item.WebId, item.Name, item.Path));
    }
  }

  return piAssetDatabase;
}

// Pi Asset Element Functions

/**
* Return the Pi Asset Database Element object that matches the search parameters of webid, path or name.
* Must provide exactly 1 of the search parameters, will not accept multiple search parameters. 
* 
* @param {*} webId 
* @param {*} path 
* @param {*} name 
* @returns 
*/
async function getPiAssetElementByParam(webid, path) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `elements/${webid}?selectedFields=${assetElementSelectField}`;

  } else if (path) {
    url = `elements?path=${path}&selectedFields=${assetElementSelectField}`;

  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiAssetElement(data.WebId, data.Name, data.Path, data.TemplateName, data.Links.Template, data.Links.Parent, data.CategoryNames, data.ExtendedProperties, data.HasChildren);
}

async function getNumberAssetElementsByQuery(databaseWebId, queryString, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const url = `elements/search?databaseWebId=${databaseWebId}&query=${queryString}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${assetElementsSelectField}`;
  const response = await axios.get(url);
  return response.data.Items.length;
}

/**
 * 
 * @param {*} databaseWebId 
 * @param {*} queryString 
 * @param {*} searchOption 
 * @param {*} startIndex 
 * @param {*} maxItemCount 
 * @returns 
 */
async function getPiAssetElementsByQuery(databaseWebId, queryString, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const requestUrl = `elements/search?databaseWebId=${databaseWebId}&query=${queryString}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${assetElementsSelectField}`;
  return getPiAssetElementList(requestUrl);
}

/**
 *  Polls the Pi Server and returns all discovered Pi Database Asset Elements as PiAssetElement objects.
 *  Pi Asset Parent Elements attached directly to the Pi Asset Database have a different GET URL path than 
 *  child Elements and so Pi Database Elements and Pi Child Elements require different request functions.
 * 
 *  Use this when you don't have the desired Pi Element Path or WebID to scan for available Pi Elements attached to 
 *  the Pi Asset Database. 
 * 
 * @param {*} assetDatabaseWebId 
 * @returns PiAssetElement[]
 */
async function getPiAssetElementsByAssetDatabaseWebId(piAssetDatabaseWebId, searchFullHierarchy, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const requestUrl = `assetdatabases/${piAssetDatabaseWebId}/elements?startIndex=${startIndex}&maxCount=${maxItemCount}&searchFullHierarchy=${searchFullHierarchy}&selectedFields=${assetElementsSelectField}`;
  return getPiAssetElementList(requestUrl);
}

/**
   *  Returns the child Pi Asset Elements of the provided (parent) Pi Asset Element WebId as an array of PiAssetElement objects. 
   *  Use this when recursively polling down the Pi Asset Element from a given Pi Asset Database Element or a known Pi Element path. 
   * 
   * @param {*} assetElementWebId 
   * @returns PiAssetElement[]
   */
async function getPiAssetElementChildrenByWebId(webid, searchFullHierarchy, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const requestUrl = `elements/${webid}/elements?startIndex=${startIndex}&maxCount=${maxItemCount}&searchFullHierarchy=${searchFullHierarchy}&selectedFields=${assetElementsSelectField}`;
  return getPiAssetElementList(requestUrl);
}

async function getPiAssetElementList(requestUrl) {

  const response = await axios.get(requestUrl);

  const piAssetElements = [];
  if (response.data.Items) {
    for (const item of response.data.Items) {
      const piAssetElement = new PiAssetElement(item.WebId, item.Name, item.Path, item.TemplateName, item.Links.Template, item.Links.Parent, item.CategoryNames, item.ExtendedProperties, item.HasChildren);
      piAssetElements.push(piAssetElement);
    }
  }

  return piAssetElements;
}

// Pi Asset Element Attribute Functions

/**
   * Returns  Pi Asset Attribute of the WebId / Path provided
   * 
   * @param {*} assetAttributeWebId 
   * @returns PiAssetElementAttribute
   */
async function getPiAttributeByParam(webid, path) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `attributes/${webid}?selectedFields=${assetElementAttributeSelectField}`;
  } else if (path) {
    url = `attributes?path=${path}&selectedFields=${assetElementAttributeSelectField}`;
  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiAssetElementAttribute(data.WebId, data.Name, data.Path, data.Type, data.DefaultUnitsName, data.DefaultUnitsNameAbbreviation, data.HasChildren, data.Links.Point);
}

/**
   * Returns all Pi Asset Attributes of the provided Pi Asset Element WebId as an array of PiAssetElementAttribute objects
   * 
   * @param {*} assetElementWebId 
   * @returns PiAssetElementAttribute[]
   */
async function getPiAssetAttributesByElementWebId(elementWebId, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const piAssetElementAttributes = [];
  const url = `elements/${elementWebId}/attributes?startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${assetElementAttributesSelectField}`;
  const response = await axios.get(url);

  for (const item of response.data.Items) {
    const piAssetElementAttribute = new PiAssetElementAttribute(item.WebId, item.Name, item.Path, item.Type, item.DefaultUnitsName, item.DefaultUnitsNameAbbreviation, item.HasChildren, item.Links.Point);
    piAssetElementAttributes.push(piAssetElementAttribute);
  }

  return piAssetElementAttributes;
}

// Pi Asset Element Template Functions

async function getPiElementTemplatesByAssetDatabaseWebId(piAssetDatabaseWebId, maxItemCount = maxPiApiQueryResponseItems) {
  // Note - Elements templates doesn't support start index. 
  const piAssetElementTemplates = [];
  const url = `assetdatabases/${piAssetDatabaseWebId}/elementtemplates?maxCount=${maxItemCount}&selectedFields=${assetElementTemplatesSelectField}`;

  const response = await axios.get(url);

  if (response.data.Items) {
    for (const item of response.data.Items) {

      const piAssetElementTemplate = new PiAssetElementTemplate(item.WebId, item.Name, item.Path, item.BaseTemplate, item.NamingPattern, item.CategoryNames, item.InstanceType, item.ExtendedProperties);
      piAssetElementTemplates.push(piAssetElementTemplate);
    }
  }

  return piAssetElementTemplates;
}

/**
* Return the Pi Asset Database Element Template object that matches the search parameters of webid or path.
* Must provide exactly 1 of the search parameters, will not accept multiple search parameters. 
* 
* @param {*} webId 
* @param {*} path 
* @returns 
*/
async function getPiElementTemplateByParam(webid, path) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `elementtemplates/${webid}?selectedFields=${assetElementTemplateSelectField}`;
  } else if (path) {
    url = `elementtemplates?path=${path}&selectedFields=${assetElementTemplateSelectField}`;
  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiAssetElementTemplate(data.WebId, data.Name, data.Path, data.BaseTemplate, data.NamingPattern, data.CategoryNames, data.InstanceType, data.ExtendedProperties);
}

// Pi Asset Element Template Attribute Functions

/**
 * Returns  Pi Asset Element Template Attribute of the WebId / Path provided
 * 
 * @param {*} webid 
 * @param {*} path 
 * @returns 
 */
async function getPiTemplateAttributeByParam(webid, path) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `attributetemplates/${webid}?selectedFields=${assetElementTemplateAttributeSelectField}`;
  } else if (path) {
    url = `attributetemplates?path=${path}&selectedFields=${assetElementTemplateAttributeSelectField}`;
  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiAssetElementTemplateAttribute(data.WebId, data.Name, data.Path, data.Type, data.DefaultUnitsName, data.DefaultUnitsNameAbbreviation, data.HasChildren);
}

/**
 * Returns all Pi Template Attributes of the provided Pi Template WebId as an array of PiAssetTemplateElementAttribute objects
 * 
 * @param {*} templateElementWebId 
 * @param {*} startIndex 
 * @param {*} maxItemCount 
 * @returns piAssetElementTemplateAttributes[]
 */
async function getPiTemplateAttributesByTemplateWebId(templateWebid, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const piTemplateAttributes = [];
  const url = `elementtemplates/${templateWebid}/attributetemplates?startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${assetElementTemplateAttributesSelectField}`;
  const response = await axios.get(url);

  for (const item of response.data.Items) {
    const piTemplateAttribute = new PiAssetElementTemplateAttribute(item.WebId, item.Name, item.Path, item.Type, item.DefaultUnitsName, item.DefaultUnitsNameAbbreviation, item.HasChildren);
    piTemplateAttributes.push(piTemplateAttribute);
  }

  return piTemplateAttributes;
}

// Pi Data Points Functions

/**
* 
* @param {*} piPointWebId 
* @returns PiDataPoint
*/
async function getPiPointByWebId(piPointWebId) {

  const url = `points/${piPointWebId}?${maxPiApiQueryResponseItems}&selectedFields=${dataPointSelectField}`;
  const response = await axios.get(url);
  const data = response.data;
  return new PiDataPoint(data.WebId, data.Name, data.Path, data.PointClass, data.PointType, data.EngineeringUnits, data.Zero, data.Span, data.Future);
}

/**
 * 
 * @param {*} queryString 
 * @param {*} startIndex 
 * @returns 
 */
async function getPiPointsByQuery(dataServerWebId, queryString, searchOptionVal, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const piDataPoints = [];
  const url = `points/search?dataserverwebid=${dataServerWebId}&query=${queryString}&searchOption=${searchOptionVal}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=${dataPointsSelectField}`;
  const response = await axios.get(url);

  if (response.data.Items) {
    for (const item of response.data.Items) {
      const piDataPoint = new PiDataPoint(item.WebId, item.Name, item.Path, item.PointClass, item.PointType, item.EngineeringUnits, item.Zero, item.Span, item.Future);
      piDataPoints.push(piDataPoint);
    }
  }

  return piDataPoints;
}

/**
* Returns the number of items returned from the PiPoint search query but not the items themselves. 
* Uses a similar query request as getPiPointsByQuery function but limits the response items to just 
* PiPoint:PointType. This reduces the load on the Pi Server and the network and so maxItem count can 
* usually be set higher than for other request types to reduce number of calls to the Pi server. 
* 
* @param {*} queryString 
* @param {*} startIndex 
* @returns 
*/
async function getNumberPiPointsByQuery(dataServerWebId, queryString, searchOptionVal, startIndex = 0, maxItemCount = maxPiApiQueryResponseItems) {

  const url = `points/search?dataserverwebid=${dataServerWebId}&query=${queryString}&searchOption=${searchOptionVal}&startIndex=${startIndex}&maxCount=${maxItemCount}&selectedFields=Items.Name`;
  const response = await axios.get(url);
  return response.data.Items.length;
}

// Pi Data Archive Server Functions

/**
   * Returns all Pi Data Servers known to the Pi Server as an array of PiDataServer objects.
   * @returns PiDataServer[]
   */
async function getPiDataServers() {

  const piDataServers = [];
  const url = `dataservers?maxCount=${maxPiApiQueryResponseItems}&selectedFields=${piServersSelectField}`;
  const response = await axios.get(url);

  if (response.data.Items) {
    for (const item of response.data.Items) {
      piDataServers.push(new PiDataServer(item.WebId, item.Name, item.Path, item.Id, item.IsConnected, item.ServerVersion, item.ServerTime));
    }
  }

  return piDataServers;
}

/**
 * Return the Pi Data Server object that matches the search parameters of webid, path or name.
 * Must provide exactly 1 of the search parameters, will not accept multiple search parameters. 
 * 
 * @param {*} webid 
 * @param {*} path 
 * @param {*} name 
 * @returns 
 */
async function getPiDataServerByParam(webid, path, name) {

  // verify number of search parameters set is exactly 1
  let setCnt = 0;
  for (const setVal of [webid, path, name]) {
    if (setVal) setCnt++;
  }
  if (setCnt !== 1) throw new Error("Must provide exactly one search parameter of 'webid' || 'path' || 'name'");

  // if search values validated then set request URL by search param. 
  let url;
  if (webid) {
    url = `dataservers/${webid}?maxCount=${maxPiApiQueryResponseItems}&selectedFields=${piServerSelectField}`;

  } else if (path) {
    url = `dataservers?path=${path}&maxCount=${maxPiApiQueryResponseItems}&selectedFields=${piServerSelectField}`;

  } else if (name) {
    url = `dataservers?name=${name}&maxCount=${maxPiApiQueryResponseItems}&selectedFields=${piServerSelectField}`;
  }

  const response = await axios.get(url);
  const data = response.data;
  return new PiDataServer(data.WebId, data.Name, data.Path, data.Id, data.IsConnected, data.ServerVersion, data.ServerTime);
}

// Pi Point Create / Write Data Functions

/**
 *  Create a PiPoint on the given Data Server
 * 
 * @param {*} dataServerWebId 
 * @param {*} pointName 
 * @param {*} pointDescription 
 * @param {*} pointClass 
 * @param {*} pointType 
 * @param {*} engineeringUnits 
 * @returns 
 */
async function createPiPoint(dataServerWebId, pointName, pointDescription, pointClass = "classic", pointType = "Float32", engineeringUnits = "") {

  // Check for mandatory params, error if not provided.
  if (!dataServerWebId) throw new Error("Must include dataServerWebId value in params.");
  if (!pointName) throw new Error("Must include piPointName value in params.");

  const url = `dataservers/${dataServerWebId}/points`;

  // Create the Post body for update PiPoint:
  const postBody =
  {
    "Name": pointName,
    "Descriptor": pointDescription,
    "PointClass": pointClass,
    "PointType": pointType,
    "EngineeringUnits": engineeringUnits,
    "Step": 0,
    "Future": 0,
    "DisplayDigits": -5
  };

  // Post the request body to OSI Pi request URL - Axios will pass back an error if not 2xx response
  const response = await axios.post(url, postBody);
  return response;
}

/**
 *  Write / update the PiPoinnt data value with given WebId.
 * 
 * @param {*} webid 
 * @param {*} timestamp 
 * @param {*} piPointValue 
 * @param {*} unitsAbrev 
 * @param {*} goodQuality 
 * @param {*} questionableQuality 
 * @returns 
 */
async function writePiPoint(webid, timestamp, piPointValue, unitsAbrev = "", goodQuality = true, questionableQuality = false) {

  // Check for mandatory params, error if not provided.
  if (!webid) throw new Error("Must provide 'webid' in request");
  if (!timestamp) throw new Error("Must provide 'timestamp' in request");
  // Need to check against undefined as value maybe 0.
  if (piPointValue==undefined || piPointValue==null) throw new Error("Must provide 'piPointValue' in request");

  const url = `streams/${webid}/value`;

  // Create the Post body for update PiPoint:
  const postBody = {
    "Timestamp": timestamp,
    "Value": piPointValue,
    "UnitsAbbreviation": unitsAbrev,
    "Good": goodQuality,
    "Questionable": questionableQuality
  };

  // Post the request body to OSI Pi request URL - Axios will pass back an error if not 2xx response
  const response = await axios.post(url, postBody );
  return response;
}

module.exports = {
  piWebSdkUpdateConfig,
  getPiApiRoot,
  getPiAssetServers,
  getPiAssetServerByParam,
  getPiAssetDatabaseByParam,
  getPiAssetDatabasesByAssetServerWebId,
  getPiAssetElementByParam,
  getNumberAssetElementsByQuery,
  getPiAssetElementsByQuery,
  getPiAssetElementsByAssetDatabaseWebId,
  getPiAssetElementChildrenByWebId,
  getPiAssetElementList,
  getPiAttributeByParam,
  getPiAssetAttributesByElementWebId,
  getPiElementTemplatesByAssetDatabaseWebId,
  getPiElementTemplateByParam,
  getPiTemplateAttributeByParam,
  getPiTemplateAttributesByTemplateWebId,
  getPiPointByWebId,
  getPiPointsByQuery,
  getNumberPiPointsByQuery,
  getPiDataServers,
  getPiDataServerByParam,
  createPiPoint,
  writePiPoint
};
