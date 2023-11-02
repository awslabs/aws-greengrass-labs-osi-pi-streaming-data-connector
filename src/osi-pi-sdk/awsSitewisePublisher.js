/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const { IoTSiteWiseClient, BatchPutAssetPropertyValueCommand } = require("@aws-sdk/client-iotsitewise");

// Sitewise data publish queue.
const sitewisePublishQueue = new Map();

// AWS IoT Sitewise Client
let sitewiseClient;

// Sitewise publish and memory monitor timerId.
let publishTimerId;

// Region and SiteWise publish batching params
let region, propertyAliasBatchSize, propertyValueBatchSize, propertyPublishMaxAgeSecs;

// Sitewise telemetry params.
let telemetry = {};
telemetry.numPublishes = 0;
telemetry.receivedOsiPiPointsCount = 0;
telemetry.publishedPropertyAlias = 0;
telemetry.publishedPropertyValues = 0;
telemetry.sitewisePublishErrorCount = 0;
telemetry.sitewisePublishErrorReceived = {};

// DEBUG ONLY:
//setInterval(debugLogSitewisePublishQueue, 10000);

/**
 * Update the local config parameters and initialize Sitewise Client.
 * If region changed, the publish queue is flushed and the Sitewise client is re-initiated. 
 * 
 * @param {*} region 
 * @param {*} sitewiseMaxTqvPublishRate 
 * @param {*} propertyAliasBatchSize 
 * @param {*} propertyValueBatchSize 
 */
function sitewisePublisherUpdateConfig(regionCandidate, awsSitewisePublisherConfig) {

  console.log("[INFO] Initializing AWS IoT Sitewise Data Publisher Configuration.....");

  // Validate region - update to reportedCandidate if no errors.
  if (!(typeof regionCandidate === "string" && regionCandidate.length >= 9)) {
    throw new Error("'region' not provided or invalid value in Sitewise Publisher config update");
  }

  // Validate sitewiseMaxTqvPublishRate - update to reportedCandidate if no errors.
  const sitewiseMaxTqvPublishRate = awsSitewisePublisherConfig.sitewiseMaxTqvPublishRate;
  if (isNaN(sitewiseMaxTqvPublishRate) || sitewiseMaxTqvPublishRate < 1000 || sitewiseMaxTqvPublishRate > 100000) {
    throw new Error("'sitewiseMaxTqvPublishRate' is not provided or invalid value (int: 1000 - 100000)");
  }

  // Validate propertyAliasBatchSizeConf - update to reportedCandidate if no errors.
  const propertyAliasBatchSizeCandidate = awsSitewisePublisherConfig.sitewisePropertyAliasBatchSize;
  if (isNaN(propertyAliasBatchSizeCandidate) || propertyAliasBatchSizeCandidate < 1 || propertyAliasBatchSizeCandidate > 10) {
    throw new Error("'sitewisePropertyAliasBatchSize' is not provided or invalid value (int: 1 - 10)");
  }
  propertyAliasBatchSize = propertyAliasBatchSizeCandidate;

  // Validate propertyValueBatchSizeConf - update to reportedCandidate if no errors.
  const propertyValueBatchSizeCandidate = awsSitewisePublisherConfig.sitewisePropertyValueBatchSize;
  if (isNaN(propertyValueBatchSizeCandidate) || propertyValueBatchSizeCandidate < 1 || propertyValueBatchSizeCandidate > 10) {
    throw new Error("'sitewisePropertyValueBatchSize' is not provided or invalid value (int: 1 - 10)");
  }
  propertyValueBatchSize = propertyValueBatchSizeCandidate;

  // Validate propertyPublishMaxAgeSecsConf - update to reportedCandidate if no errors.
  const propertyPublishMaxAgeSecsCandidate = awsSitewisePublisherConfig.sitewisePropertyPublishMaxAgeSecs;
  if (isNaN(propertyPublishMaxAgeSecsCandidate) || propertyPublishMaxAgeSecsCandidate < 30 || propertyPublishMaxAgeSecsCandidate > 360) {
    throw new Error("'sitewisePropertyPublishMaxAgeSecs' is not provided or invalid value (int: 30 - 3600)");
  }
  propertyPublishMaxAgeSecs = propertyPublishMaxAgeSecsCandidate;

  // If changing or initializing region then clear existing queues and reinitialize Sitewise Client.
  if (region !== regionCandidate) {
    sitewiseClient = null;
    region = regionCandidate;
    sitewisePublishQueue.clear;
    sitewiseClient = new IoTSiteWiseClient({ region: region });
  }
  region = regionCandidate;

  // Configure Sitewise publish interval timer to publish up to a calculated maximum TQV rate. 
  // Practical limit of timer is 1mS. This puts a theoretical limit on publish rate dependent on min batch size.
  const publishInterval = 1000 / (sitewiseMaxTqvPublishRate / (propertyAliasBatchSize * propertyValueBatchSize));

  // Clear any previous publish timer and reinitialize
  if (publishTimerId) clearInterval(publishTimerId);
  publishTimerId = setInterval(publishToSitewise, publishInterval);
  console.log(`[INFO] Setting Min AWS IoT Sitewise Publish Timer Interval to: ${publishInterval} mS`);

  console.log("[INFO] Initializing AWS IoT Sitewise Data Publisher Configuration - COMPLETE.");
}

