"use strict";
var util = require('./util');
var enums = require('./enums');
var assert = require('./assert');
/**
 * Stores all of the constant pool classes, keyed on their enum value.
 */
var CP_CLASSES = {};
// #region Tier 0
/**
 * Represents a constant UTF-8 string.
 * ```
 * CONSTANT_Utf8_info {
 *   u1 tag;
 *   u2 length;
 *   u1 bytes[length];
 * }
 * ```
 */
var ConstUTF8 = (function () {
    function ConstUTF8(rawBytes) {
        this.value = this.bytes2str(rawBytes);
    }
    /**
     * Parse Java's pseudo-UTF-8 strings into valid UTF-16 codepoints (spec 4.4.7)
     * Note that Java uses UTF-16 internally by default for string representation,
     * and the pseudo-UTF-8 strings are *only* used for serialization purposes.
     * Thus, there is no reason for other parts of the code to call this routine!
     * TODO: To avoid copying, create a character array for this data.
     * http://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html#jvms-4.4.7
     */
    ConstUTF8.prototype.bytes2str = function (bytes) {
        var y, z, v, w, x, charCode, idx = 0, rv = '';
        while (idx < bytes.length) {
            x = bytes.readUInt8(idx++) & 0xff;
            // While the standard specifies that surrogate pairs should be handled, it seems like
            // they are by default with the three byte format. See parsing code here:
            // http://hg.openjdk.java.net/jdk8u/jdk8u-dev/jdk/file/3623f1b29b58/src/share/classes/java/io/DataInputStream.java#l618
            // One UTF-16 character.
            if (x <= 0x7f) {
                // One character, one byte.
                charCode = x;
            }
            else if (x <= 0xdf) {
                // One character, two bytes.
                y = bytes.readUInt8(idx++);
                charCode = ((x & 0x1f) << 6) + (y & 0x3f);
            }
            else {
                // One character, three bytes.
                y = bytes.readUInt8(idx++);
                z = bytes.readUInt8(idx++);
                charCode = ((x & 0xf) << 12) + ((y & 0x3f) << 6) + (z & 0x3f);
            }
            rv += String.fromCharCode(charCode);
        }
        return rv;
    };
    ConstUTF8.prototype.getType = function () {
        return enums.ConstantPoolItemType.UTF8;
    };
    ConstUTF8.prototype.getConstant = function (thread) { return this.value; };
    ConstUTF8.prototype.isResolved = function () { return true; };
    ConstUTF8.fromBytes = function (byteStream, constantPool) {
        var strlen = byteStream.getUint16();
        return new this(byteStream.read(strlen));
    };
    ConstUTF8.size = 1;
    // Variable-size.
    ConstUTF8.infoByteSize = 0;
    return ConstUTF8;
})();
exports.ConstUTF8 = ConstUTF8;
CP_CLASSES[enums.ConstantPoolItemType.UTF8] = ConstUTF8;
/**
 * Represents a constant 32-bit integer.
 * ```
 * CONSTANT_Integer_info {
 *   u1 tag;
 *   u4 bytes;
 * }
 * ```
 */
var ConstInt32 = (function () {
    function ConstInt32(value) {
        this.value = value;
    }
    ConstInt32.prototype.getType = function () {
        return enums.ConstantPoolItemType.INTEGER;
    };
    ConstInt32.prototype.getConstant = function (thread) { return this.value; };
    ConstInt32.prototype.isResolved = function () { return true; };
    ConstInt32.fromBytes = function (byteStream, constantPool) {
        return new this(byteStream.getInt32());
    };
    ConstInt32.size = 1;
    ConstInt32.infoByteSize = 4;
    return ConstInt32;
})();
exports.ConstInt32 = ConstInt32;
CP_CLASSES[enums.ConstantPoolItemType.INTEGER] = ConstInt32;
/**
 * Represents a constant 32-bit floating point number.
 * ```
 * CONSTANT_Float_info {
 *   u1 tag;
 *   u4 bytes;
 * }
 * ```
 */
var ConstFloat = (function () {
    function ConstFloat(value) {
        this.value = value;
    }
    ConstFloat.prototype.getType = function () {
        return enums.ConstantPoolItemType.FLOAT;
    };
    ConstFloat.prototype.getConstant = function (thread) { return this.value; };
    ConstFloat.prototype.isResolved = function () { return true; };
    ConstFloat.fromBytes = function (byteStream, constantPool) {
        return new this(byteStream.getFloat());
    };
    ConstFloat.size = 1;
    ConstFloat.infoByteSize = 4;
    return ConstFloat;
})();
exports.ConstFloat = ConstFloat;
CP_CLASSES[enums.ConstantPoolItemType.FLOAT] = ConstFloat;
/**
 * Represents a constant 64-bit integer.
 * ```
 * CONSTANT_Long_info {
 *   u1 tag;
 *   u4 high_bytes;
 *   u4 low_bytes;
 * }
 * ```
 */
var ConstLong = (function () {
    function ConstLong(value) {
        this.value = value;
    }
    ConstLong.prototype.getType = function () {
        return enums.ConstantPoolItemType.LONG;
    };
    ConstLong.prototype.getConstant = function (thread) { return this.value; };
    ConstLong.prototype.isResolved = function () { return true; };
    ConstLong.fromBytes = function (byteStream, constantPool) {
        return new this(byteStream.getInt64());
    };
    ConstLong.size = 2;
    ConstLong.infoByteSize = 8;
    return ConstLong;
})();
exports.ConstLong = ConstLong;
CP_CLASSES[enums.ConstantPoolItemType.LONG] = ConstLong;
/**
 * Represents a constant 64-bit floating point number.
 * ```
 * CONSTANT_Double_info {
 *   u1 tag;
 *   u4 high_bytes;
 *   u4 low_bytes;
 * }
 * ```
 */
