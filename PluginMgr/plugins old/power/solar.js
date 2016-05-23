﻿"use strict";

// Read power generated by solar panel inverter
var com = require("serialport");
var serialSolar;
var CR = "\r";
var oldData = -99
var solarCmd = "POUT";

// Changed to open/close serial port (destroying object) each call as serialport module has a bug (thread blocks for a second or 2) with more than 3 serialports open concurrently. No obvious fix

// startup function
function startup() {
    var startStatus = "OK"
    
    setInterval(pollInvPatch, +fw.settings.pollinterval * 1000, "POUT");
    
    //startSerialPort();
    //setInterval(pollInv, +fw.settings.pollinterval * 1000, "POUT");
    
    return startStatus
}

function startSerialPort() {
    serialSolar = new com.SerialPort(fw.settings.comport, {
            baudrate: +fw.settings.baudrate,
            databits: +fw.settings.databits,
            stopbits: +fw.settings.stopbits,
            parity: fw.settings.parity,
            buffersize: 255
            //parser: com.parsers.readline('\r\n')
        }, function (err) {
        if (err) fw.log(err + ". Cannot open solar serial port, no solar generation functionality available.")
    });

    serialSolar.on("open",function() {
        fw.log("Serial port open on " + fw.settings.comport);
    });
        
    serialSolar.on("data", function(data) {
        serialRecv(data);
    });
    
    serialSolar.on("error", function (err) {
        fw.log("Serial port general error " + err);
        startSerialPort();
        fw.restart(99);
    });
}

function pollInv(cmd) {
    //serialSolar.open();
    try {
        serialSolar.write(new Buffer(solarCmd + fw.settings.cmdchar + CR), function (err) {
            if (err) {
                fw.log("Serial write error: " + err);
                fw.restart(99);
            }
        })
    } catch (e) { fw.log("Serial write error: " + e); }
/*        serialSolar.write(new Buffer(cmd + fw.settings.cmdchar + CR), function (err) {
            if (err) {
                fw.log("Serial write error: " + err);
                fw.restart(99);
            }
        }) */
}

function pollInvPatch(cmd) {
    if (serialSolar) serialSolar.close();    
    serialSolar = new com.SerialPort(fw.settings.comport, {
        baudrate: +fw.settings.baudrate,
        databits: +fw.settings.databits,
        stopbits: +fw.settings.stopbits,
        parity: fw.settings.parity,
        buffersize: 255
            //parser: com.parsers.readline('\r\n')
    }, function (err) {
        if (err) {
            if (serialSolar) serialSolar.close();
            fw.log(err + ". Cannot open solar serial port, skipping cycle.")
        }
    });
        
    serialSolar.on("data", function (data) {
        serialRecvPatch(data);
    });
    
    serialSolar.on("error", function (err) {
        fw.log("Serial port general error " + err);
        //debugger
        //fw.restart(99);
    });
 
    serialSolar.on("open", function () {
//        fw.log("Serial port open on " + fw.settings.comport);
          serialSolar.write(new Buffer(cmd + fw.settings.cmdchar + CR), function (err) {
            if (err) {
                fw.log("Serial write error: " + err);
                //fw.restart(99);
            }
          })
    });
}

function serialRecv(data) {
    if (data.length > 0) {
        var generated = parseInt(data.toString().split(CR)[0])
        if (generated < fw.settings.changetol) generated = 0                        // ignore any spurious watts generated at night
        if (Math.abs(generated - oldData) >= fw.settings.changetol) {
            fw.toHost("Power Out", "W", generated)
            oldData = generated
        }
    }
}

function serialRecvPatch(data) {
        if (data.length > 0) {
            var generated = parseInt(data.toString().split(CR)[0])
            if (generated < fw.settings.changetol) generated = 0                        // ignore any spurious watts generated at night
            if (Math.abs(generated - oldData) >= fw.settings.changetol) {
                fw.toHost("Power Out", "W", generated)
                oldData = generated
        }
        serialSolar.close(closeSerial)
    }
}        

function closeSerial() {
    serialSolar = undefined;
}

//Functions: VIN, VOUT, MEASTEMP, TIME, WHLIFE, KWHTODAY, MPPTSTAT, IIN, IOUT, PIN, POUT.

// Process host messages
exports.fromHost = function fromHost(channel, scope, data) {
    return "OK"
}

// Shutdown the plugin
exports.shutPlugin = function shutPlugin(param) {
    //Insert any orderly shutdown code needed here
    return "OK"
}

// Initialize the plugin - DO NOT MODIFY THIS FUNCTION
var fw = new Object();
exports.loaded = function(iniCat, iniName, iniChannels, iniSettings, iniStore) {
    fw.cat = iniCat;
    fw.plugName = iniName;
    fw.channels = iniChannels;
    fw.settings = iniSettings;
    fw.store = iniStore;
    fw.restart = function (code) { module.parent.exports.restart(code) };
    fw.log = function (msg) { module.parent.exports.log(fw.cat + "/" + fw.plugName, msg) };
    fw.toHost = function (myChannel, myScope, myData, myLog) { module.parent.exports.toHost(fw.cat, fw.plugName, myChannel, myScope, myData, myLog) };
    fw.addChannel = function (name, desc, type, io, min, max, units, attribs, value, store) {module.parent.exports.addChannel(fw.cat, fw.plugName, name, desc, type, io, min, max, units, attribs, value, store)};
    return startup();
}