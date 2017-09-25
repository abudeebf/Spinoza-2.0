var path = require('path');
var fs = require('fs');
/**
 * Given a folder that contains the contents of a JAR file, parses the MANIFEST
 * file and other metadata and makes it available to Doppio in a convenient
 * format.
 *
 * @see http://docs.oracle.com/javase/7/docs/technotes/guides/jar/jar.html#Notes_on_Manifest_and_Signature_Files
 * @todo Add a function for producing a Java object from this.
 */
var JAR = (function () {
    /**
     * Calls doneCb when it is finished opening and parsing the MANIFEST file.
     */
    function JAR(dir, doneCb) {
        var _this = this;
        this.attributes = {};
        this.classpath = [];
        // Try to read the MANIFEST file.
        fs.readFile(path.resolve(dir, 'META-INF/MANIFEST.MF'), function (err, data) {
            if (err)
                return doneCb(err);
            // Parse the file!
            // If a line *begins* with a space, then it's a continuation of the
            // previous value.
            var currentAttribute = null;
            var currentValue = "";
            // Figure out which line ending the MANIFEST uses.
            var ending = '\n';
            var dataStr = data.toString("utf8");
            var npos = dataStr.indexOf('\n');
            var rpos = dataStr.indexOf('\r');
            if (npos === rpos + 1)
                ending = '\r\n';
            else if (rpos > -1)
                ending = '\r';
            var lines = dataStr.split(ending);
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line === '\r') {
                    // Windows-style line endings...
                    continue;
                }
                if (line.length === 0) {
                    // EOF!
                    if (currentAttribute !== null) {
                        // Set the previously-parsed value.
                        _this._setAttribute(currentAttribute, currentValue);
                        currentAttribute = null;
                    }
                }
                else if (line.charAt(0) === " ") {
                    // Continuation of previous value. Shave off the initial space.
                    currentValue += line.substr(1);
                }
                else {
                    // New value.
                    if (currentAttribute !== null) {
                        // Set the previously-parsed value.
                        _this._setAttribute(currentAttribute, currentValue);
                    }
                    // Split on :.
                    var split = line.split(':');
                    // TODO: Print a warning if parsing fails.
                    currentAttribute = split[0];
                    // Shave off the space separator.
                    currentValue = split[1].substr(1);
                }
            }
            // Completed without error.
            doneCb();
        });
    }
    /**
     * Sets the given attribute from parsed information. This function decides if
     * we digest the information further, or toss it.
     */
    JAR.prototype._setAttribute = function (attribute, value) {
        // Attribute names are case insensitive.
        attribute = attribute.toLowerCase();
        this.attributes[attribute] = value;
        if (attribute === 'class-path') {
            // Parse this! All items are JAR files and are separated by spaces, and
            // may contain \ as separator.
            // We'll just process all words that end in "JAR".
            var words = value.split(' ');
            for (var i = 0; i < words.length; i++) {
                var word = words[i];
                if (word.substr(-4) === '.jar') {
                    this.classpath.push(word);
                }
            }
        }
    };
    /**
     * Return the items in this JAR file's classpath.
     */
    JAR.prototype.getClassPath = function () {
        return this.classpath.slice(0);
    };
    /**
     * Returns NULL if the attribute does not exist.
     * Attribute names are case insensitive
     */
    JAR.prototype.getAttribute = function (attribute) {
        return this.attributes[attribute.toLowerCase()];
    };
    /**
     * Primarily used for debugging.
     */
    JAR.prototype.toString = function () {
        return JSON.stringify(this.attributes);
    };
    return JAR;
})();
module.exports = JAR;
