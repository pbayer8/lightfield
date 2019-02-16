/**
 *	Bootstrap
 */
// var Viewer = require('./viewer');
var Renderer = require('./renderer/renderer');
var FileLoader = require('./utils/file-loader');
var Vector2 = require('./utils/vector-2');
// Exports itself as LFViewer global if no module system is found
// module.exports = Viewer;
exports.Renderer = Renderer;
exports.Loader = FileLoader;
exports.Vector2 = Vector2;