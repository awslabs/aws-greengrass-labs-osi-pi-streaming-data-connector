/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

class PiBaseObject {

  constructor(webid, name, path) {
    this.webid = webid;
    this.name = name;
    this.path = path;
  }

  getWebId() {
    return this.webid;
  }

  getName() {
    return this.name;
  }

  getPath() {
    return this.path;
  }
}

module.exports = PiBaseObject;
