/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiAssetElementParent = require("./piAssetElementParent");

class PiAssetDatabase extends PiAssetElementParent {

  constructor(webid, name, path) {
    super(webid, name, path);
  }
}

module.exports = PiAssetDatabase;
