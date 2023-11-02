/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const {
  IoTSiteWiseClient,

  ListAssetsCommand,
  DescribeAssetCommand,
  UpdateAssetModelCommand,
  CreateAssetCommand,
  DeleteAssetModelCommand,

  ListAssetModelsCommand,
  DescribeAssetModelCommand,
  CreateAssetModelCommand,
  DeleteAssetCommand,

  ListAssociatedAssetsCommand,
  AssociateAssetsCommand,
  DisassociateAssetsCommand,

  AssociateTimeSeriesToAssetPropertyCommand

} = require("@aws-sdk/client-iotsitewise");

const piWebIdMarkers = {
  "Template": "ET",
  "Element": "Em"
};

// AWSS Iot Sitewise Client and region
let region;
let sitewiseClient;

function osiPiAssetSyncUpdateConfig(regionCandidate) {

  console.log("[INFO] Initializing OSI Pi <> AWS IoT Sitewise Asset Framework Synchronization Manager.....");

  // Validate region - update to reportedCandidate if no errors.
  if (!(typeof regionCandidate === "string" && regionCandidate.length >= 9)) {
    throw new Error("'region' not provided or invalid value in OSI Pi Asset Framework Synchronization Manager config update");
  }

  // If Regin has changed (or had initial update) then re/initilise the Sitewise Client. 
  if (region !== regionCandidate) {
    // Create AWS Iot Sitewise Client
    region = regionCandidate;
    sitewiseClient = new IoTSiteWiseClient({ region: region });
  }
}

// Create Sitewise Objects Functions.

async function createSitewiseModelFromPiTemplate(piElementTemplate) {

  // Set Template fields amd Measurememts from Template Attributes.
  let input = {};
  input.assetModelName = piElementTemplate.getName();

  //Use Description field to store WebID as is only free from field that is in the list Model response.
  let piTemplateWebId = piElementTemplate.getWebId();
  input.assetModelDescription = piTemplateWebId;

  // Get all Pi Template attributes and add as Sitewise Model Properties
  input.assetModelProperties = [];
  const piTemplateAttributes = piElementTemplate.getAttributes();
  for (const piTemplateAttribute of piTemplateAttributes) {

    let assetModelProperty = {};
    assetModelProperty.name = piTemplateAttribute.getName();
    assetModelProperty.dataType = piTemplateAttribute.getSitewiseType();

    // Get unit if provided
    let unit = piTemplateAttribute.getDefaultUnitsNameAbbreviation();
    if (unit) assetModelProperty.unit = unit;

    assetModelProperty.type = {
      "measurement": {
        "processingConfig": {
          "forwardingConfig": {
            "state": "ENABLED"
          }
        }
      }
    };

    input.assetModelProperties.push(assetModelProperty);
  }

  const command = new CreateAssetModelCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error creating AWS IoT Sitewise model.", "response": response["$metadata"] });
  }

  let model = {};
  model.id = response.assetModelId;
  model.arn = response.assetModelArn;
  model.name = input.assetModelName;
  model.piTemplateWebId = piTemplateWebId;

  return model;
}

async function createSitewiseAssetFromPiElement(piElement, sitewiseModelId) {

  // Set Template fields amd Measurememts from Template Attributes.
  let input = {};
  input.assetModelId = sitewiseModelId;
  input.assetName = piElement.getName();
  //Use Description field to store WebID as is only spare field that is in the list Asset response.
  input.assetDescription = piElement.getWebId();

  const command = new CreateAssetCommand(input);
  const response = await sitewiseClient.send(command);

  let asset = {};
  asset.arn = response.assetArn;
  asset.id = response.assetId;
  asset.name = response.name;
  asset.piElementWebId = piElement.getWebId();
  return asset;
}

// Sitewise Model Getter / Helper Commands 

