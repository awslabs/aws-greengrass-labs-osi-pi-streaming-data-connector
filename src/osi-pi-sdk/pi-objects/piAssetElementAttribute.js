/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiBaseObject = require("./piBaseObject");
const stringTypes = ["string", "guid", "datetime", "timestamp"];
const numberTypes = ["byte", "int", "float", "single", "double"];

class PiAssetElementAttribute extends PiBaseObject {

  constructor(webid, name, path, type, defaultUnitsName, defaultUnitsNameAbbreviation, hasChildren, piPointLink) {

    super(webid, name, path);

    this.type = type;
    this.defaultUnitsName = defaultUnitsName;
    this.defaultUnitsNameAbbreviation = defaultUnitsNameAbbreviation;
    this.hasChildren = hasChildren;

    // Is likly error prone but Pi doesn't return the attached PiPoint Path so need to spilt from the complete PiPoint URL Link (which for some reason it does return)!
    this.piPointWebId = undefined;
    if (piPointLink) {
      this.piPointWebId = piPointLink.split("/").pop();
    }
  }

  //==============================================
  // Getters
  getType() { return this.type; }
  getDefaultUnitsName() { return this.defaultUnitsName; }
  getDefaultUnitsNameAbbreviation() { return this.defaultUnitsNameAbbreviation; }
  getHasChildren() { return this.hasChildren; }
  getPiPointWebId() { return this.piPointWebId; }

  getSitewiseType() {

    let lowerType = this.type.toLowerCase();

    // Return DOUBLE for all number type.
    for (let numberType of numberTypes) {
      if (lowerType.includes(numberType)) return "DOUBLE";
    }

    // Return STRING for all number type.
    for (let stringType of stringTypes) {
      if (lowerType.includes(stringType)) return "STRING";
    }

    // Return for BOOELAN type
    if (lowerType === "boolean") return "BOOLEAN";

    // Else throw error for unknown type
    throw new Error(`Unknown Data Type: ${this.type}`);

  }

}

module.exports = PiAssetElementAttribute;
