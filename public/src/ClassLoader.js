var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ClassData_1 = require('./ClassData');
var ClassLock = require('./ClassLock');
var classpath_1 = require('./classpath');
var enums_1 = require('./enums');
var util = require('./util');
var logging = require('./logging');
var assert = require('./assert');
var debug = logging.debug;
/**
 * Used to lock classes for loading.
 */
var ClassLocks = (function () {
    function ClassLocks() {
        /**
         * typrStr => array of callbacks to trigger when operation completes.
         */
        this.locks = {};
    }
    /**
     * Checks if the lock for the given class is already taken. If not, it takes
     * the lock. If it is taken, we enqueue the callback.
     * NOTE: For convenience, will handle triggering the owner's callback as well.
     */
    ClassLocks.prototype.tryLock = function (typeStr, thread, cb) {
        if (typeof this.locks[typeStr] === 'undefined') {
            this.locks[typeStr] = new ClassLock();
        }
        return this.locks[typeStr].tryLock(thread, cb);
    };
    /**
     * Releases the lock on the given string.
     */
    ClassLocks.prototype.unlock = function (typeStr, cdata) {
        this.locks[typeStr].unlock(cdata);
        // No need for this lock to remain.
        delete this.locks[typeStr];
    };
    /**
     * Returns the owning thread of a given lock. Returns null if the specified
     * type string is not locked.
     */
    ClassLocks.prototype.getOwner = function (typeStr) {
        if (this.locks[typeStr]) {
            return this.locks[typeStr].getOwner();
        }
        return null;
    };
    return ClassLocks;
})();
/**
 * Base classloader class. Contains common class resolution and instantiation
 * logic.
 */
