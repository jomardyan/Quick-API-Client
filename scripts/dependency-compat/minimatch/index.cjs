'use strict';

// Older build tools call require('minimatch') directly. Newer consumers use
// named exports. Both forms use the same patched upstream implementation.
const modern = require('minimatch-modern');
function minimatch(path, pattern, options) {
    return modern.minimatch(path, pattern, options);
}
Object.assign(minimatch, modern);
minimatch.defaults = function defaults(options) {
    const configured = modern.defaults(options);
    function match(path, pattern, extra) {
        return (typeof configured === 'function' ? configured : configured.minimatch)(path, pattern, extra);
    }
    Object.assign(match, configured);
    match.minimatch = match;
    return match;
};
module.exports = minimatch;
