/**
 * Utility class. "stream" out string data, and compile into a single string.
 */
var StringOutputStream = (function () {
    function StringOutputStream() {
        this._data = [];
    }
    StringOutputStream.prototype.write = function (data) { this._data.push(data); };
    StringOutputStream.prototype.flush = function () {
        var rv = this._data.join("");
        this._data = [];
        return rv;
    };
    return StringOutputStream;
})();
module.exports = StringOutputStream;
