/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

class PiServerRoot {

  constructor(links) {
    this.links = links;
  }

  getRootLinks() { return this.links; }

}

module.exports = PiServerRoot;