var ConstDouble = (function () {
    function ConstDouble(value) {
        this.value = value;
    }
    ConstDouble.prototype.getType = function () {
        return enums.ConstantPoolItemType.DOUBLE;
    };
    ConstDouble.prototype.getConstant = function (thread) { return this.value; };
    ConstDouble.prototype.isResolved = function () { return true; };
    ConstDouble.fromBytes = function (byteStream, constantPool) {
        return new this(byteStream.getDouble());
    };
    ConstDouble.size = 2;
    ConstDouble.infoByteSize = 8;
    return ConstDouble;
})();
exports.ConstDouble = ConstDouble;
CP_CLASSES[enums.ConstantPoolItemType.DOUBLE] = ConstDouble;
// #endregion
// #region Tier 1
/**
 * Represents a class or interface.
 * ```
 * CONSTANT_Class_info {
 *   u1 tag;
 *   u2 name_index;
 * }
 * ```
 * @todo Have a classloader-local cache of class reference objects.
 */
var ClassReference = (function () {
    function ClassReference(name) {
        /**
         * The resolved class reference.
         */
        this.cls = null;
        /**
         * The JavaScript constructor for the referenced class.
         */
        this.clsConstructor = null;
        /**
         * The array class for the resolved class reference.
         */
        this.arrayClass = null;
        /**
         * The JavaScript constructor for the array class.
         */
        this.arrayClassConstructor = null;
        this.name = name;
    }
    /**
     * Attempt to synchronously resolve.
     */
    ClassReference.prototype.tryResolve = function (loader) {
        if (this.cls === null) {
            this.cls = loader.getResolvedClass(this.name);
        }
        return this.cls !== null;
    };
    /**
     * Resolves the class reference by resolving the class. Does not run
     * class initialization.
     */
    ClassReference.prototype.resolve = function (thread, loader, caller, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        // Because of Java 8 anonymous classes, THIS CHECK IS REQUIRED FOR CORRECTNESS.
        // (ClassLoaders do not know about anonymous classes, hence they are
        //  'anonymous')
        // (Anonymous classes are an 'Unsafe' feature, and are not part of the standard,
        //  but they are employed for lambdas and such.)
        // NOTE: Thread is 'null' during JVM bootstrapping.
        if (thread !== null) {
            var currentMethod = thread.currentMethod();
            // The stack might be empty during resolution, which occurs during JVM bootup.
            if (currentMethod !== null && this.name === currentMethod.cls.getInternalName()) {
                this.setResolved(thread, thread.currentMethod().cls);
                return cb(true);
            }
        }
        loader.resolveClass(thread, this.name, function (cdata) {
            _this.setResolved(thread, cdata);
            cb(cdata !== null);
        }, explicit);
    };
    ClassReference.prototype.setResolved = function (thread, cls) {
        this.cls = cls;
        if (cls !== null) {
            this.clsConstructor = cls.getConstructor(thread);
        }
    };
    ClassReference.prototype.getType = function () {
        return enums.ConstantPoolItemType.CLASS;
    };
    ClassReference.prototype.getConstant = function (thread) { return this.cls.getClassObject(thread); };
    ClassReference.prototype.isResolved = function () { return this.cls !== null; };
    ClassReference.fromBytes = function (byteStream, constantPool) {
        var nameIndex = byteStream.getUint16(), cpItem = constantPool.get(nameIndex);
        assert(cpItem.getType() === enums.ConstantPoolItemType.UTF8, 'ConstantPool ClassReference type != UTF8');
        // The ConstantPool stores class names without the L...; descriptor stuff
        return new this(util.typestr2descriptor(cpItem.value));
    };
    ClassReference.size = 1;
    ClassReference.infoByteSize = 2;
    return ClassReference;
})();
exports.ClassReference = ClassReference;
CP_CLASSES[enums.ConstantPoolItemType.CLASS] = ClassReference;
/**
 * Represents a field or method without indicating which class or interface
 * type it belongs to.
 * ```
 * CONSTANT_NameAndType_info {
 *   u1 tag;
 *   u2 name_index;
 *   u2 descriptor_index;
 * }
 * ```
 */
var NameAndTypeInfo = (function () {
    function NameAndTypeInfo(name, descriptor) {
        this.name = name;
        this.descriptor = descriptor;
    }
    NameAndTypeInfo.prototype.getType = function () {
        return enums.ConstantPoolItemType.NAME_AND_TYPE;
    };
    NameAndTypeInfo.prototype.isResolved = function () { return true; };
    NameAndTypeInfo.fromBytes = function (byteStream, constantPool) {
        var nameIndex = byteStream.getUint16(), descriptorIndex = byteStream.getUint16(), nameConst = constantPool.get(nameIndex), descriptorConst = constantPool.get(descriptorIndex);
        assert(nameConst.getType() === enums.ConstantPoolItemType.UTF8 &&
            descriptorConst.getType() === enums.ConstantPoolItemType.UTF8, 'ConstantPool NameAndTypeInfo types != UTF8');
        return new this(nameConst.value, descriptorConst.value);
    };
    NameAndTypeInfo.size = 1;
    NameAndTypeInfo.infoByteSize = 4;
    return NameAndTypeInfo;
})();
exports.NameAndTypeInfo = NameAndTypeInfo;
CP_CLASSES[enums.ConstantPoolItemType.NAME_AND_TYPE] = NameAndTypeInfo;
/**
 * Represents constant objects of the type java.lang.String.
 * ```
 * CONSTANT_String_info {
 *   u1 tag;
 *   u2 string_index;
 * }
 * ```
 */
var ConstString = (function () {
    function ConstString(stringValue) {
        this.value = null;
        this.stringValue = stringValue;
    }
    ConstString.prototype.getType = function () {
        return enums.ConstantPoolItemType.STRING;
    };
    ConstString.prototype.resolve = function (thread, loader, caller, cb) {
        this.value = thread.getJVM().internString(this.stringValue);
        setImmediate(function () { return cb(true); });
    };
    ConstString.prototype.getConstant = function (thread) { return this.value; };
    ConstString.prototype.isResolved = function () { return this.value !== null; };
    ConstString.fromBytes = function (byteStream, constantPool) {
        var stringIndex = byteStream.getUint16(), utf8Info = constantPool.get(stringIndex);
        assert(utf8Info.getType() === enums.ConstantPoolItemType.UTF8, 'ConstantPool ConstString type != UTF8');
        return new this(utf8Info.value);
    };
    ConstString.size = 1;
    ConstString.infoByteSize = 2;
    return ConstString;
})();
exports.ConstString = ConstString;
CP_CLASSES[enums.ConstantPoolItemType.STRING] = ConstString;
/**
 * Represents a given method type.
 * ```
 * CONSTANT_MethodType_info {
 *   u1 tag;
 *   u2 descriptor_index;
 * }
 * ```
 */
