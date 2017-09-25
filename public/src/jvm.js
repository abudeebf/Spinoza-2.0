"use strict";
var util = require('./util');
var SafeMap = require('./SafeMap');
var ClassLoader = require('./ClassLoader');
var fs = require('fs');
var path = require('path');
var buffer = require('buffer');
var threading_1 = require('./threading');
var enums_1 = require('./enums');
var Heap = require('./heap');
var assert = require('./assert');
var Parker = require('./parker');
var threadpool_1 = require('./threadpool');
var JDKInfo = require('../vendor/java_home/jdk.json');
// Do not import, otherwise TypeScript will prune it.
// Referenced only in eval'd code.
var BrowserFS = require('browserfs');
var deflate = require('pako/lib/zlib/deflate');
var inflate = require('pako/lib/zlib/inflate');
var zstream = require('pako/lib/zlib/zstream');
var crc32 = require('pako/lib/zlib/crc32');
var adler32 = require('pako/lib/zlib/adler32');
// For version information.
var pkg;
if (util.are_in_browser()) {
    pkg = require('../package.json');
}
else {
    pkg = require('../../../package.json');
}
// XXX: We currently initialize these classes at JVM bootup. This is expensive.
// We should attempt to prune this list as much as possible.
var coreClasses = [
    'Ljava/lang/String;',
    'Ljava/lang/Class;', 'Ljava/lang/ClassLoader;',
    'Ljava/lang/reflect/Constructor;', 'Ljava/lang/reflect/Field;',
    'Ljava/lang/reflect/Method;',
    'Ljava/lang/Error;', 'Ljava/lang/StackTraceElement;',
    'Ljava/lang/System;',
    'Ljava/lang/Thread;',
    'Ljava/lang/ThreadGroup;',
    'Ljava/lang/Throwable;',
    'Ljava/nio/ByteOrder;',
    'Lsun/misc/VM;', 'Lsun/reflect/ConstantPool;', 'Ljava/lang/Byte;',
    'Ljava/lang/Character;', 'Ljava/lang/Double;', 'Ljava/lang/Float;',
    'Ljava/lang/Integer;', 'Ljava/lang/Long;', 'Ljava/lang/Short;',
    'Ljava/lang/Void;', 'Ljava/io/FileDescriptor;',
    'Ljava/lang/Boolean;', '[Lsun/management/MemoryManagerImpl;',
    '[Lsun/management/MemoryPoolImpl;',
    // Contains important FS constants used by natives. These constants are
    // inlined into JCL class files, so it typically never gets initialized
    // implicitly by the JVM.
    'Lsun/nio/fs/UnixConstants;'
];
/**
 * Encapsulates a single JVM instance.
 */
