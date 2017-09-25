"use strict";
var gLong = require('./gLong');
// default module: logging
// used for debugging the stack and local variables
function debug_var(e) {
    if (e === null) {
        return '!';
    }
    else if (e === void 0) {
        return 'undef';
    }
    else if (e.ref != null) {
        return "*" + e.ref;
    }
    else if (e instanceof gLong) {
        return e + "L";
    }
    return e;
}
exports.debug_var = debug_var;
// used for debugging the stack and local variables
function debug_vars(arr) {
    return arr.map(debug_var);
}
exports.debug_vars = debug_vars;
// log levels
// TODO: turn this into an enum, if possible
exports.VTRACE = 10;
exports.TRACE = 9;
exports.DEBUG = 5;
exports.ERROR = 1;
exports.log_level = exports.ERROR;
function log(level, msgs) {
    if (level <= exports.log_level) {
        var msg = msgs.join(' ');
        if (level == 1) {
            console.error(msg);
        }
        else {
            console.log(msg);
        }
    }
}
function vtrace() {
    var msgs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        msgs[_i - 0] = arguments[_i];
    }
    log(exports.VTRACE, msgs);
}
exports.vtrace = vtrace;
function trace() {
    var msgs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        msgs[_i - 0] = arguments[_i];
    }
    log(exports.TRACE, msgs);
}
exports.trace = trace;
function debug() {
    var msgs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        msgs[_i - 0] = arguments[_i];
    }
    log(exports.DEBUG, msgs);
}
exports.debug = debug;
function error() {
    var msgs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        msgs[_i - 0] = arguments[_i];
    }
    log(exports.ERROR, msgs);
}
exports.error = error;
