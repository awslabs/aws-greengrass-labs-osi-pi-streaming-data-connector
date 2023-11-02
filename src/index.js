/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 * "AWS IoT Greengrass managed edge connector to ingest real time OSI Pi data over Websockets into AWS IoT Sitewise."
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */


const { componentRoutes } = require("./routes/pubsubControlRoutes");
const awsPubSubController = require("./controllers/core/awsPubsubController");
const awsIoTShadowController = require("./controllers/core/awsIoTShadowController");
const { componentHumanName } = require("./configs/componentName");

// Init and run the component
const initRunAndAwaitComponent = async () => {

  try {
    
    console.log(`[INFO] ${componentHumanName} Initialization Started.....`);

    // Activate the Greengrass IPC connection and subscribe to configured topics
    await awsPubSubController.activatePubsubController();

    // AWS IoT Shadow manager to get (or created default) component configuration.
    await awsIoTShadowController.initIoTShadowConfig();

    console.log(`[INFO] ${componentHumanName}  Initialisation - COMPLETE`);
    awsPubSubController.publishFormattedMessage(componentRoutes.actionRoute, `${componentHumanName}  successfully initialized!`);

    // DEBUG ONLY: Print Greengrass Env Vars to emulate in IDE
    console.log(`[DEBUG]: Greengrass SVCUID: ${process.env.SVCUID}`);
    console.log(`[DEBUG]: Greengrass AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT: ${process.env.AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT}`);

    // Hold process until the Greengrass IPC disconnects
    await awsPubSubController.awaitConnectionClose();

  } catch (err) {
    // Log errors.  
    let errMsg = {
      "error": `ERROR Initializing ${componentHumanName}`,
      "message": err.toString()
    };
    console.log(errMsg);

  } finally {

    // Attempt Greengrass re-connect / re-run initRunAndAwaitComponent. 
    console.log("Connectivity was lost from the AWS Greengrass Device. Will wait 10 sec and attempt to re-establish");
    awsPubSubController.closeConnection();

    // Wait 10 sec and retry to re-init the component and the Greengrass connection. 
    await new Promise(resolve => { setTimeout(resolve, 10000); });
    await initRunAndAwaitComponent();
  }
  
};


// Init and run the component
(async () => {

  try {
    await initRunAndAwaitComponent();

  } catch (err) {

    console.log("[ERROR]: Running / Initaiting Component failed......");
    console.log(err);
  }

})();
