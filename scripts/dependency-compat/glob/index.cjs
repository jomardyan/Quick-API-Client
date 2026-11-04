'use strict';
const modern = require('glob-modern');
function glob(pattern, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    const result = modern.glob(pattern, options || {});
    if (callback) result.then(files => callback(null, files), callback);
    return result;
}
Object.assign(glob, modern);
glob.glob = glob;
glob.sync = modern.globSync;
module.exports = glob;