async function getSitewiseModelList() {

  // Create command input object
  let input = {};
  input.maxResults = 100;

  // Iterate through response nextToken untill have all avliable models from given Sitewise instance. 
  let sitewiseModels = {};
  do {
    // Send Sitewise ListAssetModelsCommand
    const command = new ListAssetModelsCommand(input);
    const response = await sitewiseClient.send(command);

    // Throw Error if not 2xx message response
    let httpStatusCode = response["$metadata"].httpStatusCode;
    if (httpStatusCode < 200 || httpStatusCode > 299) {
      throw new Error({ "Error": "Error reading AWS IoT Sitewise Model list.", "response": response["$metadata"] });
    }

    // Add returned Sitewise Asset Models to local object sitewiseModels with WebId as key. 
    for (const model of response.assetModelSummaries) {

      // Only add models that were created from OSI Pi templates and skip any user defined models.
      const piTemplateWebId = model.description;
      if (isSitewiseObjectOsiPiObjectType(piTemplateWebId, piWebIdMarkers.Template)) {
        // Here we use the Sitewise model description field to store the associated Pi Template WebId as only spare user definable field available
        sitewiseModels[piTemplateWebId] = {
          "arn": model.arn,
          "id": model.id,
          "name": model.name,
          "piTemplateWebId": piTemplateWebId
        };
      }
    }

    input.nextToken = response.nextToken;

  } while (input.nextToken);

  return sitewiseModels;
}

/**
 * Loads to cache and returns the full Sitewise model detail of the model Id given using the Describe SDK command
 * 
 * @param {*} modelId 
 * @param {*} excludeProperties 
 * @returns 
 */
async function getSitewiseModelByModelId(modelId, checkIsOsiPiGenerated = true, excludeProperties = false) {

  // Create command input object and send Sitewise DescribeAssetModelCommand
  let input = {};
  input.assetModelId = modelId;
  input.excludeProperties = excludeProperties;

  const command = new DescribeAssetModelCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error reading AWS IoT Sitewise model detail.", "response": response["$metadata"] });
  }

  // Create the model response. 
  let model = {};
  model.id = response.assetModelId;
  model.arn = response.assetModelArn;
  model.name = response.assetModelName;
  model.status = response.assetModelStatus;
  model.piTemplateWebId = response.assetModelDescription;
  model.hierarchies = response.assetModelHierarchies;
  model.properties = response.assetModelProperties;

  // Check this model is created from a Pi Template Sync and not a user defined object. 
  if (checkIsOsiPiGenerated && !isSitewiseObjectOsiPiObjectType(model.piTemplateWebId, piWebIdMarkers.Template)) {
    throw new Error(`Sitewise model ${model.assetModelName} was not created from a OSI Pi Template and not valid in this system`);
  }

  // Return model detail.
  return model;
}

/**
 * Updates a Sitewise Model with the values provided. 
 * 
 * @param {*} sitewiseModel 
 * @returns 
 */
async function updateSitewiseModel(sitewiseModel) {

  // Create command input object and send Sitewise DescribeAssetModelCommand
  let input = {};
  input.assetModelId = sitewiseModel.id;
  input.assetModelName = sitewiseModel.name;
  input.assetModelDescription = sitewiseModel.piTemplateWebId;
  input.assetModelProperties = sitewiseModel.properties;
  input.assetModelHierarchies = sitewiseModel.hierarchies;

  const command = new UpdateAssetModelCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error reading AWS IoT Sitewise model detail.", "response": response["$metadata"] });
  }

  // Return model details for async responses processing
  return sitewiseModel;
}

/**
 * Queries AWS IoT Sitewise for the requested modelId to determine if is on theh system.
 * Intended use is to check if a delete Model command has be completed. 
 * 
 * @param {*} modelId 
 * @param {*} checkIsOsiPiGenerated 
 * @returns 
 */
async function getSitewiseModelExistsByModelId(modelId, checkIsOsiPiGenerated = true) {

  try {
    // Request the model object to check if is available / on system
    await getSitewiseModelByModelId(modelId, checkIsOsiPiGenerated);

    // Return true if request doesn't throw any exceptions
    return true;

  } catch (err) {
    // Return false if ResourceNotFoundException
    if (err.name === "ResourceNotFoundException") {
      return false;
    } else {
      throw new Error(err);
    }
  }
}

async function deleteSitewiseModelByModelId(sitewiseModel) {

  // Create command input object and send Sitewise DeleteAssetModelCommand
  let input = {};
  input.assetModelId = sitewiseModel.id;

  const command = new DeleteAssetModelCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error deleting AWS IoT Sitewise Model.", "response": response["$metadata"] });
  }

  return sitewiseModel.piTemplateWebId;

}

