/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiAssetElementParent = require("./piAssetElementParent");

class PiAssetElement extends PiAssetElementParent {

  constructor(webid, name, path, templateName, templateLink, parentLink, categoryNames, extendedProperties, hasChildren) {

    super(webid, name, path);

    this.templateName = templateName;

    // Is likly error prone but Pi doesn't return the Template (path or WebId) so need to spilt from the complete Template URL Link (which for some reason it does return)!
    this.templateWebId=undefined;
    if (templateLink) {
      this.templateWebId = templateLink.split("/").pop();
    }

    // Same for Parent Object
    this.parentWebId=undefined;
    if (parentLink) {
      this.parentWebId = parentLink.split("/").pop();
    }

    this.categoryNames = categoryNames;
    this.extendedProperties = extendedProperties;
    this.hasChildren = hasChildren;
  }



  //==============================================
  // Getters
  getTemplateName() { return this.templateName; }
  getTemplateWebId() { return this.templateWebId; }
  getParentWebId() { return this.parentWebId; }
  getCategoryNames() { return this.categoryNames; }
  getExtendedProperties() { return this.extendedProperties; }
  getHasChildren() { return this.hasChildren; }
}

module.exports = PiAssetElement;
