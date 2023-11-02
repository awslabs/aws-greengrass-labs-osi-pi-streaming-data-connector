/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 */

const PiBaseObject = require("./piBaseObject");

class PiDataPoint extends PiBaseObject {

  constructor(webid, name, path, pointClass, pointType, engUnits, zero, span, future) {
    super(webid, name, path);

    this.pointClass = pointClass;
    this.pointType = pointType;
    this.engUnits = engUnits;
    this.zero = zero;
    this.span = span;
    this.future = future;
  }

  getPointClass() { return this.pointClass; }
  getPointType() { return this.pointType; }
  getEngineeringUnits() { return this.engUnits; }
  getZero() { return this.zero; }
  getSpan() { return this.span; }
  getFuture() { return this.future; }
}

module.exports = PiDataPoint;