var MethodType = (function () {
    function MethodType(descriptor) {
        this.methodType = null;
        this.descriptor = descriptor;
    }
    MethodType.prototype.resolve = function (thread, cl, caller, cb) {
        var _this = this;
        util.createMethodType(thread, cl, this.descriptor, function (e, type) {
            if (e) {
                thread.throwException(e);
                cb(false);
            }
            else {
                _this.methodType = type;
                cb(true);
            }
        });
    };
    MethodType.prototype.getConstant = function (thread) { return this.methodType; };
    MethodType.prototype.getType = function () {
        return enums.ConstantPoolItemType.METHOD_TYPE;
    };
    MethodType.prototype.isResolved = function () { return this.methodType !== null; };
    MethodType.fromBytes = function (byteStream, constantPool) {
        var descriptorIndex = byteStream.getUint16(), utf8Info = constantPool.get(descriptorIndex);
        assert(utf8Info.getType() === enums.ConstantPoolItemType.UTF8, 'ConstantPool MethodType type != UTF8');
        return new this(utf8Info.value);
    };
    MethodType.size = 1;
    MethodType.infoByteSize = 2;
    return MethodType;
})();
exports.MethodType = MethodType;
CP_CLASSES[enums.ConstantPoolItemType.METHOD_TYPE] = MethodType;
// #endregion
// #region Tier 2
/**
 * Represents a particular method.
 * ```
 * CONSTANT_Methodref_info {
 *   u1 tag;
 *   u2 class_index;
 *   u2 name_and_type_index;
 * }
 * ```
 */
var MethodReference = (function () {
    function MethodReference(classInfo, nameAndTypeInfo) {
        this.method = null;
        /**
         * The signature of the method, including the owning class.
         * e.g. bar/Baz/foo(IJ)V
         */
        this.fullSignature = null;
        this.paramWordSize = -1;
        /**
         * Contains a reference to the MemberName object for the method that invokes
         * the desired function.
         */
        this.memberName = null;
        /**
         * Contains an object that needs to be pushed onto the stack before invoking
         * memberName.
         */
        this.appendix = null;
        /**
         * The JavaScript constructor for the class that the method belongs to.
         */
        this.jsConstructor = null;
        this.classInfo = classInfo;
        this.nameAndTypeInfo = nameAndTypeInfo;
        this.signature = this.nameAndTypeInfo.name + this.nameAndTypeInfo.descriptor;
    }
    MethodReference.prototype.getType = function () {
        return enums.ConstantPoolItemType.METHODREF;
    };
    /**
     * Checks the method referenced by this constant pool item in the specified
     * bytecode context.
     * Returns null if an error occurs.
     * - Throws a NoSuchFieldError if missing.
     * - Throws an IllegalAccessError if field is inaccessible.
     * - Throws an IncompatibleClassChangeError if the field is an incorrect type
     *   for the field access.
     */
    MethodReference.prototype.hasAccess = function (thread, frame, isStatic) {
        var method = this.method, accessingCls = frame.method.cls;
        if (method.accessFlags.isStatic() !== isStatic) {
            thread.throwNewException('Ljava/lang/IncompatibleClassChangeError;', "Method " + method.name + " from class " + method.cls.getExternalName() + " is " + (isStatic ? 'not ' : '') + "static.");
            frame.returnToThreadLoop = true;
            return false;
        }
        else if (!util.checkAccess(accessingCls, method.cls, method.accessFlags)) {
            thread.throwNewException('Ljava/lang/IllegalAccessError;', accessingCls.getExternalName() + " cannot access " + method.cls.getExternalName() + "." + method.name);
            frame.returnToThreadLoop = true;
            return false;
        }
        return true;
    };
    MethodReference.prototype.resolveMemberName = function (method, thread, cl, caller, cb) {
        var _this = this;
        var memberHandleNatives = thread.getBsCl().getInitializedClass(thread, 'Ljava/lang/invoke/MethodHandleNatives;').getConstructor(thread), appendix = new (thread.getBsCl().getInitializedClass(thread, '[Ljava/lang/Object;').getConstructor(thread))(thread, 1);
        util.createMethodType(thread, cl, this.nameAndTypeInfo.descriptor, function (e, type) {
            if (e) {
                thread.throwException(e);
                cb(false);
            }
            else {
                /* MemberName linkMethod( int refKind, Class<?> defc,
                   String name, Object type,
                   Object[] appendixResult) */
                memberHandleNatives['java/lang/invoke/MethodHandleNatives/linkMethod(Ljava/lang/Class;ILjava/lang/Class;Ljava/lang/String;Ljava/lang/Object;[Ljava/lang/Object;)Ljava/lang/invoke/MemberName;'](thread, 
                // Class callerClass
                [caller.getClassObject(thread),
                    // int refKind
                    enums.MethodHandleReferenceKind.INVOKEVIRTUAL,
                    // Class defc
                    _this.classInfo.cls.getClassObject(thread),
                    // String name
                    thread.getJVM().internString(_this.nameAndTypeInfo.name),
                    // Object type, Object[] appendixResult
                    type, appendix], function (e, rv) {
                    if (e !== null) {
                        thread.throwException(e);
                        cb(false);
                    }
                    else {
                        _this.appendix = appendix.array[0];
                        _this.memberName = rv;
                        cb(true);
                    }
                });
            }
        });
    };
    MethodReference.prototype.resolve = function (thread, loader, caller, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        if (!this.classInfo.isResolved()) {
            this.classInfo.resolve(thread, loader, caller, function (status) {
                if (!status) {
                    cb(false);
                }
                else {
                    _this.resolve(thread, loader, caller, cb, explicit);
                }
            }, explicit);
        }
        else {
            var cls = this.classInfo.cls, method = cls.methodLookup(this.signature);
            if (method === null) {
                if (util.is_reference_type(cls.getInternalName())) {
                    // Signature polymorphic lookup.
                    method = cls.signaturePolymorphicAwareMethodLookup(this.signature);
                    if (method !== null && (method.name === 'invoke' || method.name === 'invokeExact')) {
                        // In order to completely resolve the signature polymorphic function,
                        // we need to resolve its MemberName object and Appendix.
                        return this.resolveMemberName(method, thread, loader, caller, function (status) {
                            if (status === true) {
                                _this.setResolved(thread, method);
                            }
                            else {
                                thread.throwNewException('Ljava/lang/NoSuchMethodError;', "Method " + _this.signature + " does not exist in class " + _this.classInfo.cls.getExternalName() + ".");
                            }
                            cb(status);
                        });
                    }
                }
            }
            if (method !== null) {
                this.setResolved(thread, method);
                cb(true);
            }
            else {
                thread.throwNewException('Ljava/lang/NoSuchMethodError;', "Method " + this.signature + " does not exist in class " + this.classInfo.cls.getExternalName() + ".");
                cb(false);
            }
        }
    };
    MethodReference.prototype.setResolved = function (thread, method) {
        this.method = method;
        this.paramWordSize = util.getMethodDescriptorWordSize(this.nameAndTypeInfo.descriptor);
        this.fullSignature = this.method.fullSignature;
        this.jsConstructor = this.method.cls.getConstructor(thread);
    };
    MethodReference.prototype.isResolved = function () { return this.method !== null; };
    MethodReference.prototype.getParamWordSize = function () {
        if (this.paramWordSize === -1) {
            this.paramWordSize = util.getMethodDescriptorWordSize(this.nameAndTypeInfo.descriptor);
        }
        return this.paramWordSize;
    };
    MethodReference.fromBytes = function (byteStream, constantPool) {
        var classIndex = byteStream.getUint16(), nameAndTypeIndex = byteStream.getUint16(), classInfo = constantPool.get(classIndex), nameAndTypeInfo = constantPool.get(nameAndTypeIndex);
        assert(classInfo.getType() === enums.ConstantPoolItemType.CLASS &&
            nameAndTypeInfo.getType() === enums.ConstantPoolItemType.NAME_AND_TYPE, 'ConstantPool MethodReference types mismatch');
        return new this(classInfo, nameAndTypeInfo);
    };
    MethodReference.size = 1;
    MethodReference.infoByteSize = 4;
    return MethodReference;
})();
exports.MethodReference = MethodReference;
CP_CLASSES[enums.ConstantPoolItemType.METHODREF] = MethodReference;
/**
 * Represents a particular interface method.
 * ```
 * CONSTANT_InterfaceMethodref_info {
 *   u1 tag;
 *   u2 class_index;
 *   u2 name_and_type_index;
 * }
 * ```
 */