/**
 * Creates / resets telemetry metrics to 0
 */
function getSitewiseTelemetryData(resetTelemetryCounts = true) {

  // Set dynamic sitewiseQueuedPropAlias value and return telemetry
  telemetry.sitewiseQueuedPropAlias = sitewisePublishQueue.size;

  // Get a deep copy of the telemetry object in current state
  const telemetryClone = { ...telemetry };
  telemetryClone.sitewisePublishErrorReceived = { ...telemetry.sitewisePublishErrorReceived };

  // Reset telemetery counts / objects.
  if (resetTelemetryCounts) {
    telemetry.numPublishes = 0;
    telemetry.receivedOsiPiPointsCount = 0;
    telemetry.publishedPropertyAlias = 0;
    telemetry.publishedPropertyValues = 0;
    telemetry.sitewisePublishErrorCount = 0;
    telemetry.sitewisePublishErrorReceived = {};
  }

  return telemetryClone;
}

/**
 * Accepts OSI Pi WebSocket receive message format as specified by Pi Channel Data at:
 * https://docs.aveva.com/bundle/pi-web-api-reference/page/help/topics/channels.html
 * 
 * Formats each PiPoint item to an AWS IoT Sitewise BatchPutAssetPropertyValueCommandInput model:
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-iotsitewise/classes/batchputassetpropertyvaluecommand.html
 * 
 * Then stores in the sitewisePublishQueue for the Sitewise publish timer to pick up once it meets publish batch configurations.
 * If any publish conditions are met, the publisher will batch as many data points as Sitewise limits will allow above batch configurations set.
 * 
 * Note: Javascript doesn't distinguish between Int’s and Double's so inferred data type for any numerical value is sent as a Double to Sitewise.
 * 
 * @param {*} piDataPointObject 
 */
function queuePiData(piDataPointObject) {

  try {

    if (!piDataPointObject.Items)throw new Error("Received unexpected data format from OSI Pi Server");

    // Format the OSI Pi WebSocket channel data format to AWS IoT Sitewise BatchPutAssetPropertyValueCommandInput model
    for (const piDataItem of piDataPointObject.Items) {

      // if this propertyAlias exists in sitewisePublishQueue then assign to the given sitewiseEntry, else create new sitewiseEntry.
      const sitewiseEntry = sitewisePublishQueue.get(piDataItem.Path);
      const propValues = getSitewiseFormattedPropertyValues(piDataItem.Items);
      telemetry.receivedOsiPiPointsCount += propValues.length;  // Update PiPoint received telemetry value. 
      if (sitewiseEntry) {
        sitewiseEntry.propertyValues.push(...propValues);

      } else {
        const newSitewiseEntry = {};
        newSitewiseEntry.propertyAlias = piDataItem.Path;
        newSitewiseEntry.propertyValues = propValues;
        sitewisePublishQueue.set(piDataItem.Path, newSitewiseEntry);
      }
    }

  } catch (err) {
    console.log("[ERROR]: Queuing OSI PI Data Points to Sitewise Publisher. Error");
    console.log(err);
  }
}

function deletePiDataQueue(deletePercent) {

  const queueSize = sitewisePublishQueue.size;
  const deleteNumKeys = Math.round(queueSize * (deletePercent / 100));

  console.log(`[WARN] Deleting ${deletePercent}% or ${deleteNumKeys} of ${queueSize} keys from Sitewise Publish Queue`);

  if (deletePercent === 100){
    sitewisePublishQueue.clear();
    return;
  }

  let cnt = 0;
  for (const piEntry of sitewisePublishQueue.keys()) {
    sitewisePublishQueue.delete(piEntry);
    cnt += 1;
    if (cnt >= deleteNumKeys) break;
  }
}

/**
 * Reformats OSI Pi WebSocket channel data to Time Quality Value (TQV) format suitable for upload to AWS IoT Sitewise. 
 * 
 * @param {*} propertyValues 
 * @returns 
 */
