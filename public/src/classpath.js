var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var enums_1 = require('./enums');
var assert = require('./assert');
var fs = require('fs');
var path = require('path');
var BrowserFS = require('browserfs');
var util = require('./util');
var BFSFS = BrowserFS.BFSRequire('fs');
var ZipFS = BrowserFS.FileSystem.ZipFS;
function win2nix(p) {
    return p.replace(/\\/g, '/');
}
/**
 * Represents a JAR file on the classpath.
 */
var AbstractClasspathJar = (function () {
    function AbstractClasspathJar(path) {
        this._fs = new BFSFS.FS();
        /**
         * Was the JAR file successfully read?
         * - TRUE: JAR file is read and mounted in this._fs.
         * - FALSE: JAR file could not be read.
         * - INDETERMINATE: We have yet to try reading this JAR file.
         */
        this._jarRead = enums_1.TriState.INDETERMINATE;
        this._path = path;
    }
    AbstractClasspathJar.prototype.getPath = function () { return this._path; };
    AbstractClasspathJar.prototype.loadJar = function (cb) {
        var _this = this;
        if (this._jarRead !== enums_1.TriState.TRUE) {
            fs.readFile(this._path, function (e, data) {
                if (e) {
                    _this._jarRead = enums_1.TriState.FALSE;
                    cb(e);
                }
                else {
                    try {
                        _this._fs.initialize(new ZipFS(data, path.basename(_this._path)));
                        _this._jarRead = enums_1.TriState.TRUE;
                        cb();
                    }
                    catch (e) {
                        _this._jarRead = enums_1.TriState.FALSE;
                        cb(e);
                    }
                }
            });
        }
        else {
            setImmediate(function () { return cb(_this._jarRead === enums_1.TriState.TRUE ? null : new Error("Failed to load JAR file.")); });
        }
    };
    AbstractClasspathJar.prototype.tryLoadClassSync = function (type) {
        if (this._jarRead === enums_1.TriState.TRUE) {
            if (this.hasClass(type) !== enums_1.TriState.FALSE) {
                try {
                    // NOTE: Path must be absolute, otherwise BrowserFS
                    // will try to use process.cwd().
                    return this._fs.readFileSync("/" + type + ".class");
                }
                catch (e) {
                    return null;
                }
            }
            else {
                return null;
            }
        }
        else {
            // Must go the async route.
            return null;
        }
    };
    /**
     * Wrap an operation that depends on the jar being loaded.
     */
    AbstractClasspathJar.prototype._wrapOp = function (op, failCb) {
        var _this = this;
        switch (this._jarRead) {
            case enums_1.TriState.TRUE:
                op();
                break;
            case enums_1.TriState.FALSE:
                setImmediate(function () { return failCb(new Error("Unable to load JAR file.")); });
                break;
            default:
                this.loadJar(function () {
                    _this._wrapOp(op, failCb);
                });
                break;
        }
    };
    /**
     * Wrap a synchronous operation that depends on the jar being loaded.
     * Returns null if the jar isn't loaded, or if the operation fails.
     */
    AbstractClasspathJar.prototype._wrapSyncOp = function (op) {
        if (this._jarRead === enums_1.TriState.TRUE) {
            try {
                return op();
            }
            catch (e) {
                return null;
            }
        }
        else {
            return null;
        }
    };
    AbstractClasspathJar.prototype.loadClass = function (type, cb) {
        var _this = this;
        this._wrapOp(function () {
            // Path must be absolute to avoid relative path issues.
            _this._fs.readFile("/" + type + ".class", cb);
        }, cb);
    };
    AbstractClasspathJar.prototype.statResource = function (p, cb) {
        var _this = this;
        this._wrapOp(function () {
            _this._fs.stat(p, cb);
        }, cb);
    };
    AbstractClasspathJar.prototype.readdir = function (p, cb) {
        var _this = this;
        this._wrapOp(function () {
            _this._fs.readdir(win2nix(p), cb);
        }, cb);
    };
    AbstractClasspathJar.prototype.tryReaddirSync = function (p) {
        var _this = this;
        return this._wrapSyncOp(function () {
            return _this._fs.readdirSync(win2nix(p));
        });
    };
    AbstractClasspathJar.prototype.tryStatSync = function (p) {
        var _this = this;
        return this._wrapSyncOp(function () {
            return _this._fs.statSync(win2nix(p));
        });
    };
    AbstractClasspathJar.prototype.getFS = function () {
        return this._fs.getRootFS();
    };
    return AbstractClasspathJar;
})();
exports.AbstractClasspathJar = AbstractClasspathJar;
/**
 * A JAR item on the classpath that is not in the meta index.
 */