var InterfaceMethodReference = (function () {
    function InterfaceMethodReference(classInfo, nameAndTypeInfo) {
        /**
         * The signature of the method, including the owning class.
         * e.g. bar/Baz/foo(IJ)V
         */
        this.fullSignature = null;
        this.method = null;
        this.paramWordSize = -1;
        this.jsConstructor = null;
        this.classInfo = classInfo;
        this.nameAndTypeInfo = nameAndTypeInfo;
        this.signature = this.nameAndTypeInfo.name + this.nameAndTypeInfo.descriptor;
    }
    InterfaceMethodReference.prototype.getType = function () {
        return enums.ConstantPoolItemType.INTERFACE_METHODREF;
    };
    /**
     * Checks the method referenced by this constant pool item in the specified
     * bytecode context.
     * Returns null if an error occurs.
     * - Throws a NoSuchFieldError if missing.
     * - Throws an IllegalAccessError if field is inaccessible.
     * - Throws an IncompatibleClassChangeError if the field is an incorrect type
     *   for the field access.
     */
    InterfaceMethodReference.prototype.hasAccess = function (thread, frame, isStatic) {
        var method = this.method, accessingCls = frame.method.cls;
        if (method.accessFlags.isStatic() !== isStatic) {
            thread.throwNewException('Ljava/lang/IncompatibleClassChangeError;', "Method " + method.name + " from class " + method.cls.getExternalName() + " is " + (isStatic ? 'not ' : '') + "static.");
            frame.returnToThreadLoop = true;
            return false;
        }
        else if (!util.checkAccess(accessingCls, method.cls, method.accessFlags)) {
            thread.throwNewException('Ljava/lang/IllegalAccessError;', accessingCls.getExternalName() + " cannot access " + method.cls.getExternalName() + "." + method.name);
            frame.returnToThreadLoop = true;
            return false;
        }
        return true;
    };
    InterfaceMethodReference.prototype.resolve = function (thread, loader, caller, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        if (!this.classInfo.isResolved()) {
            this.classInfo.resolve(thread, loader, caller, function (status) {
                if (!status) {
                    cb(false);
                }
                else {
                    _this.resolve(thread, loader, caller, cb, explicit);
                }
            }, explicit);
        }
        else {
            var cls = this.classInfo.cls, method = cls.methodLookup(this.signature);
            this.paramWordSize = util.getMethodDescriptorWordSize(this.nameAndTypeInfo.descriptor);
            if (method !== null) {
                this.setResolved(thread, method);
                cb(true);
            }
            else {
                thread.throwNewException('Ljava/lang/NoSuchMethodError;', "Method " + this.signature + " does not exist in class " + this.classInfo.cls.getExternalName() + ".");
                cb(false);
            }
        }
    };
    InterfaceMethodReference.prototype.setResolved = function (thread, method) {
        this.method = method;
        this.paramWordSize = util.getMethodDescriptorWordSize(this.nameAndTypeInfo.descriptor);
        this.fullSignature = this.method.fullSignature;
        this.jsConstructor = this.method.cls.getConstructor(thread);
    };
    InterfaceMethodReference.prototype.getParamWordSize = function () {
        if (this.paramWordSize === -1) {
            this.paramWordSize = util.getMethodDescriptorWordSize(this.nameAndTypeInfo.descriptor);
        }
        return this.paramWordSize;
    };
    InterfaceMethodReference.prototype.isResolved = function () { return this.method !== null; };
    InterfaceMethodReference.fromBytes = function (byteStream, constantPool) {
        var classIndex = byteStream.getUint16(), nameAndTypeIndex = byteStream.getUint16(), classInfo = constantPool.get(classIndex), nameAndTypeInfo = constantPool.get(nameAndTypeIndex);
        assert(classInfo.getType() === enums.ConstantPoolItemType.CLASS &&
            nameAndTypeInfo.getType() === enums.ConstantPoolItemType.NAME_AND_TYPE, 'ConstantPool InterfaceMethodReference types mismatch');
        return new this(classInfo, nameAndTypeInfo);
    };
    InterfaceMethodReference.size = 1;
    InterfaceMethodReference.infoByteSize = 4;
    return InterfaceMethodReference;
})();
exports.InterfaceMethodReference = InterfaceMethodReference;
CP_CLASSES[enums.ConstantPoolItemType.INTERFACE_METHODREF] = InterfaceMethodReference;
/**
 * Represents a particular field.
 * ```
 * CONSTANT_Fieldref_info {
 *   u1 tag;
 *   u2 class_index;
 *   u2 name_and_type_index;
 * }
 * ```
 */
