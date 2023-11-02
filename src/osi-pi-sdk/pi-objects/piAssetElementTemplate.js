/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiBaseObject = require("./piBaseObject");

class PiAssetElementTemplate extends PiBaseObject {

  constructor(webid, name, path, baseTemplate, namingPattern, categoryNames, instanceType, extendedProperties) {

    super(webid, name, path);

    this.baseTemplate = baseTemplate;
    this.namingPattern = namingPattern;
    this.categoryNames = categoryNames;
    this.instanceType = instanceType;
    this.extendedProperties = extendedProperties;

    // Attributes are queried separately in the Pi WebApi.
    this.attributes = [];
  }

  //==============================================
  // Setters
  setAttributes(attributes) { this.attributes = attributes; }

  //==============================================
  // Getters
  getBaseTemplate() { return this.baseTemplate; }
  getNamingPattern() { return this.namingPattern; }
  getCategoryNames() { return this.categoryNames; }
  getInstanceType() { return this.instanceType; }
  getExtendedProperties() { return this.extendedProperties; }
  getAttributes() { return this.attributes; }
}

module.exports = PiAssetElementTemplate;