function getSitewiseFormattedPropertyValues(piPointDataItems) {

  const propertyValues = [];

  for (const piPointDataItem of piPointDataItems) {

    // Init the Sitewise propertyValue object
    const propertyValue = {};
    propertyValue.value = {};
    propertyValue.timestamp = {};

    // TQV: Value
    // Get the PiPoint data value
    const dataPoint = piPointDataItem.Value;

    // TQV: Type
    // Infer the PiPoint data type and set Sitewise input value object

    //Note:
    // If is number, return Double as can't determine if is double or int in JS which only stores floats. 
    const dataType = typeof dataPoint;
    switch (dataType) {
      case "number":
        propertyValue.value.doubleValue = dataPoint;
        break;

      case "string":
        propertyValue.value.stringValue = dataPoint;
        break;

      case "boolean":
        propertyValue.value.booleanValue = dataPoint;
        break;

      default:
        throw new Error(`Received unknown data type ${dataType} - value: ${JSON.stringify(dataPoint)}`);
    }

    // TQV: Time
    // Get the OSI Pi String formatted DateTime to Sitewise 10-digit (Second granularity) and nanoSecond offset timestamp.

    const fullTimestmp = new Date(piPointDataItem.Timestamp).getTime();
    const secondTimestmp = Math.floor(fullTimestmp / 1000);
    // Timestamp is to 100's of Nanoseconds. Get the Nano second offset from the fullTimestamp. 
    const nsOffsetTimestmp = fullTimestmp % 1000 * 100;

    propertyValue.timestamp.timeInSeconds = secondTimestmp;
    propertyValue.timestamp.offsetInNanos = nsOffsetTimestmp;

    // TQV: Quality
    // OSI Pi doesn't give BAD as an option so anything other than GOOD is marked as UNCERTAIN.
    propertyValue.quality = (piPointDataItem.Good) ? "GOOD" : "UNCERTAIN";

    // Push to array and repeat! 
    propertyValues.push(propertyValue);
  }

  return propertyValues;
}

/**
   * Publish / upload FiFo TQVs to Sitewise.
   * @returns 
   */
async function publishToSitewise() {

  try {

    // Get the data entries to publish and remove from the Queue.
    const publishEntries = getNextSitewisePublishEntries();

    // If publish batching conditions aren’t met just return. 
    if (!publishEntries) return;

    //==========================================
    // Publish to Sitewise.
    //==========================================

    // Crete publish command and publish data batch data,.
    const command = new BatchPutAssetPropertyValueCommand({ "entries": publishEntries });
    const response = await sitewiseClient.send(command);

    // Update Sitewise Publish telemetry
    // TODO: Need to remove from telemetry count if error was returned in errorEntries
    telemetry.numPublishes += 1;
    telemetry.publishedPropertyAlias += publishEntries.length;

    for (const publishedPropAlias of publishEntries) {
      telemetry.publishedPropertyValues += publishedPropAlias.propertyValues.length;
    }

    // Record any errors from the Sitewise Publish command. 
    const errorEntries = response.errorEntries;
    if (Object.keys(errorEntries).length > 0) {

      //  Log Sitewise errors to console. 
      debugLogSitewisePublishErrors(errorEntries);

      for (const errorEntry of errorEntries) {

        telemetry.sitewisePublishErrorCount += 1;
        for (const error of errorEntry.errors) {
          // Set the error code and error message.
          telemetry.sitewisePublishErrorReceived[error.errorCode] = error.errorMessage;
        }
      }
    }

  } catch (err) {
    console.log("[ERROR]: Error publishing to AWS IoT Sitewise - Error:");
    console.log(err.toString());
  }
}

/**
   * Returns Pi data entries that meet the publish criteria from SiteWise Publish queue.
   * Re-queues any to back of list that are processed but with data points remaining. 
   * 
   * Returns False if publish criteria not met.
   * 
   * @returns 
   */