var FieldReference = (function () {
    function FieldReference(classInfo, nameAndTypeInfo) {
        this.field = null;
        /**
         * The full name of the field, including the owning class.
         * e.g. java/lang/String/value
         */
        this.fullFieldName = null;
        /**
         * The constructor for the field owner. Used for static fields.
         */
        this.fieldOwnerConstructor = null;
        this.classInfo = classInfo;
        this.nameAndTypeInfo = nameAndTypeInfo;
    }
    FieldReference.prototype.getType = function () {
        return enums.ConstantPoolItemType.FIELDREF;
    };
    /**
     * Checks the field referenced by this constant pool item in the specified
     * bytecode context.
     * Returns null if an error occurs.
     * - Throws a NoSuchFieldError if missing.
     * - Throws an IllegalAccessError if field is inaccessible.
     * - Throws an IncompatibleClassChangeError if the field is an incorrect type
     *   for the field access.
     */
    FieldReference.prototype.hasAccess = function (thread, frame, isStatic) {
        var field = this.field, accessingCls = frame.method.cls;
        if (field.accessFlags.isStatic() !== isStatic) {
            thread.throwNewException('Ljava/lang/IncompatibleClassChangeError;', "Field " + name + " from class " + field.cls.getExternalName() + " is " + (isStatic ? 'not ' : '') + "static.");
            frame.returnToThreadLoop = true;
            return false;
        }
        else if (!util.checkAccess(accessingCls, field.cls, field.accessFlags)) {
            thread.throwNewException('Ljava/lang/IllegalAccessError;', accessingCls.getExternalName() + " cannot access " + field.cls.getExternalName() + "." + name);
            frame.returnToThreadLoop = true;
            return false;
        }
        return true;
    };
    FieldReference.prototype.resolve = function (thread, loader, caller, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        if (!this.classInfo.isResolved()) {
            this.classInfo.resolve(thread, loader, caller, function (status) {
                if (!status) {
                    cb(false);
                }
                else {
                    _this.resolve(thread, loader, caller, cb, explicit);
                }
            }, explicit);
        }
        else {
            var cls = this.classInfo.cls, field = cls.fieldLookup(this.nameAndTypeInfo.name);
            if (field !== null) {
                this.fullFieldName = util.descriptor2typestr(field.cls.getInternalName()) + "/" + field.name;
                this.field = field;
                cb(true);
            }
            else {
                thread.throwNewException('Ljava/lang/NoSuchFieldError;', "Field " + this.nameAndTypeInfo.name + " does not exist in class " + this.classInfo.cls.getExternalName() + ".");
                cb(false);
            }
        }
    };
    FieldReference.prototype.isResolved = function () { return this.field !== null; };
    FieldReference.fromBytes = function (byteStream, constantPool) {
        var classIndex = byteStream.getUint16(), nameAndTypeIndex = byteStream.getUint16(), classInfo = constantPool.get(classIndex), nameAndTypeInfo = constantPool.get(nameAndTypeIndex);
        assert(classInfo.getType() === enums.ConstantPoolItemType.CLASS &&
            nameAndTypeInfo.getType() === enums.ConstantPoolItemType.NAME_AND_TYPE, 'ConstantPool FieldReference types mismatch');
        return new this(classInfo, nameAndTypeInfo);
    };
    FieldReference.size = 1;
    FieldReference.infoByteSize = 4;
    return FieldReference;
})();
exports.FieldReference = FieldReference;
CP_CLASSES[enums.ConstantPoolItemType.FIELDREF] = FieldReference;
/**
 * Used by an invokedynamic instruction to specify a bootstrap method,
 * the dynamic invocation name, the argument and return types of the call,
 * and optionally, a sequence of additional constants called static arguments
 * to the bootstrap method.
 * ```
 * CONSTANT_InvokeDynamic_info {
 *   u1 tag;
 *   u2 bootstrap_method_attr_index;
 *   u2 name_and_type_index;
 * }
 * ```
 */
