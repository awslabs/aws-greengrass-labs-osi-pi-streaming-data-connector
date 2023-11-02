/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const v8 = require("node:v8");
const topics = require("../../configs/pubsubTopics");
const { systemTelemetryControllerRoutes } = require("../../routes/pubsubControlRoutes");

let telemetryTimerId, telemetryUpdateSecs;
let cpuUsage = process.cpuUsage();
let processTime = process.hrtime();

function setTelemetryUpdateInterval(systemTelemetryConfig) {

  console.log("[INFO] Updating System and Telemetry Publish Interval....");

  // Set and basic validation of telemetryUpdateSecs
  const telemetryUpdateSecsCandidate = systemTelemetryConfig.telemetryUpdateSecs;
  if (isNaN(telemetryUpdateSecsCandidate) || telemetryUpdateSecsCandidate < 5 || telemetryUpdateSecsCandidate > 60) {
    throw new Error("'telemetryUpdateSecs' not provided or is an invalid value (int: 5 - 60)");
  }
  telemetryUpdateSecs = telemetryUpdateSecsCandidate;

  // If telemetryUpdateIntervalSec validated then trigger a new timer. 
  if (telemetryTimerId) clearTimeout(telemetryTimerId);
  telemetryTimerId = setInterval(publishTelemetery, telemetryUpdateSecs * 1000);

  console.log("[INFO] Updating System and Telemetry Publish Interval - COMPLETE");

}

function publishTelemetery() {

  try {

    //========================================
    // Add System CPU / Memory usage stats to telemetry message
    const message = {};
    message.timestamp = Date.now();

    // System / process memory stats
    const memStats = v8.getHeapStatistics();
    message.system = memStats;
    message.system.memoryPercentUsed = ((memStats.total_heap_size / memStats.heap_size_limit) * 100).toFixed(2);

    cpuUsage = process.cpuUsage(cpuUsage);
    processTime = process.hrtime(processTime);

    const elapTimeMS = secNSec2ms(processTime);
    const elapUserMS = secNSec2ms(cpuUsage.user);
    const elapSystMS = secNSec2ms(cpuUsage.system);
    const cpuPercent = Math.round(100 * (elapUserMS + elapSystMS) / elapTimeMS);

    message.system.cpuUsage = cpuUsage;
    message.system.cpuUsage.percent = cpuPercent;

    //========================================
    // Add AWS IoT Sitewise Publisher Telemetry for data producer components. 
    message.sitewise = {};
    message.osipi = {};
    const sitewiseTelemetry = getSitewiseTelemetryData(true);

    // Calculate and format metrics in per/second values based on averaging telemetry UpdateMs

    if (!isNaN(sitewiseTelemetry.receivedOsiPiPointsCount)) {
      const receivedOsiPiPointsCount = sitewiseTelemetry.receivedOsiPiPointsCount / telemetryUpdateSecs;
      message.osipi.receivedPiPointsPerSec = receivedOsiPiPointsCount.toFixed(2);
    }

    if (!isNaN(sitewiseTelemetry.numPublishes)) {
      const sitewisePublishPerSec = sitewiseTelemetry.numPublishes / telemetryUpdateSecs;
      message.sitewise.publishPerSec = sitewisePublishPerSec.toFixed(2);
    }

    if (!isNaN(sitewiseTelemetry.publishedPropertyAlias)) {
      const sitewisePropAliasPerSec = sitewiseTelemetry.publishedPropertyAlias / telemetryUpdateSecs;
      message.sitewise.propAliasPerSec = sitewisePropAliasPerSec.toFixed(2);
    }

    if (!isNaN(sitewiseTelemetry.publishedPropertyValues)) {
      const sitewisePropValuesPerSec = sitewiseTelemetry.publishedPropertyValues / telemetryUpdateSecs;
      message.sitewise.propValuesPerSec = sitewisePropValuesPerSec.toFixed(2);
    }

    if (!isNaN(sitewiseTelemetry.sitewiseQueuedPropAlias)) {
      message.sitewise.queuedPropAlias = sitewiseTelemetry.sitewiseQueuedPropAlias;
    }

    if (!isNaN(sitewiseTelemetry.publishedPropertyValues) && !isNaN(sitewiseTelemetry.publishedPropertyAlias)) {
      let sitewisePropValuesPerAlias = sitewiseTelemetry.publishedPropertyValues / sitewiseTelemetry.publishedPropertyAlias;
      if (isNaN(sitewisePropValuesPerAlias)) sitewisePropValuesPerAlias = 0;  // If publishedPropertyAlias == 0.
      message.sitewise.propValuesPerAlias = sitewisePropValuesPerAlias.toFixed(2);
    }

    if (!isNaN(sitewiseTelemetry.sitewisePublishErrorCount)) {
      message.sitewise.publishErrorCount = sitewiseTelemetry.sitewisePublishErrorCount;
    }

    if (typeof sitewiseTelemetry.sitewisePublishErrorReceived === "object") {
      const errsLen = Object.keys(sitewiseTelemetry.sitewisePublishErrorReceived).length;
      if (errsLen > 0) message.sitewise.publishErrorReceived = sitewiseTelemetry.sitewisePublishErrorReceived;
    }

    // publish telemetry message.
    publishFormattedMessage(systemTelemetryControllerRoutes.systemTelemetryRoute, message, 200, topics.telemetryUpdateTopic, false);

  } catch (err) {
    publishErrorResponse(systemTelemetryControllerRoutes.errorRoute, err);
  }

}

// CPU clock timer helpers 
function secNSec2ms(secNSec) {
  if (Array.isArray(secNSec)) {
    return secNSec[0] * 1000 + secNSec[1] / 1000000;
  }
  return secNSec / 1000;
}

module.exports = {
  setTelemetryUpdateInterval
};

// No easy way to remove circular dependencies between PubSub Tx and Rx consumers on the 
// same Greengrass client so add require statements after all exports completed.
const { publishFormattedMessage, publishErrorResponse } = require("./awsPubsubController");
const { getSitewiseTelemetryData } = require("../../osi-pi-sdk/awsSitewisePublisher");


