"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var util = require('./util');
var attributes = require('./attributes');
var assert = require('./assert');
var enums = require('./enums');
var StringOutputStream = require('./StringOutputStream');
var global = require('./global');
if (typeof RELEASE === 'undefined')
    global.RELEASE = false;
var trapped_methods = {
    'java/lang/ref/Reference': {
        // NOP, because we don't do our own GC and also this starts a thread?!?!?!
        '<clinit>()V': function (thread) { }
    },
    'java/lang/System': {
        'loadLibrary(Ljava/lang/String;)V': function (thread, libName) {
            // Some libraries test if native libraries are available,
            // and expect an exception if they are not.
            // List all of the native libraries we support.
            var lib = libName.toString();
            switch (lib) {
                case 'zip':
                case 'net':
                case 'nio':
                case 'awt':
                case 'fontmanager':
                case 'management':
                    return;
                default:
                    thread.throwNewException('Ljava/lang/UnsatisfiedLinkError;', "no " + lib + " in java.library.path");
                    break;
            }
        }
    },
    'java/lang/Terminator': {
        'setup()V': function (thread) {
            // XXX: We should probably fix this; we support threads now.
            // Historically: NOP'd because we didn't support threads.
        }
    },
    'java/nio/charset/Charset$3': {
        // this is trapped and NOP'ed for speed
        'run()Ljava/lang/Object;': function (thread, javaThis) {
            return null;
        }
    },
    'sun/nio/fs/DefaultFileSystemProvider': {
        // OpenJDK doesn't know what the "Doppio" platform is. Tell it to use the Linux file system.
        'create()Ljava/nio/file/spi/FileSystemProvider;': function (thread) {
            thread.setStatus(enums.ThreadStatus.ASYNC_WAITING);
            var dfsp = thread.getBsCl().getInitializedClass(thread, 'Lsun/nio/fs/DefaultFileSystemProvider;'), dfspCls = dfsp.getConstructor(thread);
            dfspCls['createProvider(Ljava/lang/String;)Ljava/nio/file/spi/FileSystemProvider;'](thread, [thread.getJVM().internString('sun.nio.fs.LinuxFileSystemProvider')], util.forwardResult(thread));
        }
    }
};
function getTrappedMethod(clsName, methSig) {
    clsName = util.descriptor2typestr(clsName);
    if (trapped_methods.hasOwnProperty(clsName) && trapped_methods[clsName].hasOwnProperty(methSig)) {
        return trapped_methods[clsName][methSig];
    }
    return null;
}
/**
 * Shared functionality between Method and Field objects, as they are
 * represented similarly in class files.
 */