var InvokeDynamic = (function () {
    function InvokeDynamic(bootstrapMethodAttrIndex, nameAndTypeInfo) {
        /**
         * Once a CallSite is defined for a particular lexical occurrence of
         * InvokeDynamic, the CallSite will be reused for each future execution
         * of that particular occurrence.
         *
         * We store the CallSite objects here for future retrieval, along with an
         * optional 'appendix' argument.
         */
        this.callSiteObjects = {};
        /**
         * A MethodType object corresponding to this InvokeDynamic call's
         * method descriptor.
         */
        this.methodType = null;
        this.bootstrapMethodAttrIndex = bootstrapMethodAttrIndex;
        this.nameAndTypeInfo = nameAndTypeInfo;
        this.paramWordSize = util.getMethodDescriptorWordSize(this.nameAndTypeInfo.descriptor);
    }
    InvokeDynamic.prototype.getType = function () {
        return enums.ConstantPoolItemType.INVOKE_DYNAMIC;
    };
    InvokeDynamic.prototype.isResolved = function () { return this.methodType !== null; };
    InvokeDynamic.prototype.resolve = function (thread, loader, caller, cb) {
        var _this = this;
        util.createMethodType(thread, loader, this.nameAndTypeInfo.descriptor, function (e, rv) {
            if (e) {
                thread.throwException(e);
                cb(false);
            }
            else {
                _this.methodType = rv;
                cb(true);
            }
        });
    };
    InvokeDynamic.prototype.getCallSiteObject = function (pc) {
        var cso = this.callSiteObjects[pc];
        if (cso) {
            return cso;
        }
        else {
            return null;
        }
    };
    InvokeDynamic.prototype.constructCallSiteObject = function (thread, cl, clazz, pc, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        /**
         * A call site specifier gives a symbolic reference to a method handle which
         * is to serve as the bootstrap method for a dynamic call site (§4.7.23).
         * The method handle is resolved to obtain a reference to an instance of
         * java.lang.invoke.MethodHandle (§5.4.3.5).
         */
        var bootstrapMethod = clazz.getBootstrapMethod(this.bootstrapMethodAttrIndex), unresolvedItems = bootstrapMethod[1].concat(bootstrapMethod[0], this).filter(function (item) { return !item.isResolved(); });
        if (unresolvedItems.length > 0) {
            // Resolve all needed constant pool items (including this one).
            return util.asyncForEach(unresolvedItems, function (cpItem, nextItem) {
                cpItem.resolve(thread, cl, clazz, function (status) {
                    if (!status) {
                        nextItem("Failed.");
                    }
                    else {
                        nextItem();
                    }
                }, explicit);
            }, function (err) {
                if (err) {
                    cb(false);
                }
                else {
                    // Rerun. This time, all items are resolved.
                    _this.constructCallSiteObject(thread, cl, clazz, pc, cb, explicit);
                }
            });
        }
        /**
         * A call site specifier gives zero or more static arguments, which
         * communicate application-specific metadata to the bootstrap method. Any
         * static arguments which are symbolic references to classes, method
         * handles, or method types are resolved, as if by invocation of the ldc
         * instruction (§ldc), to obtain references to Class objects,
         * java.lang.invoke.MethodHandle objects, and java.lang.invoke.MethodType
         * objects respectively. Any static arguments that are string literals are
         * used to obtain references to String objects.
         */
        function getArguments() {
            var cpItems = bootstrapMethod[1], i, cpItem, rvObj = new (thread.getBsCl().getInitializedClass(thread, '[Ljava/lang/Object;').getConstructor(thread))(thread, cpItems.length), rv = rvObj.array;
            for (i = 0; i < cpItems.length; i++) {
                cpItem = cpItems[i];
                switch (cpItem.getType()) {
                    case enums.ConstantPoolItemType.CLASS:
                        rv[i] = cpItem.cls.getClassObject(thread);
                        break;
                    case enums.ConstantPoolItemType.METHOD_HANDLE:
                        rv[i] = cpItem.methodHandle;
                        break;
                    case enums.ConstantPoolItemType.METHOD_TYPE:
                        rv[i] = cpItem.methodType;
                        break;
                    case enums.ConstantPoolItemType.STRING:
                        rv[i] = cpItem.value;
                        break;
                    case enums.ConstantPoolItemType.UTF8:
                        rv[i] = thread.getJVM().internString(cpItem.value);
                        break;
                    case enums.ConstantPoolItemType.INTEGER:
                        rv[i] = cl.getInitializedClass(thread, 'I').createWrapperObject(thread, cpItem.value);
                        break;
                    case enums.ConstantPoolItemType.LONG:
                        rv[i] = cl.getInitializedClass(thread, 'J').createWrapperObject(thread, cpItem.value);
                        break;
                    case enums.ConstantPoolItemType.FLOAT:
                        rv[i] = cl.getInitializedClass(thread, 'F').createWrapperObject(thread, cpItem.value);
                        break;
                    case enums.ConstantPoolItemType.DOUBLE:
                        rv[i] = cl.getInitializedClass(thread, 'D').createWrapperObject(thread, cpItem.value);
                        break;
                    default:
                        assert(false, "Invalid CPItem for static args: " + enums.ConstantPoolItemType[cpItem.getType()]);
                        break;
                }
            }
            assert((function () {
                var status = true;
                cpItems.forEach(function (cpItem, i) {
                    if (rv[i] === undefined) {
                        console.log("Undefined item at arg " + i + ": " + enums.ConstantPoolItemType[cpItem.getType()]);
                        status = false;
                    }
                    else if (rv[i] === null) {
                        console.log("Null item at arg " + i + ": " + enums.ConstantPoolItemType[cpItem.getType()]);
                        status = false;
                    }
                });
                return status;
            })(), "Arguments cannot be undefined or null.");
            return rvObj;
        }
        /**
         * A call site specifier gives a method descriptor, TD. A reference to an
         * instance of java.lang.invoke.MethodType is obtained as if by resolution
         * of a symbolic reference to a method type with the same parameter and
         * return types as TD (§5.4.3.5).
         *
         * Do what all OpenJDK-based JVMs do: Call
         * MethodHandleNatives.linkCallSite with:
         * - The class w/ the invokedynamic instruction
         * - The bootstrap method
         * - The name string from the nameAndTypeInfo
         * - The methodType object from the nameAndTypeInfo
         * - The static arguments from the bootstrap method.
         * - A 1-length appendix box.
         */
        var methodName = thread.getJVM().internString(this.nameAndTypeInfo.name), appendixArr = new (cl.getInitializedClass(thread, '[Ljava/lang/Object;').getConstructor(thread))(thread, 1), staticArgs = getArguments(), mhn = cl.getInitializedClass(thread, 'Ljava/lang/invoke/MethodHandleNatives;').getConstructor(thread);
        mhn['java/lang/invoke/MethodHandleNatives/linkCallSite(Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;[Ljava/lang/Object;)Ljava/lang/invoke/MemberName;'](thread, [clazz.getClassObject(thread), bootstrapMethod[0].methodHandle, methodName, this.methodType, staticArgs, appendixArr], function (e, rv) {
            if (e) {
                thread.throwException(e);
                cb(false);
            }
            else {
                _this.setResolved(pc, [rv, appendixArr.array[0]]);
                cb(true);
            }
        });
    };
    InvokeDynamic.prototype.setResolved = function (pc, cso) {
        // Prevent resolution races. It's OK to create multiple CSOs, but only one
        // should ever be used!
        if (this.callSiteObjects[pc] === undefined) {
            this.callSiteObjects[pc] = cso;
        }
    };
    InvokeDynamic.fromBytes = function (byteStream, constantPool) {
        var bootstrapMethodAttrIndex = byteStream.getUint16(), nameAndTypeIndex = byteStream.getUint16(), nameAndTypeInfo = constantPool.get(nameAndTypeIndex);
        assert(nameAndTypeInfo.getType() === enums.ConstantPoolItemType.NAME_AND_TYPE, 'ConstantPool InvokeDynamic types mismatch');
        return new this(bootstrapMethodAttrIndex, nameAndTypeInfo);
    };
    InvokeDynamic.size = 1;
    InvokeDynamic.infoByteSize = 4;
    return InvokeDynamic;
})();
exports.InvokeDynamic = InvokeDynamic;
CP_CLASSES[enums.ConstantPoolItemType.INVOKE_DYNAMIC] = InvokeDynamic;
/**
 * Represents a given method handle.
 * ```
 * CONSTANT_MethodHandle_info {
 *   u1 tag;
 *   u1 reference_kind;
 *   u2 reference_index;
 * }
 * ```
 */