var UnindexedClasspathJar = (function (_super) {
    __extends(UnindexedClasspathJar, _super);
    function UnindexedClasspathJar(p) {
        _super.call(this, p);
        // Contains the list of classes accessible from this classpath item.
        this._classList = null;
    }
    UnindexedClasspathJar.prototype.hasClass = function (type) {
        if (this._jarRead === enums_1.TriState.FALSE) {
            return enums_1.TriState.FALSE;
        }
        else {
            return this._hasClass(type);
        }
    };
    UnindexedClasspathJar.prototype._hasClass = function (type) {
        if (this._classList) {
            return this._classList[type] ? enums_1.TriState.TRUE : enums_1.TriState.FALSE;
        }
        return enums_1.TriState.INDETERMINATE;
    };
    /**
     * Initialize this item on the classpath with the given classlist.
     * @param classes List of classes in pkg/path/Name format.
     */
    UnindexedClasspathJar.prototype.initializeWithClasslist = function (classes) {
        assert(this._classList === null, "Initializing a classpath item twice!");
        this._classList = {};
        var len = classes.length;
        for (var i = 0; i < len; i++) {
            this._classList[classes[i]] = true;
        }
    };
    UnindexedClasspathJar.prototype.initialize = function (cb) {
        var _this = this;
        this.loadJar(function (err) {
            if (err) {
                cb();
            }
            else {
                var pathStack = ['/'];
                var classlist = [];
                var fs_1 = _this._fs;
                while (pathStack.length > 0) {
                    var p = pathStack.pop();
                    try {
                        var stat = fs_1.statSync(p);
                        if (stat.isDirectory()) {
                            var listing = fs_1.readdirSync(p);
                            for (var i = 0; i < listing.length; i++) {
                                pathStack.push(path.join(p, listing[i]));
                            }
                        }
                        else if (path.extname(p) === '.class') {
                            // Cut off initial / from absolute path.
                            classlist.push(p.slice(1, p.length - 6));
                        }
                    }
                    catch (e) {
                    }
                }
                _this.initializeWithClasslist(classlist);
                cb();
            }
        });
    };
    return UnindexedClasspathJar;
})(AbstractClasspathJar);
exports.UnindexedClasspathJar = UnindexedClasspathJar;
/**
 * A JAR file on the classpath that is in the meta-index.
 */
var IndexedClasspathJar = (function (_super) {
    __extends(IndexedClasspathJar, _super);
    function IndexedClasspathJar(metaIndex, p) {
        _super.call(this, p);
        this._metaIndex = metaIndex;
        this._metaName = path.basename(p);
    }
    IndexedClasspathJar.prototype.initialize = function (cb) {
        setImmediate(function () { return cb(); });
    };
    IndexedClasspathJar.prototype.hasClass = function (type) {
        if (this._jarRead === enums_1.TriState.FALSE) {
            return enums_1.TriState.FALSE;
        }
        else {
            var pkgComponents = type.split('/');
            var search = this._metaIndex;
            // Pop off class name.
            pkgComponents.pop();
            for (var i = 0; i < pkgComponents.length; i++) {
                var item = search[pkgComponents[i]];
                if (!item) {
                    // item === undefined or false.
                    return enums_1.TriState.FALSE;
                }
                else if (item === true) {
                    return enums_1.TriState.INDETERMINATE;
                }
                else {
                    // Must be an object.
                    search = item;
                }
            }
            // Assume meta-index is complete.
            return enums_1.TriState.FALSE;
        }
    };
    return IndexedClasspathJar;
})(AbstractClasspathJar);
exports.IndexedClasspathJar = IndexedClasspathJar;
/**
 * Represents a folder on the classpath.
 */
var ClasspathFolder = (function () {
    function ClasspathFolder(path) {
        this._path = path;
    }
    ClasspathFolder.prototype.getPath = function () { return this._path; };
    ClasspathFolder.prototype.hasClass = function (type) {
        return enums_1.TriState.INDETERMINATE;
    };
    ClasspathFolder.prototype.initialize = function (cb) {
        // NOP.
        setImmediate(cb);
    };
    ClasspathFolder.prototype.tryLoadClassSync = function (type) {
        try {
            return fs.readFileSync(path.resolve(this._path, type + ".class"));
        }
        catch (e) {
            return null;
        }
    };
    ClasspathFolder.prototype.loadClass = function (type, cb) {
        fs.readFile(path.resolve(this._path, type + ".class"), cb);
    };
    ClasspathFolder.prototype.statResource = function (p, cb) {
        fs.stat(path.resolve(this._path, p), cb);
    };
    ClasspathFolder.prototype.readdir = function (p, cb) {
        fs.readdir(path.resolve(this._path, p), cb);
    };
    ClasspathFolder.prototype.tryReaddirSync = function (p) {
        try {
            return fs.readdirSync(path.resolve(this._path, p));
        }
        catch (e) {
            return null;
        }
    };
    ClasspathFolder.prototype.tryStatSync = function (p) {
        try {
            return fs.statSync(path.resolve(this._path, p));
        }
        catch (e) {
            return null;
        }
    };
    return ClasspathFolder;
})();
exports.ClasspathFolder = ClasspathFolder;
/**
 * Represents a classpath item that cannot be found.
 */
