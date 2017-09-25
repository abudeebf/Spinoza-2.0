/**
 * A safe to use key value map.
 *
 * JavaScript objects cannot be used as general-purpose key value maps, as they
 * contain a number of default fields. This class avoids those issues.
 */
var SafeMap = (function () {
    function SafeMap() {
        this.cache = Object.create(null); // has no defined properties aside from __proto__
    }
    /**
     * Mutates the key so that it cannot possibly conflict with existing object
     * properties.
     */
    SafeMap.prototype.fixKey = function (key) {
        return ';' + key;
    };
    SafeMap.prototype.get = function (key) {
        key = this.fixKey(key);
        if (this.cache[key] !== undefined) {
            return this.cache[key];
        }
        return undefined;
    };
    SafeMap.prototype.has = function (key) {
        return this.get(key) !== undefined;
    };
    SafeMap.prototype.set = function (key, value) {
        this.cache[this.fixKey(key)] = value;
    };
    return SafeMap;
})();
module.exports = SafeMap;