var MethodHandle = (function () {
    function MethodHandle(reference, referenceType) {
        /**
         * The resolved MethodHandle object.
         */
        this.methodHandle = null;
        this.reference = reference;
        this.referenceType = referenceType;
    }
    MethodHandle.prototype.getType = function () {
        return enums.ConstantPoolItemType.METHOD_HANDLE;
    };
    MethodHandle.prototype.isResolved = function () { return this.methodHandle !== null; };
    MethodHandle.prototype.getConstant = function (thread) { return this.methodHandle; };
    /**
     * Asynchronously constructs a JVM-visible MethodHandle object for this
     * MethodHandle.
     *
     * Requires producing the following, and passing it to a MethodHandle
     * constructor:
     * * [java.lang.Class] The defining class.
     * * [java.lang.String] The name of the field/method/etc.
     * * [java.lang.invoke.MethodType | java.lang.Class] The type of the field OR,
     *   if a method, the type of the method descriptor.
     *
     * If needed, this function will resolve needed classes.
     */
    MethodHandle.prototype.resolve = function (thread, cl, caller, cb, explicit) {
        var _this = this;
        if (!this.reference.isResolved()) {
            return this.reference.resolve(thread, cl, caller, function (status) {
                if (!status) {
                    cb(false);
                }
                else {
                    _this.resolve(thread, cl, caller, cb, explicit);
                }
            }, explicit);
        }
        this.constructMethodHandleType(thread, cl, function (type) {
            if (type === null) {
                cb(false);
            }
            else {
                var methodHandleNatives = cl.getInitializedClass(thread, 'Ljava/lang/invoke/MethodHandleNatives;').getConstructor(thread);
                methodHandleNatives['linkMethodHandleConstant(Ljava/lang/Class;ILjava/lang/Class;Ljava/lang/String;Ljava/lang/Object;)Ljava/lang/invoke/MethodHandle;'](thread, [caller.getClassObject(thread), _this.referenceType, _this.getDefiningClassObj(thread), thread.getJVM().internString(_this.reference.nameAndTypeInfo.name), type], function (e, methodHandle) {
                    if (e) {
                        thread.throwException(e);
                        cb(false);
                    }
                    else {
                        _this.methodHandle = methodHandle;
                        cb(true);
                    }
                });
            }
        });
    };
    MethodHandle.prototype.getDefiningClassObj = function (thread) {
        if (this.reference.getType() === enums.ConstantPoolItemType.FIELDREF) {
            return this.reference.field.cls.getClassObject(thread);
        }
        else {
            return this.reference.method.cls.getClassObject(thread);
        }
    };
    MethodHandle.prototype.constructMethodHandleType = function (thread, cl, cb) {
        if (this.reference.getType() === enums.ConstantPoolItemType.FIELDREF) {
            var resolveObj = this.reference.nameAndTypeInfo.descriptor;
            cl.resolveClass(thread, resolveObj, function (cdata) {
                if (cdata !== null) {
                    cb(cdata.getClassObject(thread));
                }
                else {
                    cb(null);
                }
            });
        }
        else {
            util.createMethodType(thread, cl, this.reference.nameAndTypeInfo.descriptor, function (e, rv) {
                if (e) {
                    thread.throwException(e);
                    cb(null);
                }
                else {
                    cb(rv);
                }
            });
        }
    };
    MethodHandle.fromBytes = function (byteStream, constantPool) {
        var referenceKind = byteStream.getUint8(), referenceIndex = byteStream.getUint16(), reference = constantPool.get(referenceIndex);
        assert(0 < referenceKind && referenceKind < 10, 'ConstantPool MethodHandle invalid referenceKind: ' + referenceKind);
        // Sanity check.
        assert((function () {
            switch (referenceKind) {
                case enums.MethodHandleReferenceKind.GETFIELD:
                case enums.MethodHandleReferenceKind.GETSTATIC:
                case enums.MethodHandleReferenceKind.PUTFIELD:
                case enums.MethodHandleReferenceKind.PUTSTATIC:
                    return reference.getType() === enums.ConstantPoolItemType.FIELDREF;
                case enums.MethodHandleReferenceKind.INVOKEINTERFACE:
                    return reference.getType() === enums.ConstantPoolItemType.INTERFACE_METHODREF
                        && reference.nameAndTypeInfo.name[0] !== '<';
                case enums.MethodHandleReferenceKind.INVOKEVIRTUAL:
                case enums.MethodHandleReferenceKind.INVOKESTATIC:
                case enums.MethodHandleReferenceKind.INVOKESPECIAL:
                    // NOTE: Spec says METHODREF, but I've found instances where
                    // INVOKESPECIAL is used on an INTERFACE_METHODREF.
                    return (reference.getType() === enums.ConstantPoolItemType.METHODREF
                        || reference.getType() === enums.ConstantPoolItemType.INTERFACE_METHODREF)
                        && reference.nameAndTypeInfo.name[0] !== '<';
                case enums.MethodHandleReferenceKind.NEWINVOKESPECIAL:
                    return reference.getType() === enums.ConstantPoolItemType.METHODREF
                        && reference.nameAndTypeInfo.name === '<init>';
            }
            return true;
        })(), "Invalid constant pool reference for method handle reference type: " + enums.MethodHandleReferenceKind[referenceKind]);
        return new this(reference, referenceKind);
    };
    MethodHandle.size = 1;
    MethodHandle.infoByteSize = 3;
    return MethodHandle;
})();
exports.MethodHandle = MethodHandle;
CP_CLASSES[enums.ConstantPoolItemType.METHOD_HANDLE] = MethodHandle;
// #endregion
/**
 * Constant pool type *resolution tiers*. Value is the tier, key is the
 * constant pool type.
 * Tier 0 has no references to other constant pool items, and can be resolved
 * first.
 * Tier 1 refers to tier 0 items.
 * Tier n refers to tier n-1 items and below.
 * Initialized in the given fashion to give the JS engine a tasty type hint.
 */
