const Module = require("module");
const path = require("path");
const stub = path.join(__dirname, "server-only-stub.js");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return stub;
  return original.call(this, request, parent, isMain, options);
};