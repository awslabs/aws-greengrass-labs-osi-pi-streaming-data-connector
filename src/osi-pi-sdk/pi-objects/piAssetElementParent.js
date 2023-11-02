/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiBaseObject = require("./piBaseObject");

class PiAssetElementParent extends PiBaseObject {

  constructor(webid, name, path) {

    super(webid, name, path);
  }
}

module.exports = PiAssetElementParent;
