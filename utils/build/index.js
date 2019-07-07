"use strict";
exports.__esModule = true;
var config_1 = require("./config");
exports.config = config_1.config;
var errors = require("./errors");
exports.errors = errors;
var sleep = function (ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
};
exports.sleep = sleep;
//# sourceMappingURL=index.js.map