var AbstractMethodField = (function () {
    /**
     * Constructs a field or method object from raw class data.
     */
    function AbstractMethodField(cls, constantPool, slot, byteStream) {
        this.cls = cls;
        this.slot = slot;
        this.accessFlags = new util.Flags(byteStream.getUint16());
        this.name = constantPool.get(byteStream.getUint16()).value;
        this.rawDescriptor = constantPool.get(byteStream.getUint16()).value;
        this.attrs = attributes.makeAttributes(byteStream, constantPool);
    }
    AbstractMethodField.prototype.getAttribute = function (name) {
        for (var i = 0; i < this.attrs.length; i++) {
            var attr = this.attrs[i];
            if (attr.getName() === name) {
                return attr;
            }
        }
        return null;
    };
    AbstractMethodField.prototype.getAttributes = function (name) {
        return this.attrs.filter(function (attr) { return attr.getName() === name; });
    };
    /**
     * Get the particular type of annotation as a JVM byte array. Returns null
     * if the annotation does not exist.
     */
    AbstractMethodField.prototype.getAnnotationType = function (thread, name) {
        var annotation = this.getAttribute(name);
        if (annotation === null) {
            return null;
        }
        var byteArrCons = thread.getBsCl().getInitializedClass(thread, '[B').getConstructor(thread), rv = new byteArrCons(thread, 0);
        // TODO: Convert to typed array.
        var i, len = annotation.rawBytes.length, arr = new Array(len);
        for (i = 0; i < len; i++) {
            arr[i] = annotation.rawBytes.readInt8(i);
        }
        rv.array = arr;
        return rv;
    };
    // To satiate TypeScript. Consider it an 'abstract' method.
    AbstractMethodField.prototype.parseDescriptor = function (raw_descriptor) {
        throw new Error("Unimplemented error.");
    };
    return AbstractMethodField;
})();
exports.AbstractMethodField = AbstractMethodField;
var Field = (function (_super) {
    __extends(Field, _super);
    function Field(cls, constantPool, slot, byteStream) {
        _super.call(this, cls, constantPool, slot, byteStream);
        this.fullName = util.descriptor2typestr(cls.getInternalName()) + "/" + this.name;
    }
    /**
     * Calls cb with the reflectedField if it succeeds. Calls cb with null if it
     * fails.
     */
    Field.prototype.reflector = function (thread, cb) {
        var _this = this;
        var signatureAttr = this.getAttribute("Signature"), jvm = thread.getJVM(), bsCl = thread.getBsCl();
        var createObj = function (typeObj) {
            var fieldCls = bsCl.getInitializedClass(thread, 'Ljava/lang/reflect/Field;'), fieldObj = new (fieldCls.getConstructor(thread))(thread);
            fieldObj['java/lang/reflect/Field/clazz'] = _this.cls.getClassObject(thread);
            fieldObj['java/lang/reflect/Field/name'] = jvm.internString(_this.name);
            fieldObj['java/lang/reflect/Field/type'] = typeObj;
            fieldObj['java/lang/reflect/Field/modifiers'] = _this.accessFlags.getRawByte();
            fieldObj['java/lang/reflect/Field/slot'] = _this.slot;
            fieldObj['java/lang/reflect/Field/signature'] = signatureAttr !== null ? util.initString(bsCl, signatureAttr.sig) : null;
            fieldObj['java/lang/reflect/Field/annotations'] = _this.getAnnotationType(thread, 'RuntimeVisibleAnnotations');
            return fieldObj;
        };
        // Our field's type may not be loaded, so we asynchronously load it here.
        // In the future, we can speed up reflection by having a synchronous_reflector
        // method that we can try first, and which may fail.
        this.cls.getLoader().resolveClass(thread, this.rawDescriptor, function (cdata) {
            if (cdata != null) {
                cb(createObj(cdata.getClassObject(thread)));
            }
            else {
                cb(null);
            }
        });
    };
    Field.prototype.getDefaultFieldValue = function () {
        var desc = this.rawDescriptor;
        if (desc === 'J')
            return 'gLongZero';
        var c = desc[0];
        if (c === '[' || c === 'L')
            return 'null';
        return '0';
    };
    /**
     * Outputs a JavaScript field assignment for this field.
     */
    Field.prototype.outputJavaScriptField = function (jsConsName, outputStream) {
        if (this.accessFlags.isStatic()) {
            outputStream.write(jsConsName + "[\"" + util.reescapeJVMName(this.fullName) + "\"] = cls._getInitialStaticFieldValue(thread, \"" + util.reescapeJVMName(this.name) + "\");\n");
        }
        else {
            outputStream.write("this[\"" + util.reescapeJVMName(this.fullName) + "\"] = " + this.getDefaultFieldValue() + ";\n");
        }
    };
    return Field;
})(AbstractMethodField);
exports.Field = Field;
var Method = (function (_super) {
    __extends(Method, _super);
    function Method(cls, constantPool, slot, byteStream) {
        _super.call(this, cls, constantPool, slot, byteStream);
        var parsedDescriptor = util.getTypes(this.rawDescriptor), i, p;
        this.signature = this.name + this.rawDescriptor;
        this.fullSignature = util.descriptor2typestr(this.cls.getInternalName()) + "/" + this.signature;
        this.returnType = parsedDescriptor.pop();
        this.parameterTypes = parsedDescriptor;
        this.parameterWords = parsedDescriptor.length;
        // Double count doubles / longs.
        for (i = 0; i < this.parameterTypes.length; i++) {
            p = this.parameterTypes[i];
            if (p === 'D' || p === 'J') {
                this.parameterWords++;
            }
        }
        // Initialize 'code' property.
        var clsName = this.cls.getInternalName();
        if (getTrappedMethod(clsName, this.signature) !== null) {
            this.code = getTrappedMethod(clsName, this.signature);
            this.accessFlags.setNative(true);
        }
        else if (this.accessFlags.isNative()) {
            if (this.signature.indexOf('registerNatives()V', 0) < 0 && this.signature.indexOf('initIDs()V', 0) < 0) {
                // The first version of the native method attempts to fetch itself and
                // rewrite itself.
                var self = this;
                this.code = function (thread) {
                    // Try to fetch the native method.
                    var jvm = thread.getJVM(), c = jvm.getNative(clsName, self.signature);
                    if (c == null) {
                        thread.throwNewException('Ljava/lang/UnsatisfiedLinkError;', "Native method '" + self.getFullSignature() + "' not implemented.\nPlease fix or file a bug at https://github.com/plasma-umass/doppio/issues");
                    }
                    else {
                        self.code = c;
                        return c.apply(self, arguments);
                    }
                };
            }
            else {
                // Stub out initIDs and registerNatives.
                this.code = function () { };
            }
        }
        else if (!this.accessFlags.isAbstract()) {
            this.code = this.getAttribute('Code');
        }
    }
    /**
     * Checks if the method is a default method.
     * A default method is a public non-abstract instance method, that
     * is, a non-static method with a body, declared in an interface
     * type.
     */
    Method.prototype.isDefault = function () {
        return (this.accessFlags.isPublic() && !this.accessFlags.isAbstract() && !this.accessFlags.isStatic() && this.cls.accessFlags.isInterface());
    };
    Method.prototype.getFullSignature = function () {
        return this.cls.getExternalName() + "." + this.name + this.rawDescriptor;
    };
    /**
     * Checks if this particular method should be hidden in stack frames.
     * Used by OpenJDK's lambda implementation to hide lambda boilerplate.
     */
    Method.prototype.isHidden = function () {
        var rva = this.getAttribute('RuntimeVisibleAnnotations');
        return rva !== null && rva.isHidden;
    };
    /**
     * Checks if this particular method has the CallerSensitive annotation.
     */
    Method.prototype.isCallerSensitive = function () {
        var rva = this.getAttribute('RuntimeVisibleAnnotations');
        return rva !== null && rva.isCallerSensitive;
    };
    /**
     * Get the number of machine words (32-bit words) required to store the
     * parameters to this function. Includes adding in a machine word for 'this'
     * for non-static functions.
     */
    Method.prototype.getParamWordSize = function () {
        return this.parameterWords;
    };
    Method.prototype.getCodeAttribute = function () {
        assert(!this.accessFlags.isNative() && !this.accessFlags.isAbstract());
        return this.code;
    };
    Method.prototype.getNativeFunction = function () {
        assert(this.accessFlags.isNative() && typeof (this.code) === 'function');
        return this.code;
    };
    /**
     * Resolves all of the classes referenced through this method. Required in
     * order to create its reflection object.
     */
    Method.prototype._resolveReferencedClasses = function (thread, cb) {
        // Start with the return type + parameter types + reflection object types.
        var toResolve = this.parameterTypes.concat(this.returnType), code = this.code, exceptionAttribute = this.getAttribute("Exceptions");
        // Exception handler types.
        if (!this.accessFlags.isNative() && !this.accessFlags.isAbstract() && code.exceptionHandlers.length > 0) {
            toResolve.push('Ljava/lang/Throwable;'); // Mimic native Java (in case <any> is the only handler).
            // Filter out the <any> handlers.
            toResolve = toResolve.concat(code.exceptionHandlers.filter(function (handler) { return handler.catchType !== '<any>'; }).map(function (handler) { return handler.catchType; }));
        }
        // Resolve checked exception types.
        if (exceptionAttribute !== null) {
            toResolve = toResolve.concat(exceptionAttribute.exceptions);
        }
        this.cls.getLoader().resolveClasses(thread, toResolve, function (classes) {
            // Use bootstrap classloader for reflection classes.
            thread.getBsCl().resolveClasses(thread, ['Ljava/lang/reflect/Method;', 'Ljava/lang/reflect/Constructor;'], function (classes2) {
                if (classes === null || classes2 === null) {
                    cb(null);
                }
                else {
                    classes['Ljava/lang/reflect/Method;'] = classes2['Ljava/lang/reflect/Method;'];
                    classes['Ljava/lang/reflect/Constructor;'] = classes2['Ljava/lang/reflect/Constructor;'];
                    cb(classes);
                }
            });
        });
    };
    /**
     * Get a reflection object representing this method.
     */
    Method.prototype.reflector = function (thread, cb) {
        var _this = this;
        var bsCl = thread.getBsCl(), 
        // Grab the classes required to construct the needed arrays.
        clazzArray = bsCl.getInitializedClass(thread, '[Ljava/lang/Class;').getConstructor(thread), jvm = thread.getJVM(), 
        // Grab the needed attributes.
        signatureAttr = this.getAttribute("Signature"), exceptionAttr = this.getAttribute("Exceptions");
        // Retrieve all of the required class references.
        this._resolveReferencedClasses(thread, function (classes) {
            if (classes === null) {
                return cb(null);
            }
            // Construct the needed objects for the reflection object.
            var clazz = _this.cls.getClassObject(thread), name = jvm.internString(_this.name), parameterTypes = new clazzArray(thread, 0), returnType = classes[_this.returnType].getClassObject(thread), exceptionTypes = new clazzArray(thread, 0), modifiers = _this.accessFlags.getRawByte(), signature = signatureAttr !== null ? jvm.internString(signatureAttr.sig) : null;
            // Prepare the class arrays.
            parameterTypes.array = _this.parameterTypes.map(function (ptype) { return classes[ptype].getClassObject(thread); });
            if (exceptionAttr !== null) {
                exceptionTypes.array = exceptionAttr.exceptions.map(function (eType) { return classes[eType].getClassObject(thread); });
            }
            if (_this.name === '<init>') {
                // Constructor object.
                var consCons = classes['Ljava/lang/reflect/Constructor;'].getConstructor(thread), consObj = new consCons(thread);
                consObj['java/lang/reflect/Constructor/clazz'] = clazz;
                consObj['java/lang/reflect/Constructor/parameterTypes'] = parameterTypes;
                consObj['java/lang/reflect/Constructor/exceptionTypes'] = exceptionTypes;
                consObj['java/lang/reflect/Constructor/modifiers'] = modifiers;
                consObj['java/lang/reflect/Constructor/slot'] = _this.slot;
                consObj['java/lang/reflect/Constructor/signature'] = signature;
                consObj['java/lang/reflect/Constructor/annotations'] = _this.getAnnotationType(thread, 'RuntimeVisibleAnnotations');
                consObj['java/lang/reflect/Constructor/parameterAnnotations'] = _this.getAnnotationType(thread, 'RuntimeVisibleParameterAnnotations');
                cb(consObj);
            }
            else {
                // Method object.
                var methodCons = classes['Ljava/lang/reflect/Method;'].getConstructor(thread), methodObj = new methodCons(thread);
                methodObj['java/lang/reflect/Method/clazz'] = clazz;
                methodObj['java/lang/reflect/Method/name'] = name;
                methodObj['java/lang/reflect/Method/parameterTypes'] = parameterTypes;
                methodObj['java/lang/reflect/Method/returnType'] = returnType;
                methodObj['java/lang/reflect/Method/exceptionTypes'] = exceptionTypes;
                methodObj['java/lang/reflect/Method/modifiers'] = modifiers;
                methodObj['java/lang/reflect/Method/slot'] = _this.slot;
                methodObj['java/lang/reflect/Method/signature'] = signature;
                methodObj['java/lang/reflect/Method/annotations'] = _this.getAnnotationType(thread, 'RuntimeVisibleAnnotations');
                methodObj['java/lang/reflect/Method/annotationDefault'] = _this.getAnnotationType(thread, 'AnnotationDefault');
                methodObj['java/lang/reflect/Method/parameterAnnotations'] = _this.getAnnotationType(thread, 'RuntimeVisibleParameterAnnotations');
                cb(methodObj);
            }
        });
    };
    /**
     * Convert the arguments to this method into a form suitable for a native
     * implementation.
     *
     * The JVM uses two parameter slots for double and long values, since they
     * consist of two JVM machine words (32-bits). Doppio stores the entire value
     * in one slot, and stores a NULL in the second.
     *
     * This function strips out these NULLs so the arguments are in a more
     * consistent form. The return value is the arguments to this function without
     * these NULL values. It also adds the 'thread' object to the start of the
     * arguments array.
     */
    Method.prototype.convertArgs = function (thread, params) {
        if (this.isSignaturePolymorphic()) {
            // These don't need any conversion, and have arbitrary arguments.
            // Just append the thread object.
            params.unshift(thread);
            return params;
        }
        var convertedArgs = [thread], argIdx = 0, i;
        if (!this.accessFlags.isStatic()) {
            convertedArgs.push(params[0]);
            argIdx = 1;
        }
        for (i = 0; i < this.parameterTypes.length; i++) {
            var p = this.parameterTypes[i];
            convertedArgs.push(params[argIdx]);
            argIdx += (p === 'J' || p === 'D') ? 2 : 1;
        }
        return convertedArgs;
    };
    /**
     * Lock this particular method.
     */
    Method.prototype.methodLock = function (thread, frame) {
        if (this.accessFlags.isStatic()) {
            // Static methods lock the class.
            return this.cls.getClassObject(thread).getMonitor();
        }
        else {
            // Non-static methods lock the instance.
            return frame.locals[0].getMonitor();
        }
    };
    /**
     * Check if this is a signature polymorphic method.
     * From S2.9:
     * A method is signature polymorphic if and only if all of the following conditions hold :
     * * It is declared in the java.lang.invoke.MethodHandle class.
     * * It has a single formal parameter of type Object[].
     * * It has a return type of Object.
     * * It has the ACC_VARARGS and ACC_NATIVE flags set.
     */
    Method.prototype.isSignaturePolymorphic = function () {
        return this.cls.getInternalName() === 'Ljava/lang/invoke/MethodHandle;' &&
            this.accessFlags.isNative() && this.accessFlags.isVarArgs() &&
            this.rawDescriptor === '([Ljava/lang/Object;)Ljava/lang/Object;';
    };
    /**
     * Retrieve the MemberName/invokedynamic JavaScript "bridge method" that
     * encapsulates the logic required to call this particular method.
     */
    Method.prototype.getVMTargetBridgeMethod = function (thread, refKind) {
        // TODO: Could cache these in the Method object if desired.
        var outStream = new StringOutputStream(), virtualDispatch = !(refKind === enums.MethodHandleReferenceKind.INVOKESTATIC || refKind === enums.MethodHandleReferenceKind.INVOKESPECIAL);
        outStream.write("function _create(thread, cls, util) {\n");
        if (this.accessFlags.isStatic()) {
            assert(!virtualDispatch, "Can't have static virtual dispatch.");
            outStream.write("  var jsCons = cls.getConstructor(thread);\n");
        }
        outStream.write("  function bridgeMethod(thread, descriptor, args, cb) {\n");
        if (!this.accessFlags.isStatic()) {
            outStream.write("    var obj = args.shift();\n");
            outStream.write("    if (obj === null) { return thread.throwNewException('Ljava/lang/NullPointerException;', ''); }\n");
            outStream.write("    obj[\"" + util.reescapeJVMName(virtualDispatch ? this.signature : this.fullSignature) + "\"](thread, ");
        }
        else {
            outStream.write("    jsCons[\"" + util.reescapeJVMName(this.fullSignature) + "\"](thread, ");
        }
        // TODO: Is it ever appropriate to box arguments for varargs functions? It appears not.
        outStream.write("args");
        outStream.write(", cb);\n  }\n  return bridgeMethod;\n}\n_create");
        var evalText = outStream.flush();
        if (typeof RELEASE === 'undefined' && thread !== null && thread.getJVM().shouldDumpCompiledCode()) {
            thread.getJVM().dumpBridgeMethod(this.fullSignature, evalText);
        }
        return eval(evalText)(thread, this.cls, util);
    };
    /**
     * Generates JavaScript code for this particular method.
     * TODO: Move lock logic and such into this function! And other specialization.
     * TODO: Signature polymorphic functions...?
     */
    Method.prototype.outputJavaScriptFunction = function (jsConsName, outStream, nonVirtualOnly) {
        if (nonVirtualOnly === void 0) { nonVirtualOnly = false; }
        var i;
        if (this.accessFlags.isStatic()) {
            outStream.write(jsConsName + "[\"" + util.reescapeJVMName(this.fullSignature) + "\"] = " + jsConsName + "[\"" + util.reescapeJVMName(this.signature) + "\"] = ");
        }
        else {
            if (!nonVirtualOnly) {
                outStream.write(jsConsName + ".prototype[\"" + util.reescapeJVMName(this.signature) + "\"] = ");
            }
            outStream.write(jsConsName + ".prototype[\"" + util.reescapeJVMName(this.fullSignature) + "\"] = ");
        }
        // cb check is boilerplate, required for natives calling into JVM land.
        outStream.write("(function(method) {\n  return function(thread, args, cb) {\n    if (typeof cb === 'function') {\n      thread.stack.push(new InternalStackFrame(cb));\n    }\n    thread.stack.push(new " + (this.accessFlags.isNative() ? "NativeStackFrame" : "BytecodeStackFrame") + "(method, ");
        if (!this.accessFlags.isStatic()) {
            // Non-static functions need to add the implicit 'this' variable to the
            // local variables.
            outStream.write("[this");
            // Give the JS engine hints about the size, type, and contents of the array
            // by making it a literal.
            for (i = 0; i < this.parameterWords; i++) {
                outStream.write(", args[" + i + "]");
            }
            outStream.write("]");
        }
        else {
            // Static function doesn't need to mutate the arguments.
            if (this.parameterWords > 0) {
                outStream.write("args");
            }
            else {
                outStream.write("[]");
            }
        }
        outStream.write("));\n    thread.setStatus(" + enums.ThreadStatus.RUNNABLE + ");\n  };\n})(cls.getSpecificMethod(\"" + util.reescapeJVMName(this.cls.getInternalName()) + "\", \"" + util.reescapeJVMName(this.signature) + "\"));\n");
    };
    return Method;
})(AbstractMethodField);
exports.Method = Method;
