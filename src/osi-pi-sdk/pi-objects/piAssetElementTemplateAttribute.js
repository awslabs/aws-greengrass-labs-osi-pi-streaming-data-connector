/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiBaseObject = require("./piBaseObject");
const stringTypes = ["string", "guid", "datetime", "timestamp"];
const numberTypes = ["byte", "int", "float", "single", "double"];

class PiAssetElementTemplateAttribute extends PiBaseObject {

  constructor(webid, name, path, type, defaultUnitsName, defaultUnitsNameAbbreviation, defaultValue, hasChildren) {

    super(webid, name, path);

    this.type = type;
    this.defaultUnitsName = defaultUnitsName;
    this.defaultUnitsNameAbbreviation = defaultUnitsNameAbbreviation;
    this.defaultValue = defaultValue;
    this.hasChildren = hasChildren;
  }

  //==============================================
  // Getters
  getType() { return this.type; }
  getDefaultUnitsName() { return this.defaultUnitsName; }
  getDefaultUnitsNameAbbreviation() { return this.defaultUnitsNameAbbreviation; }
  getDefaultValue() { return this.defaultValue; }
  getHasChildren() { return this.hasChildren; }

  getSitewiseType() {

    let lowerType = this.type.toLowerCase();
    
    // Return DOUBLE for all number types.
    for (let numberType of numberTypes){
      if (lowerType.includes(numberType))return "DOUBLE";
    }

    // Return STRING for all String types.
    for (let stringType of stringTypes){
      if (lowerType.includes(stringType))return "STRING";
    }

    // Return for BOOELAN type
    //if (lowerType === "boolean") return "BOOLEAN";
    // Changed Boolean to Double as Pi seralizes True/False to 1/0 in JSON making it appear as a number.
    if (lowerType === "boolean") return "DOUBLE";
      
    // Else throw error for Unsupported data type
    throw new Error(`Unsupported Data Type: ${this.type}`);

  }
  
}

module.exports = PiAssetElementTemplateAttribute;
