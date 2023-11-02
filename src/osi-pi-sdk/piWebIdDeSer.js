/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 * 
 *  @author Dean Colcott <https://www.linkedin.com/in/deancolcott/>
 *
 * Based on example given at:
 * https://pisquare.osisoft.com/s/Blog-Detail/a8r1I000000Gv9JQAS/pi-web-api-using-web-id-20-to-optimize-your-applications
 * 
 * 
 * Note: This is a work in progress. 
 * Intent is to be able to programmatically create PiPoint (and other) WebIds from the Point Paths instead of users 
 * needing to know the WebID themsemves but to create PiPoint WebID also need the Point ID (index value) which is just as hard
 * as the WebId to get. Pending this question with OSI Pi.  
 * 
 * For now it is just able to decode a few WebIds that make it helpful to get the attrubute or point path fomr the WebID
 * 
 **/

// Test WebIds:

// Pi Data Server WebIds
// "name": "EC2AMAZ-5B1B4RL",
// "path": "\\\\PIServers[EC2AMAZ-5B1B4RL]",
//let = "F1DStNdEETiNm02M4FYFgorKtQRUMyQU1BWi01QjFCNFJM";

// PiPoint Full WebIds
// "name": "PumpingSite01.PumpingStation01.Pump01.CurrentDraw",
// "path": "\\\\EC2AMAZ-5B1B4RL\\PumpingSite01.PumpingStation01.Pump01.CurrentDraw",
//let piPointWebId = "F1DPtNdEETiNm02M4FYFgorKtQQwAAAARUMyQU1BWi01QjFCNFJMXFBVTVBJTkdTSVRFMDEuUFVNUElOR1NUQVRJT04wMS5QVU1QMDcuRkxPV01FU0FVUkVNRU5U";

// "name": "PumpingSite01.PumpingStation01.Pump01.CalculatedEfficiency",
// "path": "\\\\EC2AMAZ-5B1B4RL\\PumpingSite01.PumpingStation01.Pump01.CalculatedEfficiency",
//let piPointWebId = "F1DPtNdEETiNm02M4FYFgorKtQCQAAAARUMyQU1BWi01QjFCNFJMXFBVTVBJTkdTSVRFMDEuUFVNUElOR1NUQVRJT04wMS5QVU1QMDEuQ0FMQ1VMQVRFREVGRklDSUVOQ1k";

// "name": "PumpingSite01.PumpingStation01.Pump01.BearingTemp",
// "path": "\\\\EC2AMAZ-5B1B4RL\\PumpingSite01.PumpingStation01.Pump01.BearingTemp",
//let piPointWebId = "F1DPtNdEETiNm02M4FYFgorKtQCgAAAARUMyQU1BWi01QjFCNFJMXFBVTVBJTkdTSVRFMDEuUFVNUElOR1NUQVRJT04wMS5QVU1QMDEuQkVBUklOR1RFTVA";

class PiWebIdDeSer {

  decodePiDataServerWebId( webId ) {

    let type = webId.slice(0, 1);
    let version = webId.slice(1, 2);
    let marker = webId.slice(2, 4);
    let serverId = webId.slice(4, 26);
    let serverName = webId.slice(26, webId.length);

    console.log(`Web ID, Type ${type}`);
    console.log(`Web ID, Version ${version}`);
    console.log(`Web ID, Marker ${marker}`);

    console.log(`point.Server.ID: ${serverId} -> ${this.decodeGUID(serverId)}`);
    console.log(`serverName -> ${serverName}  -> ${this.decodeString(serverName)}`);
  }

  decodePiPointFullWebId( webId ) {

    let type = webId.slice(0, 1);
    let version = webId.slice(1, 2);
    let marker = webId.slice(2, 4);
    let serverId = webId.slice(4, 26);
    let pointId = webId.slice(26, 32);
    let payload = webId.slice(32, webId.length);

    console.log(`Web ID, Type ${type}`);
    console.log(`Web ID, Version ${version}`);
    console.log(`Web ID, Marker ${marker}`);

    console.log(`point.Server.ID: ${serverId} -> ${this.decodeGUID(serverId)}`);
    console.log(`point.ID: ${pointId} -> ${this.decodeInt32(pointId)}`);
    console.log(`payload -> ${payload}  -> ${this.decodeString(payload)}`);
  }

  //===================================
  // Pi WebID Encode / Decode Helper Functions
  //===================================

  decodeString(strDecode) {
    var decodestring = strDecode.replace("-", "+").replace("_", "/");
    var padneeded = decodestring.length % 4;
    for (var i = 0; i < padneeded; i++) {
      decodestring += "=";
    }

    return Buffer.from(decodestring, "base64").toString("utf8");
  }

  decodeInt32(urlEncodeInt32) {

    let bytes = this.base64ToArrayBuffer(urlEncodeInt32);
    let uncodedbytes = new Uint8Array(bytes);
    // Reverse for little to big endian
    uncodedbytes = uncodedbytes.reverse();
    // Byte array to Integer (value)
    let value = 0;
    for (var i = 0; i < uncodedbytes.length; i++) {
      value = (value << 8) | uncodedbytes[i];
    }

    return value;
  }

  base64ToArrayBuffer(base64) {
    //var binary_string = atob(base64);
    var binary_string = Buffer.from(base64, "base64").toString("binary");
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  decodeGUID(strDecode) {

    var bytes = this.base64ToArrayBuffer(strDecode);
    var uncodedbytes = new Uint8Array(bytes);

    var guidstr = "";

    for (var i = 3; i >= 0; i--) {
      if (uncodedbytes[i] < 17) {
        guidstr += "0" + uncodedbytes[i].toString(16);
      } else {
        guidstr += uncodedbytes[i].toString(16);
      }
    }
    guidstr += "-";
    if (uncodedbytes[5] < 17) {
      guidstr += "0" + uncodedbytes[5].toString(16);
    } else {
      guidstr += uncodedbytes[5].toString(16);
    }
    if (uncodedbytes[4] < 17) {
      guidstr += "0" + uncodedbytes[4].toString(16);
    } else {
      guidstr += uncodedbytes[4].toString(16);
    }
    guidstr += "-";
    if (uncodedbytes[7] < 17) {
      guidstr += "0" + uncodedbytes[7].toString(16);
    } else {
      guidstr += uncodedbytes[7].toString(16);
    }
    if (uncodedbytes[6] < 17) {
      guidstr += "0" + uncodedbytes[6].toString(16);
    } else {
      guidstr += uncodedbytes[6].toString(16);
    }
    guidstr += "-";
    if (uncodedbytes[8] < 17) {
      guidstr += "0" + uncodedbytes[8].toString(16);
    } else {
      guidstr += uncodedbytes[8].toString(16);
    }
    if (uncodedbytes[9] < 17) {
      guidstr += "0" + uncodedbytes[9].toString(16);
    } else {
      guidstr += uncodedbytes[9].toString(16);
    }
    guidstr += "-";
    for (i = 10; i < 16; i++) {
      if (uncodedbytes[i] < 17) {
        guidstr += "0" + uncodedbytes[i].toString(16);
      } else {
        guidstr += uncodedbytes[i].toString(16);
      }
    }

    return guidstr;
  }
}

module.exports = PiWebIdDeSer;


// Just for testing
// let piWebIdDeSer = new PiWebIdDeSer();

// console.log("\n\n#############################\nPiData Server WebID Decode\n#############################")
// piWebIdDeSer.decodePiDataServerWebId(piDataServerWebId);
// console.log("\n\n#############################\nPiPoint WebID Decode\n#############################")
// piWebIdDeSer.decodePiPointFullWebId(piPointWebId);