var JVM = (function () {
    /**
     * (Async) Construct a new instance of the Java Virtual Machine.
     */
    function JVM(opts, cb) {
        var _this = this;
        this.systemProperties = null;
        this.internedStrings = new SafeMap();
        this.bsCl = null;
        this.threadPool = null;
        this.natives = {};
        // 20MB heap
        // @todo Make heap resizeable.
        this.heap = new Heap(20 * 1024 * 1024);
        this.nativeClasspath = null;
        this.startupTime = new Date();
        this.terminationCb = null;
        // The initial JVM thread used to kick off execution.
        this.firstThread = null;
        this.responsiveness = null;
        this.enableSystemAssertions = false;
        this.enabledAssertions = false;
        this.disabledAssertions = [];
        this.systemClassLoader = null;
        this.nextRef = 0;
        // Set of all of the methods we want vtrace to be enabled on.
        // DEBUG builds only.
        this.vtraceMethods = {};
        // [DEBUG] directory to dump compiled code to.
        this.dumpCompiledCodeDir = null;
        // Handles parking/unparking threads.
        this.parker = new Parker();
        // The current status of the JVM.
        this.status = enums_1.JVMStatus.BOOTING;
        // The JVM's planned exit code.
        this.exitCode = 0;
        if (typeof (opts.doppioHomePath) !== 'string') {
            throw new TypeError("opts.doppioHomePath *must* be specified.");
        }
        opts = util.merge(JVM.getDefaultOptions(opts.doppioHomePath), opts);
        var bootstrapClasspath = opts.bootstrapClasspath.map(function (p) { return path.resolve(p); }), 
        // JVM bootup tasks, from first to last task.
        bootupTasks = [], firstThread, firstThreadObj;
        // Sanity checks.
        if (!Array.isArray(opts.bootstrapClasspath) || opts.bootstrapClasspath.length === 0) {
            throw new TypeError("opts.bootstrapClasspath must be specified as an array of file paths.");
        }
        if (!Array.isArray(opts.classpath)) {
            throw new TypeError("opts.classpath must be specified as an array of file paths.");
        }
        if (typeof (opts.javaHomePath) !== 'string') {
            throw new TypeError("opts.javaHomePath must be specified.");
        }
        if (!Array.isArray(opts.nativeClasspath) || opts.nativeClasspath.length === 0) {
            throw new TypeError("opts.nativeClasspath must be specified as an array of file paths.");
        }
        this.nativeClasspath = opts.nativeClasspath;
        if (opts.enableSystemAssertions) {
            this.enableSystemAssertions = opts.enableSystemAssertions;
        }
        if (opts.enableAssertions) {
            this.enabledAssertions = opts.enableAssertions;
        }
        if (opts.disableAssertions) {
            this.disabledAssertions = opts.disableAssertions;
        }
        this.responsiveness = opts.responsiveness;
        this._initSystemProperties(bootstrapClasspath, opts.classpath.map(function (p) { return path.resolve(p); }), path.resolve(opts.javaHomePath), path.resolve(opts.tmpDir), opts.properties);
        /**
         * Task #1: Initialize native methods.
         */
        bootupTasks.push(function (next) {
            _this.initializeNatives(next);
        });
        /**
         * Task #2: Construct the bootstrap class loader.
         */
        bootupTasks.push(function (next) {
            _this.bsCl =
                new ClassLoader.BootstrapClassLoader(_this.systemProperties['java.home'], bootstrapClasspath, next);
        });
        /**
         * Task #3: Construct the thread pool, resolve thread class, and construct
         * the first thread.
         */
        bootupTasks.push(function (next) {
            _this.threadPool = new threadpool_1["default"](function () { _this.threadPoolIsEmpty(); });
            // Resolve Ljava/lang/Thread so we can fake a thread.
            // NOTE: This should never actually use the Thread object unless
            // there's an error loading java/lang/Thread and associated classes.
            _this.bsCl.resolveClass(null, 'Ljava/lang/Thread;', function (threadCdata) {
                if (threadCdata == null) {
                    // Failed.
                    next("Failed to resolve java/lang/Thread.");
                }
                else {
                    // Construct a thread.
                    firstThreadObj = new (threadCdata.getConstructor(null))(null);
                    firstThreadObj.$thread = firstThread = _this.firstThread = new threading_1.JVMThread(_this, _this.threadPool, firstThreadObj);
                    firstThreadObj.ref = 1;
                    firstThreadObj['java/lang/Thread/priority'] = 5;
                    firstThreadObj['java/lang/Thread/name'] = util.initCarr(_this.bsCl, 'main');
                    firstThreadObj['java/lang/Thread/blockerLock'] = new (_this.bsCl.getResolvedClass('Ljava/lang/Object;').getConstructor(firstThread))(firstThread);
                    next();
                }
            });
        });
        /**
         * Task #4: Preinitialize some essential JVM classes, and initializes the
         * JVM's ThreadGroup once that class is initialized.
         */
        bootupTasks.push(function (next) {
            util.asyncForEach(coreClasses, function (coreClass, nextItem) {
                _this.bsCl.initializeClass(firstThread, coreClass, function (cdata) {
                    if (cdata == null) {
                        nextItem("Failed to initialize " + coreClass);
                    }
                    else {
                        // One of the later preinitialized classes references Thread.group.
                        // Initialize the system's ThreadGroup now.
                        if (coreClass === 'Ljava/lang/ThreadGroup;') {
                            // Construct a ThreadGroup object for the first thread.
                            var threadGroupCons = cdata.getConstructor(firstThread), groupObj = new threadGroupCons(firstThread);
                            groupObj['<init>()V'](firstThread, null, function (e) {
                                // Tell the initial thread to use this group.
                                firstThreadObj['java/lang/Thread/group'] = groupObj;
                                nextItem(e);
                            });
                        }
                        else {
                            nextItem();
                        }
                    }
                });
            }, next);
        });
        /**
         * Task #5: Initialize the system class.
         */
        bootupTasks.push(function (next) {
            // Initialize the system class (initializes things like println/etc).
            var sysInit = _this.bsCl.getInitializedClass(firstThread, 'Ljava/lang/System;').getConstructor(firstThread);
            sysInit['java/lang/System/initializeSystemClass()V'](firstThread, null, next);
            ;
        });
        /**
         * Task #6: Initialize the application's classloader.
         */
        bootupTasks.push(function (next) {
            var clCons = _this.bsCl.getInitializedClass(firstThread, 'Ljava/lang/ClassLoader;').getConstructor(firstThread);
            clCons['java/lang/ClassLoader/getSystemClassLoader()Ljava/lang/ClassLoader;'](firstThread, null, function (e, rv) {
                if (e) {
                    next(e);
                }
                else {
                    _this.systemClassLoader = rv.$loader;
                    firstThreadObj['java/lang/Thread/contextClassLoader'] = rv;
                    // Initialize assertion data.
                    // TODO: Is there a better way to force this? :|
                    var defaultAssertionStatus = _this.enabledAssertions === true ? 1 : 0;
                    rv['java/lang/ClassLoader/setDefaultAssertionStatus(Z)V'](firstThread, [defaultAssertionStatus], next);
                }
            });
        });
        // Perform bootup tasks, and then trigger the callback function.
        util.asyncSeries(bootupTasks, function (err) {
            // XXX: Without setImmediate, the firstThread won't clear out the stack
            // frame that triggered us, and the firstThread won't transition to a
            // 'terminated' status.
            setImmediate(function () {
                if (err) {
                    _this.status = enums_1.JVMStatus.TERMINATED;
                    cb(err);
                }
                else {
                    _this.status = enums_1.JVMStatus.BOOTED;
                    cb(null, _this);
                }
            });
        });
    }
    JVM.prototype.getResponsiveness = function () {
        var resp = this.responsiveness;
        if (typeof resp === 'number') {
            return resp;
        }
        else if (typeof resp === 'function') {
            return resp();
        }
    };
    JVM.getDefaultOptions = function (doppioHome) {
        var javaHome = path.join(doppioHome, 'vendor', 'java_home');
        return {
            doppioHomePath: doppioHome,
            classpath: ['.'],
            bootstrapClasspath: JDKInfo.classpath.map(function (item) { return path.join(javaHome, item); }),
            javaHomePath: javaHome,
            nativeClasspath: [path.join(doppioHome, 'natives')],
            enableSystemAssertions: false,
            enableAssertions: false,
            disableAssertions: null,
            properties: {},
            tmpDir: '/tmp',
            responsiveness: 1000
        };
    };
    /**
     * Get the URL to the version of the JDK that DoppioJVM was compiled with.
     */
    JVM.getCompiledJDKURL = function () {
        return JDKInfo.url;
    };
    /**
     * Get the JDK information that DoppioJVM was compiled against.
     */
    JVM.getJDKInfo = function () {
        return JDKInfo;
    };
    JVM.prototype.getSystemClassLoader = function () {
        return this.systemClassLoader;
    };
    JVM.isReleaseBuild = function () {
        return typeof (RELEASE) !== 'undefined' && RELEASE;
    };
    /**
     * Get the next "ref" number for JVM objects.
     */
    JVM.prototype.getNextRef = function () {
        return this.nextRef++;
    };
    /**
     * Retrieve the JVM's parker. Handles parking/unparking threads.
     */
    JVM.prototype.getParker = function () {
        return this.parker;
    };
    /**
     * Run the specified class on this JVM instance.
     * @param className The name of the class to run. Can be specified in either
     *   foo.bar.Baz or foo/bar/Baz format.
     * @param args Command line arguments passed to the class.
     * @param cb Called when the JVM finishes executing. Called with 'true' if
     *   the JVM exited normally, 'false' if there was an error.
     */
    JVM.prototype.runClass = function (className, args, cb) {
        var _this = this;
        if (this.status !== enums_1.JVMStatus.BOOTED) {
            switch (this.status) {
                case enums_1.JVMStatus.BOOTING:
                    throw new Error("JVM is currently booting up. Please wait for it to call the bootup callback, which you passed to the constructor.");
                case enums_1.JVMStatus.RUNNING:
                    throw new Error("JVM is already running.");
                case enums_1.JVMStatus.TERMINATED:
                    throw new Error("This JVM has already terminated. Please create a new JVM.");
                case enums_1.JVMStatus.TERMINATING:
                    throw new Error("This JVM is currently terminating. You should create a new JVM for each class you wish to run.");
            }
        }
        this.terminationCb = cb;
        var thread = this.firstThread;
        assert(thread != null, "Thread isn't created yet?");
        // Convert foo.bar.Baz => Lfoo/bar/Baz;
        className = util.int_classname(className);
        // Initialize the class.
        this.systemClassLoader.initializeClass(thread, className, function (cdata) {
            // If cdata is null, there was an error that ended execution.
            if (cdata != null) {
                // Convert the arguments.
                var strArrCons = _this.bsCl.getInitializedClass(thread, '[Ljava/lang/String;').getConstructor(thread), jvmifiedArgs = new strArrCons(thread, args.length), i;
                for (i = 0; i < args.length; i++) {
                    jvmifiedArgs.array[i] = util.initString(_this.bsCl, args[i]);
                }
                // Find the main method, and run it.
                _this.status = enums_1.JVMStatus.RUNNING;
                var cdataStatics = cdata.getConstructor(thread);
                if (cdataStatics['main([Ljava/lang/String;)V']) {
                    cdataStatics['main([Ljava/lang/String;)V'](thread, [jvmifiedArgs]);
                }
                else {
                    thread.throwNewException("Ljava/lang/NoSuchMethodError;", "Could not find main method in class " + cdata.getExternalName() + ".");
                }
            }
            else {
                process.stdout.write("Error: Could not find or load main class " + util.ext_classname(className) + "\n");
                // Erroneous exit.
                _this.terminationCb(1);
            }
        });
    };
    /**
     * [DEBUG] Returns 'true' if the specified method should be vtraced.
     */
    JVM.prototype.shouldVtrace = function (sig) {
        return this.vtraceMethods[sig] === true;
    };
    /**
     * [DEBUG] Specify a method to vtrace.
     */
    JVM.prototype.vtraceMethod = function (sig) {
        this.vtraceMethods[sig] = true;
    };
    /**
     * Run the specified JAR file on this JVM instance.
     * @param args Command line arguments passed to the class.
     * @param cb Called when the JVM finishes executing. Called with 'true' if
     *   the JVM exited normally, 'false' if there was an error.
     */
    JVM.prototype.runJar = function (args, cb) {
        this.runClass('doppio.JarLauncher', args, cb);
    };
    /**
     * Called when the ThreadPool is empty.
     */
    JVM.prototype.threadPoolIsEmpty = function () {
        var systemClass, systemCons;
        switch (this.status) {
            case enums_1.JVMStatus.BOOTING:
                // Ignore empty thread pools during boot process.
                return;
            case enums_1.JVMStatus.BOOTED:
                assert(false, "Thread pool should not become empty after JVM is booted, but before it begins to run.");
                return;
            case enums_1.JVMStatus.RUNNING:
                this.status = enums_1.JVMStatus.TERMINATING;
                systemClass = this.bsCl.getInitializedClass(this.firstThread, 'Ljava/lang/System;');
                assert(systemClass !== null, "Invariant failure: System class must be initialized when JVM is in RUNNING state.");
                systemCons = systemClass.getConstructor(this.firstThread);
                // This is a normal, non-erroneous exit. When this function completes, threadPoolIsEmpty() will be invoked again.
                systemCons['java/lang/System/exit(I)V'](this.firstThread, [0]);
                return;
            case enums_1.JVMStatus.TERMINATED:
                assert(false, "Invariant failure: Thread pool cannot be emptied post-JVM termination.");
                return;
            case enums_1.JVMStatus.TERMINATING:
                this.status = enums_1.JVMStatus.TERMINATED;
                if (this.terminationCb) {
                    this.terminationCb(this.exitCode);
                }
                return;
        }
    };
    /**
     * Check if the JVM has started running the main class.
     */
    JVM.prototype.hasVMBooted = function () {
        return !(this.status === enums_1.JVMStatus.BOOTING || this.status === enums_1.JVMStatus.BOOTED);
    };
    /**
     * Completely halt the JVM.
     */
    JVM.prototype.halt = function (status) {
        this.exitCode = status;
        this.status = enums_1.JVMStatus.TERMINATING;
        this.threadPool.getThreads().forEach(function (t) {
            t.setStatus(enums_1.ThreadStatus.TERMINATED);
        });
    };
    /**
     * Retrieve the given system property.
     */
    JVM.prototype.getSystemProperty = function (prop) {
        return this.systemProperties[prop];
    };
    /**
     * Retrieve an array of all of the system property names.
     */
    JVM.prototype.getSystemPropertyNames = function () {
        return Object.keys(this.systemProperties);
    };
    /**
     * Retrieve the unmanaged heap.
     */
    JVM.prototype.getHeap = function () {
        return this.heap;
    };
    /**
     * Interns the given JavaScript string. Returns the interned string.
     */
    JVM.prototype.internString = function (str, javaObj) {
        if (this.internedStrings.has(str)) {
            return this.internedStrings.get(str);
        }
        else {
            if (!javaObj) {
                javaObj = util.initString(this.bsCl, str);
            }
            this.internedStrings.set(str, javaObj);
            return javaObj;
        }
    };
    /**
     * Evaluate native modules. Emulates CommonJS functionality.
     */
    JVM.prototype.evalNativeModule = function (mod) {
        "use strict"; // Prevent eval from being terrible.
        var rv, 
        // Provide the natives with the Doppio API, if needed.
        DoppioJVM = require('./doppiojvm'), Buffer = buffer.Buffer, process2 = process, savedRequire = typeof require !== 'undefined' ? require : function (moduleName) {
            throw new Error("Cannot find module " + moduleName);
        };
        (function () {
            /* tslint:disable:no-unused-variable */
            /**
             * Called by the native method file. Registers the package's native
             * methods with the JVM.
             */
            function registerNatives(defs) {
                rv = defs;
            }
            /**
             * Emulates CommonJS require().
             * Placed into an eval() call to avoid browserify-dereq from
             * fucking renaming the goddamn thing to _dereq_.
             */
            eval("\nvar process = process2;\nfunction require(name) {\n  switch(name) {\n    case 'doppiojvm':\n    case '../doppiojvm':\n      return DoppioJVM;\n    case 'fs':\n      return fs;\n    case 'path':\n      return path;\n    case 'buffer':\n      return buffer;\n    case 'browserfs':\n      return BrowserFS;\n    case 'pako/lib/zlib/zstream':\n      return zstream;\n    case 'pako/lib/zlib/inflate':\n      return inflate;\n    case 'pako/lib/zlib/deflate':\n      return deflate;\n    case 'pako/lib/zlib/crc32':\n      return crc32;\n    case 'pako/lib/zlib/adler32':\n      return adler32;\n    default:\n      return savedRequire(name);\n  }\n}\n/**\n * Emulate AMD module 'define' function for natives compiled as AMD modules.\n */\nfunction define(resources, module) {\n  var args = [];\n  resources.forEach(function(resource) {\n    switch (resource) {\n      case 'require':\n        args.push(require);\n        break;\n      case 'exports':\n        args.push({});\n        break;\n      default:\n        args.push(require(resource));\n        break;\n    }\n  });\n  module.apply(null, args);\n}\neval(mod);\n");
            /* tslint:enable:no-unused-variable */
        })();
        return rv;
    };
    /**
     * Register native methods with the virtual machine.
     */
    JVM.prototype.registerNatives = function (newNatives) {
        var clsName, methSig;
        for (clsName in newNatives) {
            if (newNatives.hasOwnProperty(clsName)) {
                if (!this.natives.hasOwnProperty(clsName)) {
                    this.natives[clsName] = {};
                }
                var clsMethods = newNatives[clsName];
                for (methSig in clsMethods) {
                    if (clsMethods.hasOwnProperty(methSig)) {
                        // Don't check if it exists already. This allows us to overwrite
                        // native methods dynamically at runtime.
                        this.natives[clsName][methSig] = clsMethods[methSig];
                    }
                }
            }
        }
    };
    /**
     * Convenience function. Register a single native method with the virtual
     * machine. Can be used to update existing native methods based on runtime
     * information.
     */
    JVM.prototype.registerNative = function (clsName, methSig, native) {
        this.registerNatives({ clsName: { methSig: native } });
    };
    /**
     * Retrieve the native method for the given method of the given class.
     * Returns null if none found.
     */
    JVM.prototype.getNative = function (clsName, methSig) {
        clsName = util.descriptor2typestr(clsName);
        if (this.natives.hasOwnProperty(clsName)) {
            var clsMethods = this.natives[clsName];
            if (clsMethods.hasOwnProperty(methSig)) {
                return clsMethods[methSig];
            }
        }
        return null;
    };
    /**
     * !!DO NOT MUTATE THE RETURNED VALUE!!
     * Used by the find_invalid_natives tool.
     */
    JVM.prototype.getNatives = function () {
        return this.natives;
    };
    /**
     * Loads in all of the native method modules prior to execution.
     * Currently a hack around our classloader.
     * @todo Make neater with util.async stuff.
     */
    JVM.prototype.initializeNatives = function (doneCb) {
        var _this = this;
        var nextDir = function () {
            if (i === _this.nativeClasspath.length) {
                // Next phase: Load up the files.
                var count = processFiles.length;
                processFiles.forEach(function (file) {
                    fs.readFile(file, function (err, data) {
                        if (!err) {
                            _this.registerNatives(_this.evalNativeModule(data.toString()));
                        }
                        if (--count === 0) {
                            doneCb();
                        }
                    });
                });
            }
            else {
                var dir = _this.nativeClasspath[i++];
                fs.readdir(dir, function (err, files) {
                    if (err) {
                        return doneCb();
                    }
                    var j, file;
                    for (j = 0; j < files.length; j++) {
                        file = files[j];
                        if (file.substring(file.length - 3, file.length) === '.js') {
                            processFiles.push(path.join(dir, file));
                        }
                    }
                    nextDir();
                });
            }
        }, i = 0, processFiles = [];
        nextDir();
    };
    /**
     * [Private] Same as reset_system_properties, but called by the constructor.
     */
    JVM.prototype._initSystemProperties = function (bootstrapClasspath, javaClassPath, javaHomePath, tmpDir, opts) {
        this.systemProperties = util.merge({
            'java.class.path': javaClassPath.join(':'),
            'java.home': javaHomePath,
            'java.ext.dirs': path.join(javaHomePath, 'lib', 'ext'),
            'java.io.tmpdir': tmpDir,
            'sun.boot.class.path': bootstrapClasspath.join(':'),
            'file.encoding': 'UTF-8',
            'java.vendor': 'Doppio',
            'java.version': '1.8',
            'java.vendor.url': 'https://github.com/plasma-umass/doppio',
            'java.class.version': '52.0',
            'java.specification.version': '1.8',
            'line.separator': '\n',
            'file.separator': path.sep,
            'path.separator': ':',
            'user.dir': path.resolve('.'),
            'user.home': '.',
            'user.name': 'DoppioUser',
            'os.name': 'doppio',
            'os.arch': 'js',
            'os.version': '0',
            'java.vm.name': 'DoppioJVM 32-bit VM',
            'java.vm.version': pkg.version,
            'java.vm.vendor': 'PLASMA@UMass',
            'java.awt.headless': (util.are_in_browser()).toString(),
            'java.awt.graphicsenv': 'classes.awt.CanvasGraphicsEnvironment',
            'jline.terminal': 'jline.UnsupportedTerminal',
            'sun.arch.data.model': '32',
            'sun.jnu.encoding': "UTF-8" // Determines how Java parses command line options.
        }, opts);
    };
    /**
     * Retrieves the bootstrap class loader.
     */
    JVM.prototype.getBootstrapClassLoader = function () {
        return this.bsCl;
    };
    JVM.prototype.getStartupTime = function () {
        return this.startupTime;
    };
    /**
     * Returns `true` if system assertions are enabled, false otherwise.
     */
    JVM.prototype.areSystemAssertionsEnabled = function () {
        return this.enableSystemAssertions;
    };
    /**
     * Get a listing of classes with assertions enabled. Can also return 'true' or 'false.
     */
    JVM.prototype.getEnabledAssertions = function () {
        return this.enabledAssertions;
    };
    /**
     * Get a listing of classes with assertions disabled.
     */
    JVM.prototype.getDisabledAssertions = function () {
        return this.disabledAssertions;
    };
    /**
     * Specifies a directory to dump compiled code to.
     */
    JVM.prototype.dumpCompiledCode = function (dir) {
        this.dumpCompiledCodeDir = dir;
    };
    JVM.prototype.shouldDumpCompiledCode = function () {
        return this.dumpCompiledCodeDir !== null;
    };
    JVM.prototype.dumpObjectDefinition = function (cls, evalText) {
        if (this.shouldDumpCompiledCode()) {
            fs.writeFile(path.resolve(this.dumpCompiledCodeDir, cls.getExternalName() + "_object.dump"), evalText, function () { });
        }
    };
    JVM.prototype.dumpBridgeMethod = function (methodSig, evalText) {
        if (this.shouldDumpCompiledCode()) {
            fs.appendFile(path.resolve(this.dumpCompiledCodeDir, "vmtarget_bridge_methods.dump"), methodSig + ":\n" + evalText + "\n\n", function () { });
        }
    };
    /**
     * Asynchronously dumps JVM state to a file. Currently limited to thread
     * state.
     */
    JVM.prototype.dumpState = function (filename, cb) {
        fs.appendFile(filename, this.threadPool.getThreads().map(function (t) { return ("Thread " + t.getRef() + ":\n") + t.getPrintableStackTrace(); }).join("\n\n"), cb);
    };
    return JVM;
})();
module.exports = JVM;