var ClassLoader = (function () {
    /**
     * @param bootstrap The JVM's bootstrap classloader. ClassLoaders use it
     *   to retrieve primitive types.
     */
    function ClassLoader(bootstrap) {
        this.bootstrap = bootstrap;
        /**
         * Stores loaded *reference* and *array* classes.
         */
        this.loadedClasses = {};
        /**
         * Stores callbacks that are waiting for another thread to finish loading
         * the specified class.
         */
        this.loadClassLocks = new ClassLocks();
    }
    /**
     * Retrieve a listing of classes that are loaded in this class loader.
     */
    ClassLoader.prototype.getLoadedClassNames = function () {
        return Object.keys(this.loadedClasses);
    };
    /**
     * Adds the specified class to the classloader. As opposed to defineClass,
     * which defines a new class from bytes with the classloader.
     *
     * What's the difference?
     * * Classes created with defineClass are defined by this classloader.
     * * Classes added with addClass may have been defined by a different
     *   classloader. This happens when a custom class loader's loadClass
     *   function proxies classloading to a different classloader.
     *
     * @param typeStr The type string of the class.
     * @param classData The class data object representing the class.
     */
    ClassLoader.prototype.addClass = function (typeStr, classData) {
        // If the class is already added, ensure it is the same class we are adding again.
        assert(this.loadedClasses[typeStr] != null ? this.loadedClasses[typeStr] === classData : true);
        this.loadedClasses[typeStr] = classData;
    };
    /**
     * No-frills. Get the class if it's defined in the class loader, no matter
     * what shape it is in.
     *
     * Should only be used internally by ClassLoader subclasses.
     */
    ClassLoader.prototype.getClass = function (typeStr) {
        return this.loadedClasses[typeStr];
    };
    /**
     * Defines a new class with the class loader from an array of bytes.
     * @param thread The thread that is currently in control when this class is
     *   being defined. An exception may be thrown if there is an issue parsing
     *   the class file.
     * @param typeStr The type string of the class (e.g. "Ljava/lang/Object;")
     * @param data The data associated with the class as a binary blob.
     * @param protectionDomain The protection domain for the class (can be NULL).
     * @return The defined class, or null if there was an issue.
     */
    ClassLoader.prototype.defineClass = function (thread, typeStr, data, protectionDomain) {
        try {
            var classData = new ClassData_1.ReferenceClassData(data, protectionDomain, this);
            this.addClass(typeStr, classData);
            if (this instanceof BootstrapClassLoader) {
                debug("[BOOTSTRAP] Defining class " + typeStr);
            }
            else {
                debug("[CUSTOM] Defining class " + typeStr);
            }
            return classData;
        }
        catch (e) {
            if (thread === null) {
                // This will only happen when we're loading java/lang/Thread for
                // the very first time.
                logging.error("JVM initialization failed: " + e);
                logging.error(e.stack);
            }
            else {
                thread.throwNewException('Ljava/lang/ClassFormatError;', e);
            }
            return null;
        }
    };
    /**
     * Defines a new array class with this loader.
     */
    ClassLoader.prototype.defineArrayClass = function (typeStr) {
        assert(this.getLoadedClass(util.get_component_type(typeStr)) != null);
        var arrayClass = new ClassData_1.ArrayClassData(util.get_component_type(typeStr), this);
        this.addClass(typeStr, arrayClass);
        return arrayClass;
    };
    /**
     * Attempts to retrieve the given loaded class.
     * @param typeStr The name of the class.
     * @return Returns the loaded class, or null if no such class is currently
     *   loaded.
     */
    ClassLoader.prototype.getLoadedClass = function (typeStr) {
        var cls = this.loadedClasses[typeStr];
        if (cls != null) {
            return cls;
        }
        else {
            if (util.is_primitive_type(typeStr)) {
                // Primitive classes must be fetched from the bootstrap classloader.
                return this.bootstrap.getPrimitiveClass(typeStr);
            }
            else if (util.is_array_type(typeStr)) {
                // We might be able to load this array class synchronously.
                // Component class must be loaded. And we must define the array class
                // with the component class's loader.
                var component = this.getLoadedClass(util.get_component_type(typeStr));
                if (component != null) {
                    var componentCl = component.getLoader();
                    if (componentCl === this) {
                        // We're responsible for defining the array class.
                        return this.defineArrayClass(typeStr);
                    }
                    else {
                        // Delegate to the other loader, then add the class to our loaded
                        // roster.
                        cls = componentCl.getLoadedClass(typeStr);
                        this.addClass(typeStr, cls);
                        return cls;
                    }
                }
            }
            return null;
        }
    };
    /**
     * Attempts to retrieve the given resolved class.
     * @param typeStr The name of the class.
     * @return Returns the class if it is both loaded and resolved. Returns null
     *   if this is not the case.
     */
    ClassLoader.prototype.getResolvedClass = function (typeStr) {
        var cls = this.getLoadedClass(typeStr);
        if (cls !== null) {
            if (cls.isResolved() || cls.tryToResolve()) {
                return cls;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    };
    /**
     * Attempts to retrieve the given initialized class.
     * @param typeStr The name of the class.
     * @return Returns the class if it is initialized. Returns null if this is
     *   not the case.
     */
    ClassLoader.prototype.getInitializedClass = function (thread, typeStr) {
        var cls = this.getLoadedClass(typeStr);
        if (cls !== null) {
            if (cls.isInitialized(thread) || cls.tryToInitialize()) {
                return cls;
            }
            else {
                return null;
            }
        }
        else {
            return cls;
        }
    };
    /**
     * Asynchronously loads the given class.
     */
    ClassLoader.prototype.loadClass = function (thread, typeStr, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        // See if we can grab this synchronously first.
        var cdata = this.getLoadedClass(typeStr);
        if (cdata) {
            setImmediate(function () {
                cb(cdata);
            });
        }
        else {
            // Check the loadClass lock for this class.
            if (this.loadClassLocks.tryLock(typeStr, thread, cb)) {
                // Async it is!
                if (util.is_reference_type(typeStr)) {
                    this._loadClass(thread, typeStr, function (cdata) {
                        _this.loadClassLocks.unlock(typeStr, cdata);
                    }, explicit);
                }
                else {
                    // Array
                    this.loadClass(thread, util.get_component_type(typeStr), function (cdata) {
                        if (cdata != null) {
                            // Synchronously will work now.
                            _this.loadClassLocks.unlock(typeStr, _this.getLoadedClass(typeStr));
                        }
                    }, explicit);
                }
            }
        }
    };
    /**
     * Convenience function: Resolve many classes. Calls cb with null should
     * an error occur.
     */
    ClassLoader.prototype.resolveClasses = function (thread, typeStrs, cb) {
        var _this = this;
        var classes = {};
        util.asyncForEach(typeStrs, function (typeStr, next_item) {
            _this.resolveClass(thread, typeStr, function (cdata) {
                if (cdata === null) {
                    next_item("Error resolving class: " + typeStr);
                }
                else {
                    classes[typeStr] = cdata;
                    next_item();
                }
            });
        }, function (err) {
            if (err) {
                cb(null);
            }
            else {
                cb(classes);
            }
        });
    };
    /**
     * Asynchronously *resolves* the given class by loading the class and
     * resolving its super class, interfaces, and/or component classes.
     */
    ClassLoader.prototype.resolveClass = function (thread, typeStr, cb, explicit) {
        if (explicit === void 0) { explicit = true; }
        this.loadClass(thread, typeStr, function (cdata) {
            if (cdata === null || cdata.isResolved()) {
                // Nothing to do! Either cdata is null, an exception triggered, and we
                // failed, or cdata is already resolved.
                setImmediate(function () { cb(cdata); });
            }
            else {
                cdata.resolve(thread, cb, explicit);
            }
        }, explicit);
    };
    /**
     * Asynchronously *initializes* the given class and its super classes.
     */
    ClassLoader.prototype.initializeClass = function (thread, typeStr, cb, explicit) {
        if (explicit === void 0) { explicit = true; }
        // Get the resolved class.
        this.resolveClass(thread, typeStr, function (cdata) {
            if (cdata === null || cdata.isInitialized(thread)) {
                // Nothing to do! Either resolution failed and an exception has already
                // been thrown, cdata is already initialized, or the current thread is
                // initializing the class.
                setImmediate(function () {
                    cb(cdata);
                });
            }
            else {
                assert(util.is_reference_type(typeStr));
                cdata.initialize(thread, cb, explicit);
            }
        }, explicit);
    };
    /**
     * Throws the appropriate exception/error for a class not being found.
     * If loading was implicitly triggered by the JVM, we call NoClassDefFoundError.
     * If the program explicitly called loadClass, then we throw the ClassNotFoundException.
     */
    ClassLoader.prototype.throwClassNotFoundException = function (thread, typeStr, explicit) {
        thread.throwNewException(explicit ? 'Ljava/lang/ClassNotFoundException;' : 'Ljava/lang/NoClassDefFoundError;', "Cannot load class: " + util.ext_classname(typeStr));
    };
    return ClassLoader;
})();
exports.ClassLoader = ClassLoader;
/**
 * The JVM's bootstrap class loader. Loads classes directly from files on the
 * file system.
 */
var BootstrapClassLoader = (function (_super) {
    __extends(BootstrapClassLoader, _super);
    /**
     * Constructs the bootstrap classloader with the given classpath.
     * @param classPath The classpath, where the *first* item is the *last*
     *   classpath searched. Meaning, the classPath[0] should be the bootstrap
     *   class path.
     * @param extractionPath The path where jar files should be extracted.
     * @param cb Called once all of the classpath items have been checked.
     *   Passes an error if one occurs.
     */
    function BootstrapClassLoader(javaHome, classpath, cb) {
        var _this = this;
        _super.call(this, this);
        this.classpath = null;
        this.loadedPackages = {};
        classpath_1.ClasspathFactory(javaHome, classpath, function (items) {
            _this.classpath = items.reverse();
            cb();
        });
    }
    /**
     * Registers that a given class has successfully been loaded from the specified
     * classpath item.
     */
    BootstrapClassLoader.prototype._registerLoadedClass = function (clsType, cpItem) {
        var pkgName = clsType.slice(0, clsType.lastIndexOf('/')), itemLoader = this.loadedPackages[pkgName];
        if (!itemLoader) {
            this.loadedPackages[pkgName] = [cpItem];
        }
        else if (itemLoader[0] !== cpItem && itemLoader.indexOf(cpItem) === -1) {
            // Common case optimization: Simply check the first array element.
            itemLoader.push(cpItem);
        }
    };
    /**
     * Returns a listing of tuples containing:
     * * The package name (e.g. java/lang)
     * * Classpath locations where classes in the package were loaded.
     */
    BootstrapClassLoader.prototype.getPackages = function () {
        var _this = this;
        return Object.keys(this.loadedPackages).map(function (pkgName) {
            return [pkgName, _this.loadedPackages[pkgName].map(function (item) { return item.getPath(); })];
        });
    };
    /**
     * Retrieves or defines the specified primitive class.
     */
    BootstrapClassLoader.prototype.getPrimitiveClass = function (typeStr) {
        var cdata = this.getClass(typeStr);
        if (cdata == null) {
            cdata = new ClassData_1.PrimitiveClassData(typeStr, this);
            this.addClass(typeStr, cdata);
        }
        return cdata;
    };
    /**
     * Asynchronously load the given class from the classpath.
     *
     * SHOULD ONLY BE INVOKED INTERNALLY BY THE CLASSLOADER.
     */
    BootstrapClassLoader.prototype._loadClass = function (thread, typeStr, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        debug("[BOOTSTRAP] Loading class " + typeStr);
        // This method is only valid for reference types!
        assert(util.is_reference_type(typeStr));
        // Search the class path for the class.
        var clsFilePath = util.descriptor2typestr(typeStr), cPathLen = this.classpath.length, toSearch = [], clsData;
        searchLoop: for (var i = 0; i < cPathLen; i++) {
            var item = this.classpath[i];
            switch (item.hasClass(clsFilePath)) {
                case enums_1.TriState.INDETERMINATE:
                    toSearch.push(item);
                    break;
                case enums_1.TriState.TRUE:
                    // Break out of the loop; TRUE paths are guaranteed to have the class.
                    toSearch.push(item);
                    break searchLoop;
            }
        }
        util.asyncFind(toSearch, function (pItem, callback) {
            pItem.loadClass(clsFilePath, function (err, data) {
                if (err) {
                    callback(false);
                }
                else {
                    clsData = data;
                    callback(true);
                }
            });
        }, function (pItem) {
            if (pItem) {
                var cls = _this.defineClass(thread, typeStr, clsData, null);
                if (cls !== null) {
                    _this._registerLoadedClass(clsFilePath, pItem);
                }
                cb(cls);
            }
            else {
                // No such class.
                debug("Could not find class " + typeStr);
                _this.throwClassNotFoundException(thread, typeStr, explicit);
                cb(null);
            }
        });
    };
    /**
     * Returns a listing of reference classes loaded in the bootstrap loader.
     */
    BootstrapClassLoader.prototype.getLoadedClassFiles = function () {
        var loadedClasses = this.getLoadedClassNames();
        return loadedClasses.filter(function (clsName) { return util.is_reference_type(clsName); });
    };
    /**
     * Returns the JVM object corresponding to this ClassLoader.
     * @todo Represent the bootstrap by something other than 'null'.
     * @todo These should be one-in-the-same.
     */
    BootstrapClassLoader.prototype.getLoaderObject = function () {
        return null;
    };
    /**
     * Returns the current classpath.
     */
    BootstrapClassLoader.prototype.getClassPath = function () {
        var cpLen = this.classpath.length, cpStrings = new Array(cpLen);
        for (var i = 0; i < cpLen; i++) {
            // Reverse it so it is the expected order (last item is first search target)
            cpStrings[i] = this.classpath[cpLen - i - 1].getPath();
        }
        return cpStrings;
    };
    /**
     * Returns the classpath item objects in the classpath.
     */
    BootstrapClassLoader.prototype.getClassPathItems = function () {
        return this.classpath.slice(0);
    };
    return BootstrapClassLoader;
})(ClassLoader);
exports.BootstrapClassLoader = BootstrapClassLoader;
/**
 * A Custom ClassLoader. Loads classes by calling loadClass on the user-defined
 * loader.
 */
var CustomClassLoader = (function (_super) {
    __extends(CustomClassLoader, _super);
    function CustomClassLoader(bootstrap, loaderObj) {
        _super.call(this, bootstrap);
        this.loaderObj = loaderObj;
    }
    /**
     * Asynchronously load the given class from the classpath. Calls the
     * classloader's loadClass method.
     *
     * SHOULD ONLY BE INVOKED BY THE CLASS LOADER.
     *
     * @param thread The thread that triggered the loading.
     * @param typeStr The type string of the class.
     * @param cb The callback that will be called with the loaded class. It will
     *   be passed a null if there is an error -- which also indicates that it
     *   threw an exception on the JVM thread.
     * @param explicit 'True' if loadClass was explicitly invoked by the program,
     *   false otherwise. This changes the exception/error that we throw.
     */
    CustomClassLoader.prototype._loadClass = function (thread, typeStr, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        debug("[CUSTOM] Loading class " + typeStr);
        // This method is only valid for reference types!
        assert(util.is_reference_type(typeStr));
        // Invoke the custom class loader.
        this.loaderObj['loadClass(Ljava/lang/String;)Ljava/lang/Class;'](thread, [util.initString(this.bootstrap, util.ext_classname(typeStr))], function (e, jco) {
            if (e) {
                // Exception! There was an issue defining the class.
                _this.throwClassNotFoundException(thread, typeStr, explicit);
                cb(null);
            }
            else {
                // Add the class returned by loadClass, in case the classloader
                // proxied loading to another classloader.
                var cls = jco.$cls;
                _this.addClass(typeStr, cls);
                cb(cls);
            }
        });
    };
    /**
     * Returns the JVM object corresponding to this ClassLoader.
     * @todo These should be one-in-the-same.
     */
    CustomClassLoader.prototype.getLoaderObject = function () {
        return this.loaderObj;
    };
    return CustomClassLoader;
})(ClassLoader);
exports.CustomClassLoader = CustomClassLoader;