// Sitewise Asset Getter / Helper Commands  

async function getSitewiseAssetListByModelId(assetModelId) {

  // Create command input object and send Sitewise ListAssetsCommand
  let input = {};
  input.maxResults = 100;
  input.assetModelId = assetModelId;

  // Iterate through response nextToken untill have all avliable models from given Sitewise instance. 
  let sitewiseAssets = {};

  // Iterate over this model Id for all dependent assets.
  do {

    const command = new ListAssetsCommand(input);
    const response = await sitewiseClient.send(command);

    // Throw Error if not 2xx message response
    let httpStatusCode = response["$metadata"].httpStatusCode;
    if (httpStatusCode < 200 || httpStatusCode > 299) {
      throw new Error({ "Error": "Error reading AWS IoT Sitewise Asset list.", "response": response["$metadata"] });
    }

    // Add returned Sitewise Asset Models to local object sitewiseModels with WebId as key. 
    for (const asset of response.assetSummaries) {

      // Only add models that were created from OSI Pi templates and skip any user defined models.
      const piElementWebId = asset.description;
      if (isSitewiseObjectOsiPiObjectType(piElementWebId, piWebIdMarkers.Element)) {
        // Here we use the Sitewise model description field to store the associated Pi Template WebId as only spare user definable field available
        sitewiseAssets[piElementWebId] = {
          "arn": asset.arn,
          "id": asset.id,
          "name": asset.name,
          "assetModelId": asset.assetModelId
        };
      }
    }

    input.nextToken = response.nextToken;

  } while (input.nextToken);

  return sitewiseAssets;
}

/**
* Loads to cache and returns the full Sitewise model detail of the model Id given using the Describe SDK command
* 
* @param {*} modelId 
* @param {*} excludeProperties 
* @returns 
*/
async function getSitewiseAssetByAssetId(assetId, checkIsOsiPiGenerated = true, excludeProperties = false) {

  // Create command input object and send Sitewise DescribeAssetCommand
  let input = {};
  input.assetId = assetId;
  input.excludeProperties = excludeProperties;

  const command = new DescribeAssetCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error reading AWS IoT Sitewise Asset.", "response": response["$metadata"] });
  }

  // Create the model response. 
  let asset = {};
  asset.id = response.assetId;
  asset.arn = response.assetArn;
  asset.name = response.assetName;
  asset.assetModelId = response.assetModelId;
  asset.piElementWebId = response.assetDescription;
  asset.status = response.assetStatus;
  asset.hierarchies = response.assetHierarchies;
  asset.properties = response.assetProperties;

  // Check this model is created from a Pi Template Sync and not a user defined object. 
  if (checkIsOsiPiGenerated && !isSitewiseObjectOsiPiObjectType(asset.piElementWebId, piWebIdMarkers.Element)) {
    throw new Error(`Sitewise Asset ${asset.name} was not created from a OSI Pi Asset Element and not valid in this system`);
  }

  // Return model detail.
  return asset;
}

/**
 *  * Returns the requested Sitewise Asset status:
 * i.e: ACTIVE, CREATING, DELETING, FAILED, PROPAGATING, UPDATING
 * 
 * @param {*} modelId 
 * @param {*} checkIsOsiPiGenerated 
 * @returns 
 */
async function getSitewiseAssetStatusByAssetlId(assetId, checkIsOsiPiGenerated = true) {

  const asset = await getSitewiseAssetByAssetId(assetId, checkIsOsiPiGenerated);
  return asset.status.state;
}

/**
 * Queries AWS IoT Sitewise for the requested assetId to determine if is on the system.
 * Intended use is to check if a delete Asset command has be completed. 
 * 
 * @param {*} modelId 
 * @param {*} checkIsOsiPiGenerated 
 * @returns 
 */
async function getSitewiseAssetExistsByAssetlId(assetId, checkIsOsiPiGenerated = true) {

  try {
    // Request the Asset object to check if is available / on system
    await getSitewiseAssetByAssetId(assetId, checkIsOsiPiGenerated);

    // Return true if request doesn't throw any exceptions
    return true;

  } catch (err) {
    // Return false if ResourceNotFoundException
    if (err.name === "ResourceNotFoundException") {
      return false;
    } else {
      throw new Error(err);
    }
  }
}