var ClasspathNotFound = (function () {
    function ClasspathNotFound(path) {
        this._path = path;
    }
    ClasspathNotFound.prototype.getPath = function () { return this._path; };
    ClasspathNotFound.prototype.hasClass = function (type) { return enums_1.TriState.FALSE; };
    ClasspathNotFound.prototype.initialize = function (cb) { setImmediate(cb); };
    ClasspathNotFound.prototype.initializeWithClasslist = function (classlist) { };
    ClasspathNotFound.prototype.tryLoadClassSync = function (type) { return null; };
    ClasspathNotFound.prototype._notFoundError = function (cb) { setImmediate(function () { return cb(new Error("Class cannot be found.")); }); };
    ClasspathNotFound.prototype.loadClass = function (type, cb) { this._notFoundError(cb); };
    ClasspathNotFound.prototype.statResource = function (p, cb) { this._notFoundError(cb); };
    ClasspathNotFound.prototype.readdir = function (p, cb) { this._notFoundError(cb); };
    ClasspathNotFound.prototype.tryReaddirSync = function (p) { return null; };
    ClasspathNotFound.prototype.tryStatSync = function (p) { return null; };
    return ClasspathNotFound;
})();
exports.ClasspathNotFound = ClasspathNotFound;
/**
 * Parse the meta index into a lookup table from package name (with slashes) to JAR file.
 * Returns a tuple of JAR files in the meta index and the meta index.
 */
function parseMetaIndex(metaIndex) {
    var lines = metaIndex.split("\n");
    var rv = {};
    var currentJar = null;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.length > 0) {
            switch (line[0]) {
                case '%':
                case '@':
                    // Comment or resource-only JAR file.
                    continue;
                case '!':
                case '#':
                    // JAR file w/ classes.
                    // Skip symbol and space.
                    var jarName = line.slice(2);
                    rv[jarName] = currentJar = {};
                    break;
                default:
                    // Package name. If it ends with /, then it's shared
                    // amongst multiple JAR files.
                    // We don't treat those separately, though, so standardize it.
                    if (line[line.length - 1] === '/') {
                        line = line.slice(0, line.length - 1);
                    }
                    var pkgComponents = line.split('/');
                    var current = currentJar;
                    var i_1 = void 0;
                    for (i_1 = 0; i_1 < pkgComponents.length - 1; i_1++) {
                        var cmp = pkgComponents[i_1], next = current[cmp];
                        if (!next) {
                            current = current[cmp] = {};
                        }
                        else {
                            // Invariant: You can't list a package and its subpackages
                            // for same jar file. Thus, current[cmp] cannot be a boolean.
                            current = current[cmp];
                        }
                    }
                    current[pkgComponents[i_1]] = true;
                    break;
            }
        }
    }
    return rv;
}
/**
 * Given a list of paths (which may or may not exist), produces a list of
 * classpath objects.
 */
function ClasspathFactory(javaHomePath, paths, cb) {
    var classpathItems = new Array(paths.length), i = 0;
    fs.readFile(path.join(javaHomePath, 'lib', 'meta-index'), function (err, data) {
        var metaIndex = {};
        if (!err) {
            metaIndex = parseMetaIndex(data.toString());
        }
        util.asyncForEach(paths, function (p, nextItem) {
            var pRelToHome = path.relative(javaHomePath + "/lib", p);
            fs.stat(p, function (err, stats) {
                var cpItem;
                if (err) {
                    cpItem = new ClasspathNotFound(p);
                }
                else if (stats.isDirectory()) {
                    cpItem = new ClasspathFolder(p);
                }
                else {
                    if (metaIndex[pRelToHome]) {
                        cpItem = new IndexedClasspathJar(metaIndex[pRelToHome], p);
                    }
                    else {
                        cpItem = new UnindexedClasspathJar(p);
                    }
                }
                classpathItems[i++] = cpItem;
                cpItem.initialize(nextItem);
            });
        }, function (e) {
            cb(classpathItems);
        });
    });
}
exports.ClasspathFactory = ClasspathFactory;
