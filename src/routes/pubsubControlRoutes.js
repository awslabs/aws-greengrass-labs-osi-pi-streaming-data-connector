/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 * Provides mapping from MQTT Route (command) field to calling function across all 
 * AWS OSI Pi Integration Library components.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const { componentShortName } = require("../configs/componentName");

const componentRoutes = { 
  actionRoute : `osi-pi-${componentShortName}-action`,
  errorRoute : `osi-pi-${componentShortName}-error`
};

// Pubsub Controller control Routes
const pubsubControllerRoutes = { 
  actionRoute : "aws-pubsub-controller-action",
  errorRoute : "aws-pubsub-controller-error"
};

// IoT Shadow Controller control Routes
const iotShadowControllerRoutes = { 
  actionRoute : "aws-iot-shadow-controller-action",
  errorRoute : "aws-iot-shadow-controller-error"
};

// Secrets Manager Controller Control Routes
const secretManagerControllerRoutes = { 
  actionRoute : "aws-secerets-manager-controller-action",
  errorRoute : "aws-secerets-manager-controller-error"
};

// OSI Pi SDK Controller Control Routes
const osiPiSdkControllerRoutes = { 
  actionRoute : "osi-pi-sdk-controller-action",
  errorRoute : "osi-pi-sdk-controller-error"
};

// System Telemetry Controller Control Routes
const systemTelemetryControllerRoutes = { 
  actionRoute : "system-telemetry-controller-action",
  errorRoute : "system-telemetry-controller-error",
  systemTelemetryRoute : "system-telemetry-update"
};

module.exports = {
  componentRoutes,
  pubsubControllerRoutes,
  iotShadowControllerRoutes,
  secretManagerControllerRoutes,
  osiPiSdkControllerRoutes,
  systemTelemetryControllerRoutes
};