var CONSTANT_POOL_TIER = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
// Populate CONSTANT_POOL_TIER. Put into a closure to avoid scope pollution.
(function (tierInfos) {
    tierInfos.forEach(function (tierInfo, index) {
        tierInfo.forEach(function (type) {
            CONSTANT_POOL_TIER[type] = index;
        });
    });
})([
    // Tier 0
    [
        enums.ConstantPoolItemType.UTF8,
        enums.ConstantPoolItemType.INTEGER,
        enums.ConstantPoolItemType.FLOAT,
        enums.ConstantPoolItemType.LONG,
        enums.ConstantPoolItemType.DOUBLE
    ],
    // Tier 1
    [
        enums.ConstantPoolItemType.CLASS,
        enums.ConstantPoolItemType.STRING,
        enums.ConstantPoolItemType.NAME_AND_TYPE,
        enums.ConstantPoolItemType.METHOD_TYPE
    ],
    // Tier 2
    [
        enums.ConstantPoolItemType.FIELDREF,
        enums.ConstantPoolItemType.METHODREF,
        enums.ConstantPoolItemType.INTERFACE_METHODREF,
        enums.ConstantPoolItemType.INVOKE_DYNAMIC
    ],
    // Tier 3
    [
        enums.ConstantPoolItemType.METHOD_HANDLE
    ]
]);
/**
 * Represents a constant pool for a particular class.
 */
var ConstantPool = (function () {
    function ConstantPool() {
    }
    ConstantPool.prototype.parse = function (byteStream, cpPatches) {
        var _this = this;
        if (cpPatches === void 0) { cpPatches = null; }
        var cpCount = byteStream.getUint16(), 
        // First key is the tier.
        deferredQueue = [[], [], []], 
        // The ending offset of the constant pool items.
        endIdx = 0, idx = 1, 
        // Tag of the currently-being-processed item.
        tag = 0, 
        // Offset of the currently-being-processed item.
        itemOffset = 0, 
        // Tier of the currently-being-processed item.
        itemTier = 0;
        this.constantPool = new Array(cpCount);
        // Scan for tier info.
        while (idx < cpCount) {
            itemOffset = byteStream.pos();
            tag = byteStream.getUint8();
            assert(CP_CLASSES[tag] !== null && CP_CLASSES[tag] !== undefined, 'Unknown ConstantPool tag: ' + tag);
            itemTier = CONSTANT_POOL_TIER[tag];
            if (itemTier > 0) {
                deferredQueue[itemTier - 1].push({ offset: itemOffset, index: idx });
                byteStream.skip(CP_CLASSES[tag].infoByteSize);
            }
            else {
                this.constantPool[idx] = CP_CLASSES[tag].fromBytes(byteStream, this);
            }
            idx += CP_CLASSES[tag].size;
        }
        endIdx = byteStream.pos();
        // Process tiers.
        deferredQueue.forEach(function (deferredItems) {
            deferredItems.forEach(function (item) {
                byteStream.seek(item.offset);
                tag = byteStream.getUint8();
                _this.constantPool[item.index] = CP_CLASSES[tag].fromBytes(byteStream, _this);
                if (cpPatches !== null && cpPatches.array[item.index] !== null && cpPatches.array[item.index] !== undefined) {
                    /*
                     * For each CP entry, the corresponding CP patch must either be null or have
                     * the format that matches its tag:
                     *
                     * * Integer, Long, Float, Double: the corresponding wrapper object type from java.lang
                     * * Utf8: a string (must have suitable syntax if used as signature or name)
                     * * Class: any java.lang.Class object
                     * * String: any object (not just a java.lang.String)
                     * * InterfaceMethodRef: (NYI) a method handle to invoke on that call site's arguments
                     */
                    var patchObj = cpPatches.array[item.index];
                    switch (patchObj.getClass().getInternalName()) {
                        case 'Ljava/lang/Integer;':
                            assert(tag === enums.ConstantPoolItemType.INTEGER);
                            _this.constantPool[item.index].value = patchObj['java/lang/Integer/value'];
                            break;
                        case 'Ljava/lang/Long;':
                            assert(tag === enums.ConstantPoolItemType.LONG);
                            _this.constantPool[item.index].value = patchObj['java/lang/Long/value'];
                            break;
                        case 'Ljava/lang/Float;':
                            assert(tag === enums.ConstantPoolItemType.FLOAT);
                            _this.constantPool[item.index].value = patchObj['java/lang/Float/value'];
                            break;
                        case 'Ljava/lang/Double;':
                            assert(tag === enums.ConstantPoolItemType.DOUBLE);
                            _this.constantPool[item.index].value = patchObj['java/lang/Double/value'];
                            break;
                        case 'Ljava/lang/String;':
                            assert(tag === enums.ConstantPoolItemType.UTF8);
                            _this.constantPool[item.index].value = patchObj.toString();
                            break;
                        case 'Ljava/lang/Class;':
                            assert(tag === enums.ConstantPoolItemType.CLASS);
                            _this.constantPool[item.index].name = patchObj.$cls.getInternalName();
                            _this.constantPool[item.index].cls = patchObj.$cls;
                            break;
                        default:
                            assert(tag === enums.ConstantPoolItemType.STRING);
                            _this.constantPool[item.index].stringValue = "";
                            // XXX: Not actually a string, but the JVM does this.
                            _this.constantPool[item.index].value = patchObj;
                            break;
                    }
                }
            });
        });
        // Return to the correct offset, at the end of the CP data.
        byteStream.seek(endIdx);
        return byteStream;
    };
    ConstantPool.prototype.get = function (idx) {
        assert(this.constantPool[idx] !== undefined, "Invalid ConstantPool reference.");
        return this.constantPool[idx];
    };
    ConstantPool.prototype.each = function (fn) {
        this.constantPool.forEach(function (item, idx) {
            if (item !== undefined) {
                fn(idx, item);
            }
        });
    };
    return ConstantPool;
})();
exports.ConstantPool = ConstantPool;
/// Resolved forms of constant pool items.