function getNextSitewisePublishEntries() {

  const publishEntries = [];
  let isAnyEntryAged = false;

  // Calculate timestamp to trigger publish based on data point age.
  const agedPublishTimestamp = Math.round(Date.now() / 1000) - propertyPublishMaxAgeSecs;

  for (const publishCandidate of sitewisePublishQueue.values()) {

    // Evaluate data entry against publish criteria of entry in sitewisePublishQueue 
    const isAged = publishCandidate.propertyValues[0].timestamp.timeInSeconds <= agedPublishTimestamp;
    const isPropCnt = publishCandidate.propertyValues.length >= propertyValueBatchSize;

    // Continue to next iteration if publishCandidate doesn't meet publish criteria.
    if (!(isPropCnt || isAged)) continue;

    // Update isAnyEntryAged value.
    isAnyEntryAged = isAged || isAnyEntryAged;

    // Deep copy the publishCandidate with up to 10 data values as is the Sitewise publish command limit.
    const publishEntry = {};
    publishEntry.entryId = Math.random().toString(36).slice(2);
    publishEntry.propertyAlias = publishCandidate.propertyAlias;
    publishEntry.propertyValues = publishCandidate.propertyValues.splice(0, 10);

    // Push the data entry to the publish array.
    publishEntries.push(publishEntry);

    // Dequeue the publishCandidate from head of the Sitewise publish queue after has been processed.
    sitewisePublishQueue.set(publishCandidate.propertyAlias, null);
    sitewisePublishQueue.delete(publishCandidate.propertyAlias);

    // If the publishCandidate has property values remaining then requeue to back of the list.
    if (publishCandidate.propertyValues.length > 0) {
      sitewisePublishQueue.set(publishCandidate.propertyAlias, publishCandidate);
    }

    // Break loop and return if have reached propertyAliasBatchSize number of dataEntries
    if (publishEntries.length >= propertyAliasBatchSize) return publishEntries;
  }

  // If any aged entries found then return even if not meeting batch criteria.
  if (isAnyEntryAged) return publishEntries;

  // Otherwise if not required batch number of entries found then return false. 
  return false;
}

function debugLogSitewisePublishErrors(errorEntries, publishFullErrorTimestamps = false) {

  console.log("\n\n###[DEBUG LOG]: Sitewise Publish errorEntries: ");

  // Log Sitewise Publish Error Response. 
  for (const errorEntry of errorEntries) {
    console.log(`entryId: ${errorEntry.entryId}`);

    for (const error of errorEntry.errors) {
      // Set or reset the error code or message.)
      console.log(`errorCode: ${error.errorCode}`);
      console.log(`errorMessage: ${error.errorMessage}`);

      if (publishFullErrorTimestamps) {
        for (const timestamp of error.timestamps) {
          console.log("timestamp:");
          console.log(timestamp);
        }
      }
    }
  }
}

function debugLogSitewisePublishEntries(publishEntries) {

  console.log("\n\n###[DEBUG LOG]: Publish to AWS IoT Sitewise entries");

  for (const entry of publishEntries) {
    console.log(`\nEntryID: ${entry.entryId}`);
    console.log(`PropertyAlias: ${entry.propertyAlias}`);

    let cnt = 1;
    console.log("PropertyValues:");
    for (const value of entry.propertyValues) {
      console.log(`Entry ${cnt}: Timestamp: ${value.timestamp.timeInSeconds} - Value: ${value.value.doubleValue}`);
      cnt += 1;
    }
  }
}

function debugLogSitewisePublishEntriesTotals(publishEntries) {

  if (!publishEntries.length) return;

  let propValCnt = 0;
  const numberEntries = publishEntries.length;
  for (const publishEntry of publishEntries) {
    propValCnt += publishEntry.propertyValues.length;
  }

  console.log(`\n\n###[DEBUG LOG]: Sitewise Publish entry Stats - ${Date.now()}: Property Alisas: ${numberEntries} - Total Property Values: ${propValCnt}`);

}

function debugLogQueuePiDataUpdate(piDataPointObject) {

  let numPiTags = piDataPointObject.Items.length;
  let totalPiPoints = 0;

  for (const piDataItem of piDataPointObject.Items) {
    totalPiPoints += piDataItem.Items.length;
  }

  console.log(`\n\n###[DEBUG LOG]: Queued OSI PiPoint entry - ${Date.now()}: Total Tags: ${numPiTags} - Total Data Points: ${totalPiPoints}`);

}

function debugLogSitewisePublishQueue() {

  let toalQueuedDataPoints = 0;
  const queuedTags = sitewisePublishQueue.size;
  const queuedDataPointDistribution = {};

  sitewisePublishQueue.forEach((sitewiseEntry) => {

    const numPropVals = sitewiseEntry.propertyValues.length;
    toalQueuedDataPoints += numPropVals;

    // If this number if properties doesn't have a listed distribution, then initialize. 
    if (!queuedDataPointDistribution[numPropVals]) queuedDataPointDistribution[numPropVals] = 0;

    // + 1 to this distribution.
    queuedDataPointDistribution[numPropVals] += 1;

  });

  console.log(`\n\n###[DEBUG LOG]: Sitewise Queue - ${Date.now()}: Queued Tags: ${queuedTags} - Queued Data Points: ${toalQueuedDataPoints} - Tag Data Point Distribution:`);
  console.log(queuedDataPointDistribution);

}

module.exports = {
  sitewisePublisherUpdateConfig,
  getSitewiseTelemetryData,
  queuePiData,
  deletePiDataQueue
};