async function deleteSitewiseAssetByAssetId(sitewiseAsset) {

  // Create command input object and send Sitewise DeleteAssetCommand
  let input = {};
  input.assetId = sitewiseAsset.id;

  const command = new DeleteAssetCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error deleting AWS IoT Sitewise Asset.", "response": response["$metadata"] });
  }

  return sitewiseAsset.piElementWebId;

}

// Sitewise Asset Association Getter / Helper Commands  

async function getSitewiseAssetAssociatedChildAssets(assetId, hierarchyId) {

  // Create command input object and send Sitewise DescribeAssetModelCommand
  let input = {};
  input.assetId = assetId;
  input.hierarchyId = hierarchyId;

  const command = new ListAssociatedAssetsCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error Listing Sitewise Child Assets.", "response": response["$metadata"] });
  }

  return response.assetSummaries;

}

async function associateSitewiseAssets(assetId, childAssetId, hierarchyId) {

  // Create command input object and send Sitewise DescribeAssetModelCommand
  let input = {};
  input.assetId = assetId;
  input.childAssetId = childAssetId;
  input.hierarchyId = hierarchyId;

  const command = new AssociateAssetsCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error Associating Sitewise Assets.", "response": response["$metadata"] });
  }
}

async function disassociateSitewiseChildAsset(assetId, childAssetId, hierarchyId) {

  // Create command input object and send Sitewise DescribeAssetModelCommand
  let input = {};
  input.assetId = assetId;
  input.childAssetId = childAssetId;
  input.hierarchyId = hierarchyId;

  const command = new DisassociateAssetsCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error Disassociating Sitewise Assets.", "response": response["$metadata"] });
  }
}

// Sitewise Assset Property Data Stream Association Getter / Helper Commands 

async function associateTimeSeriesToSitewiseAssetProperty(assetId, propertyId, streamAlias) {

  // Create command input object and send Sitewise DescribeAssetModelCommand
  let input = {};
  input.assetId = assetId;
  input.propertyId = propertyId;
  input.alias = streamAlias;

  const command = new AssociateTimeSeriesToAssetPropertyCommand(input);
  const response = await sitewiseClient.send(command);

  // Throw Error if not 2xx message response.
  let httpStatusCode = response["$metadata"].httpStatusCode;
  if (httpStatusCode < 200 || httpStatusCode > 299) {
    throw new Error({ "Error": "Error Associating Sitewise Assets Property to TimeSeries Alias.", "response": response["$metadata"] });
  }
}

// Helpers.

/**
* In this system we use the Sitewise Objects description field to store a reference to the Pi Asset Element WebId as
* is the only user defined field avliable and only Full format Pi WebIds are used.
* 
* In OSI Pi, Full format WebIds for Asset Element ojbects are a string that is in the format:
* F[Ver#][2 Char Marker Field]xxxxxx.

* Tgis finctuion checks the Sitewise Object description field has this pattern as a basic validation to identify Sitewise 
* models that were created by a previous OSI Pi Asset sync and not a seperate user defined models. 
 
* @param {*} assetModel 
* @returns 
*/
function isSitewiseObjectOsiPiObjectType(sitewiseDescriptionField, piObjectWebIdMarker) {

  return typeof sitewiseDescriptionField === "string" &&
    sitewiseDescriptionField.length > 5 &&
    sitewiseDescriptionField.startsWith("F") &&
    sitewiseDescriptionField.substring(2, 4) === piObjectWebIdMarker;
}

module.exports = {
  osiPiAssetSyncUpdateConfig,

  getSitewiseModelList,
  getSitewiseModelByModelId,
  getSitewiseModelExistsByModelId,
  updateSitewiseModel,
  createSitewiseModelFromPiTemplate,
  deleteSitewiseModelByModelId,

  getSitewiseAssetListByModelId,
  getSitewiseAssetByAssetId,
  getSitewiseAssetStatusByAssetlId,
  getSitewiseAssetExistsByAssetlId,
  createSitewiseAssetFromPiElement,
  deleteSitewiseAssetByAssetId,

  getSitewiseAssetAssociatedChildAssets,
  associateSitewiseAssets,
  disassociateSitewiseChildAsset,

  associateTimeSeriesToSitewiseAssetProperty
};
