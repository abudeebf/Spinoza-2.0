"use strict";
var gLong = require('./gLong');
var enums = require('./enums');
/**
 * util contains stateless utility functions that are used around Doppio's
 * codebase.
 * TODO: Separate general JS utility methods from JVM utility methods.
 */
/**
 * Merges object literals together into a new object. Emulates underscore's merge function.
 */
function merge() {
    var literals = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        literals[_i - 0] = arguments[_i];
    }
    var newObject = {};
    literals.forEach(function (literal) {
        Object.keys(literal).forEach(function (key) {
            newObject[key] = literal[key];
        });
    });
    return newObject;
}
exports.merge = merge;
function are_in_browser() {
    return process.platform === 'browser';
}
exports.are_in_browser = are_in_browser;
exports.typedArraysSupported = typeof ArrayBuffer !== "undefined";
/**
 * Converts JVM internal names into JS-safe names. Only for use with reference
 * types.
 * Ljava/lang/Object; => java_lang_Object
 * Lfoo/Bar_baz; => foo_Bar__baz
 *
 * Is NOT meant to be unambiguous!
 *
 * Also handles the special characters described here:
 * https://blogs.oracle.com/jrose/entry/symbolic_freedom_in_the_vm
 */
function jvmName2JSName(jvmName) {
    switch (jvmName[0]) {
        case 'L':
            return jvmName.slice(1, jvmName.length - 1).replace(/_/g, '__')
                .replace(/[\/.;$<>\[\]:\\=^-]/g, '_');
        case '[':
            return "ARR_" + jvmName2JSName(jvmName.slice(1));
        default:
            return jvmName;
    }
}
exports.jvmName2JSName = jvmName2JSName;
/**
 * Re-escapes JVM names for eval'd code. Otherwise, JavaScript removes the escapes.
 */
function reescapeJVMName(jvmName) {
    return jvmName.replace(/\\/g, '\\\\');
}
exports.reescapeJVMName = reescapeJVMName;
/**
 * Applies an async function to each element of a list, in order.
 */
function asyncForEach(lst, fn, done_cb) {
    var i = -1;
    function process(err) {
        if (err) {
            done_cb(err);
        }
        else {
            i++;
            if (i < lst.length) {
                fn(lst[i], process);
            }
            else {
                done_cb();
            }
        }
    }
    process();
}
exports.asyncForEach = asyncForEach;
/**
 * Runs the specified tasks in series.
 */
function asyncSeries(tasks, doneCb) {
    var i = -1;
    function process(err) {
        if (err) {
            doneCb(err);
        }
        else {
            i++;
            if (i < tasks.length) {
                tasks[i](process);
            }
            else {
                doneCb();
            }
        }
    }
    process();
}
exports.asyncSeries = asyncSeries;
/**
 * Applies the function to each element of the list in order in series.
 * The first element that returns success halts the process, and triggers
 * done_cb. If no elements return success, done_cb is triggered with no
 * arguments.
 *
 * I wrote this specifically for classloading, but it may have uses elsewhere.
 */
function asyncFind(lst, fn, done_cb) {
    var i = -1;
    function process(success) {
        if (success) {
            done_cb(lst[i]);
        }
        else {
            i++;
            if (i < lst.length) {
                fn(lst[i], process);
            }
            else {
                done_cb();
            }
        }
    }
    process(false);
}
exports.asyncFind = asyncFind;
if (!Math['imul']) {
    Math['imul'] = function (a, b) {
        // polyfill from https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/imul
        var ah = (a >>> 16) & 0xffff;
        var al = a & 0xffff;
        var bh = (b >>> 16) & 0xffff;
        var bl = b & 0xffff;
        // the shift by 0 fixes the sign on the high part
        // the final |0 converts the unsigned value into a signed value
        return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
    };
}
if (!Math['expm1']) {
    Math['expm1'] = function (x) {
        if (Math.abs(x) < 1e-5) {
            return x + 0.5 * x * x;
        }
        else {
            return Math.exp(x) - 1.0;
        }
    };
}
if (!Math['sinh']) {
    Math['sinh'] = function (a) {
        var exp = Math.exp(a);
        return (exp - 1 / exp) / 2;
    };
}
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
        if (this == null) {
            throw new TypeError();
        }
        var t = Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (fromIndex !== undefined) {
            n = Number(fromIndex);
            if (n != n) {
                n = 0;
            }
            else if (n != 0 && n != Infinity && n != -Infinity) {
                n = ((n > 0 ? 1 : 0) || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    };
}
/**
 * Checks if accessingCls has permission to a field or method with the given
 * flags on owningCls.
 *
 * Modifier    | Class | Package | Subclass | World
 * ————————————+———————+—————————+——————————+———————
 * public      |  y    |    y    |    y     |   y
 * ————————————+———————+—————————+——————————+———————
 * protected   |  y    |    y    |    y     |   n
 * ————————————+———————+—————————+——————————+———————
 * no modifier |  y    |    y    |    n     |   n
 * ————————————+———————+—————————+——————————+———————
 * private     |  y    |    n    |    n     |   n
 *
 * y: accessible
 * n: not accessible
 */
function checkAccess(accessingCls, owningCls, accessFlags) {
    if (accessFlags.isPublic()) {
        return true;
    }
    else if (accessFlags.isProtected()) {
        return accessingCls.getPackageName() === owningCls.getPackageName() || accessingCls.isSubclass(owningCls);
    }
    else if (accessFlags.isPrivate()) {
        return accessingCls === owningCls;
    }
    else {
        return accessingCls.getPackageName() === owningCls.getPackageName();
    }
}
exports.checkAccess = checkAccess;
/**
 * Truncates a floating point into an integer.
 */
function float2int(a) {
    if (a > enums.Constants.INT_MAX) {
        return enums.Constants.INT_MAX;
    }
    else if (a < enums.Constants.INT_MIN) {
        return enums.Constants.INT_MIN;
    }
    else {
        return a | 0;
    }
}
exports.float2int = float2int;
var supportsArrayBuffers = typeof (ArrayBuffer) !== 'undefined';
/**
 * Converts a byte array to a buffer. **Copies.**
 */
function byteArray2Buffer(bytes, offset, len) {
    if (offset === void 0) { offset = 0; }
    if (len === void 0) { len = bytes.length; }
    if (supportsArrayBuffers && ArrayBuffer.isView(bytes)) {
        var offset_1 = bytes.byteOffset;
        return new Buffer(bytes.buffer.slice(offset_1, offset_1 + bytes.length));
    }
    else {
        var buff = new Buffer(len), i;
        for (i = 0; i < len; i++) {
            buff.writeInt8(bytes[offset + i], i);
        }
        return buff;
    }
}
exports.byteArray2Buffer = byteArray2Buffer;
// Call this ONLY on the result of two non-NaN numbers.
function wrapFloat(a) {
    if (a > 3.40282346638528860e+38) {
        return Number.POSITIVE_INFINITY;
    }
    if (0 < a && a < 1.40129846432481707e-45) {
        return 0;
    }
    if (a < -3.40282346638528860e+38) {
        return Number.NEGATIVE_INFINITY;
    }
    if (0 > a && a > -1.40129846432481707e-45) {
        return 0;
    }
    return a;
}
exports.wrapFloat = wrapFloat;
// Convert :count chars starting from :offset in a Java character array into a JS string
function chars2jsStr(jvmCarr, offset, count) {
    if (offset === void 0) { offset = 0; }
    if (count === void 0) { count = jvmCarr.array.length; }
    var i, carrArray = jvmCarr.array, rv = "", endOffset = offset + count;
    for (i = offset; i < endOffset; i++) {
        rv += String.fromCharCode(carrArray[i]);
    }
    return rv;
}
exports.chars2jsStr = chars2jsStr;
// TODO: Is this used anywhere where we are *not* inserting the bytestr into
// a JVMArray object?
// TODO: Could inject this as a static String method...
function bytestr2Array(byteStr) {
    var rv = [];
    for (var i = 0; i < byteStr.length; i++) {
        rv.push(byteStr.charCodeAt(i));
    }
    return rv;
}
exports.bytestr2Array = bytestr2Array;
function array2bytestr(byteArray) {
    // XXX: We'd like to use String.fromCharCode(bytecode_array...)
    //  but that fails on Webkit with arrays longer than 2^31. See issue #129 for details.
    var rv = '';
    for (var i = 0; i < byteArray.length; i++) {
        rv += String.fromCharCode(byteArray[i]);
    }
    return rv;
}
exports.array2bytestr = array2bytestr;
/**
 * Bit masks for the flag byte.
 */
(function (FlagMasks) {
    FlagMasks[FlagMasks["PUBLIC"] = 1] = "PUBLIC";
    FlagMasks[FlagMasks["PRIVATE"] = 2] = "PRIVATE";
    FlagMasks[FlagMasks["PROTECTED"] = 4] = "PROTECTED";
    FlagMasks[FlagMasks["STATIC"] = 8] = "STATIC";
    FlagMasks[FlagMasks["FINAL"] = 16] = "FINAL";
    FlagMasks[FlagMasks["SYNCHRONIZED"] = 32] = "SYNCHRONIZED";
    FlagMasks[FlagMasks["SUPER"] = 32] = "SUPER";
    FlagMasks[FlagMasks["VOLATILE"] = 64] = "VOLATILE";
    FlagMasks[FlagMasks["TRANSIENT"] = 128] = "TRANSIENT";
    FlagMasks[FlagMasks["VARARGS"] = 128] = "VARARGS";
    FlagMasks[FlagMasks["NATIVE"] = 256] = "NATIVE";
    FlagMasks[FlagMasks["INTERFACE"] = 512] = "INTERFACE";
    FlagMasks[FlagMasks["ABSTRACT"] = 1024] = "ABSTRACT";
    FlagMasks[FlagMasks["STRICT"] = 2048] = "STRICT";
})(exports.FlagMasks || (exports.FlagMasks = {}));
var FlagMasks = exports.FlagMasks;
/**
 * Represents a 'flag byte'. See �4 of the JVM spec.
 * @todo Separate METHOD flags and CLASS flags.
 */
var Flags = (function () {
    function Flags(byte) {
        this.byte = byte;
    }
    Flags.prototype.isPublic = function () {
        return (this.byte & FlagMasks.PUBLIC) > 0;
    };
    Flags.prototype.isPrivate = function () {
        return (this.byte & FlagMasks.PRIVATE) > 0;
    };
    Flags.prototype.isProtected = function () {
        return (this.byte & FlagMasks.PROTECTED) > 0;
    };
    Flags.prototype.isStatic = function () {
        return (this.byte & FlagMasks.STATIC) > 0;
    };
    Flags.prototype.isFinal = function () {
        return (this.byte & FlagMasks.FINAL) > 0;
    };
    Flags.prototype.isSynchronized = function () {
        return (this.byte & FlagMasks.SYNCHRONIZED) > 0;
    };
    Flags.prototype.isSuper = function () {
        return (this.byte & FlagMasks.SUPER) > 0;
    };
    Flags.prototype.isVolatile = function () {
        return (this.byte & FlagMasks.VOLATILE) > 0;
    };
    Flags.prototype.isTransient = function () {
        return (this.byte & FlagMasks.TRANSIENT) > 0;
    };
    Flags.prototype.isNative = function () {
        return (this.byte & FlagMasks.NATIVE) > 0;
    };
    Flags.prototype.isInterface = function () {
        return (this.byte & FlagMasks.INTERFACE) > 0;
    };
    Flags.prototype.isAbstract = function () {
        return (this.byte & FlagMasks.ABSTRACT) > 0;
    };
    Flags.prototype.isStrict = function () {
        return (this.byte & FlagMasks.STRICT) > 0;
    };
    /**
     * Changes a function to native. Used for trapped methods.
     */
    Flags.prototype.setNative = function (n) {
        if (n) {
            this.byte = this.byte | FlagMasks.NATIVE;
        }
        else {
            this.byte = this.byte & (~FlagMasks.NATIVE);
        }
    };
    Flags.prototype.isVarArgs = function () {
        return (this.byte & FlagMasks.VARARGS) > 0;
    };
    Flags.prototype.getRawByte = function () {
        return this.byte;
    };
    return Flags;
})();
exports.Flags = Flags;
function initialValue(type_str) {
    if (type_str === 'J')
        return gLong.ZERO;
    var c = type_str[0];
    if (c === '[' || c === 'L')
        return null;
    return 0;
}
exports.initialValue = initialValue;
/**
 * Java classes are represented internally using slashes as delimiters.
 * These helper functions convert between the two representations.
 * Ljava/lang/Class; => java.lang.Class
 */
function ext_classname(str) {
    return descriptor2typestr(str).replace(/\//g, '.');
}
exports.ext_classname = ext_classname;
/**
 * java.lang.Class => Ljava/lang/Class;
 */
function int_classname(str) {
    return typestr2descriptor(str.replace(/\./g, '/'));
}
exports.int_classname = int_classname;
function verify_int_classname(str) {
    var array_nesting = str.match(/^\[*/)[0].length;
    if (array_nesting > 255) {
        return false;
    }
    if (array_nesting > 0) {
        str = str.slice(array_nesting);
    }
    if (str[0] === 'L') {
        if (str[str.length - 1] !== ';') {
            return false;
        }
        str = str.slice(1, -1);
    }
    if (str in exports.internal2external) {
        return true;
    }
    if (str.match(/\/{2,}/)) {
        return false;
    }
    var parts = str.split('/');
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].match(/[^$_a-z0-9]/i)) {
            return false;
        }
    }
    return true;
}
exports.verify_int_classname = verify_int_classname;
exports.internal2external = {
    B: 'byte',
    C: 'char',
    D: 'double',
    F: 'float',
    I: 'int',
    J: 'long',
    S: 'short',
    V: 'void',
    Z: 'boolean'
};
exports.external2internal = {};
for (var k in exports.internal2external) {
    exports.external2internal[exports.internal2external[k]] = k;
}
/**
 * Given a method descriptor, returns the typestrings for the return type
 * and the parameters.
 *
 * e.g. (Ljava/lang/Class;Z)Ljava/lang/String; =>
 *        ["Ljava/lang/Class;", "Z", "Ljava/lang/String;"]
 */
function getTypes(methodDescriptor) {
    var i = 0, types = [], endIdx;
    for (i = 0; i < methodDescriptor.length; i++) {
        switch (methodDescriptor.charAt(i)) {
            case '(':
            case ')':
                //Skip.
                break;
            case 'L':
                // Reference type.
                endIdx = methodDescriptor.indexOf(';', i);
                types.push(methodDescriptor.slice(i, endIdx + 1));
                i = endIdx;
                break;
            case '[':
                endIdx = i + 1;
                // Find the start of the component.
                while (methodDescriptor.charAt(endIdx) === '[') {
                    endIdx++;
                }
                if (methodDescriptor.charAt(endIdx) === 'L') {
                    // Reference component. Read ahead to end.
                    endIdx = methodDescriptor.indexOf(';', endIdx);
                    types.push(methodDescriptor.slice(i, endIdx + 1));
                }
                else {
                    // Primitive component.
                    types.push(methodDescriptor.slice(i, endIdx + 1));
                }
                i = endIdx;
                break;
            default:
                // Primitive type.
                types.push(methodDescriptor.charAt(i));
                break;
        }
    }
    return types;
}
exports.getTypes = getTypes;
// Get the component type of an array type string.
// Cut off the [L and ; for arrays of classes.
function get_component_type(type_str) {
    return type_str.slice(1);
}
exports.get_component_type = get_component_type;
function is_array_type(type_str) {
    return type_str[0] === '[';
}
exports.is_array_type = is_array_type;
function is_primitive_type(type_str) {
    return type_str in exports.internal2external;
}
exports.is_primitive_type = is_primitive_type;
function is_reference_type(type_str) {
    return type_str[0] === 'L';
}
exports.is_reference_type = is_reference_type;
/**
 * Converts type descriptors into standardized internal type strings.
 * Ljava/lang/Class; => java/lang/Class   Reference types
 * [Ljava/lang/Class; is unchanged        Array types
 * C => char                              Primitive types
 */
function descriptor2typestr(type_str) {
    var c = type_str[0];
    if (c in exports.internal2external)
        return exports.internal2external[c];
    if (c === 'L')
        return type_str.slice(1, -1);
    if (c === '[')
        return type_str;
    // no match
    throw new Error("Unrecognized type string: " + type_str);
}
exports.descriptor2typestr = descriptor2typestr;
// Takes a character array of concatenated type descriptors and returns/removes the first one.
function carr2descriptor(carr) {
    var c = carr.shift();
    if (c == null)
        return null;
    if (exports.internal2external[c] !== void 0)
        return c;
    if (c === 'L') {
        var rv = 'L';
        while ((c = carr.shift()) !== ';') {
            rv += c;
        }
        return rv + ';';
    }
    if (c === '[')
        return "[" + carr2descriptor(carr);
    // no match
    carr.unshift(c);
    throw new Error("Unrecognized descriptor: " + carr.join(''));
}
exports.carr2descriptor = carr2descriptor;
// Converts internal type strings into type descriptors. Reverse of descriptor2typestr.
function typestr2descriptor(type_str) {
    if (exports.external2internal[type_str] !== void 0) {
        return exports.external2internal[type_str];
    }
    else if (type_str[0] === '[') {
        return type_str;
    }
    else {
        return "L" + type_str + ";";
    }
}
exports.typestr2descriptor = typestr2descriptor;
/**
 * Java's reflection APIs need to unbox primitive arguments to function calls,
 * as they are boxed in an Object array. This utility function converts
 * an array of arguments into the appropriate form prior to function invocation.
 * Note that this includes padding category 2 primitives, which consume two
 * slots in the array (doubles/longs).
 */
function unboxArguments(thread, paramTypes, args) {
    var rv = [], i, type, arg;
    for (i = 0; i < paramTypes.length; i++) {
        type = paramTypes[i];
        arg = args[i];
        if (is_primitive_type(type)) {
            // Unbox the primitive type.
            // TODO: Precisely type this better. Once TypeScript lets you import
            // union types, we can define a "JVMPrimitive" type...
            rv.push(arg.unbox());
            if (type === 'J' || type === 'D') {
                // 64-bit primitives take up two argument slots. Doppio uses a NULL for the second slot.
                rv.push(null);
            }
        }
        else {
            // Reference type; do not change.
            rv.push(arg);
        }
    }
    return rv;
}
exports.unboxArguments = unboxArguments;
/**
 * Given a method descriptor as a JS string, returns a corresponding MethodType
 * object.
 */
function createMethodType(thread, cl, descriptor, cb) {
    cl.initializeClass(thread, 'Ljava/lang/invoke/MethodHandleNatives;', function (cdata) {
        if (cdata !== null) {
            var jsCons = cdata.getConstructor(thread), classes = getTypes(descriptor);
            classes.push('[Ljava/lang/Class;');
            // Need the return type and parameter types.
            cl.resolveClasses(thread, classes, function (classMap) {
                var types = classes.map(function (cls) { return classMap[cls].getClassObject(thread); });
                types.pop(); // Discard '[Ljava/lang/Class;'
                var rtype = types.pop(), // Return type.
                clsArrCons = classMap['[Ljava/lang/Class;'].getConstructor(thread), ptypes = new clsArrCons(thread, types.length);
                ptypes.array = types;
                jsCons['java/lang/invoke/MethodHandleNatives/findMethodHandleType(Ljava/lang/Class;[Ljava/lang/Class;)Ljava/lang/invoke/MethodType;'](thread, [rtype, ptypes], cb);
            });
        }
    });
}
exports.createMethodType = createMethodType;
/**
 * Given a method descriptor, returns the number of words required to store
 * its arguments.
 * Does not include considerations for e.g. the 'this' argument, since the
 * descriptor does not specify if the method is static or not.
 */
function getMethodDescriptorWordSize(descriptor) {
    var parsedDescriptor = getTypes(descriptor), words = parsedDescriptor.length - 1, i, p;
    // Remove return type.
    parsedDescriptor.pop();
    // Double count doubles / longs.
    for (i = 0; i < parsedDescriptor.length; i++) {
        p = parsedDescriptor[i];
        if (p === 'D' || p === 'J') {
            words++;
        }
    }
    return words;
}
exports.getMethodDescriptorWordSize = getMethodDescriptorWordSize;
/**
 * Given a return type as a Class object, and an array of class objects for
 * parameter types, returns the descriptor string for the method type.
 */
function getDescriptorString(rtype, ptypes) {
    var rv = "(";
    if (ptypes !== undefined && ptypes !== null) {
        ptypes.array.forEach(function (ptype) {
            rv += ptype.$cls.getInternalName();
        });
    }
    rv += ")" + rtype.$cls.getInternalName();
    return rv;
}
exports.getDescriptorString = getDescriptorString;
/**
 * Have a JavaClassLoaderObject and need its ClassLoader object? Use this method!
 * @todo Install on Java ClassLoader objects.
 */
function getLoader(thread, jclo) {
    if ((jclo != null) && (jclo.$loader != null)) {
        return jclo.$loader;
    }
    return thread.getBsCl();
}
exports.getLoader = getLoader;
/**
 * "Fast" array copy; does not have to check every element for illegal
 * assignments. You can do tricks here (if possible) to copy chunks of the array
 * at a time rather than element-by-element.
 * This function *cannot* access any attribute other than 'array' on src due to
 * the special case when src == dest (see code for System.arraycopy below).
 */
function arraycopyNoCheck(src, srcPos, dest, destPos, length) {
    var j = destPos;
    var end = srcPos + length;
    for (var i = srcPos; i < end; i++) {
        dest.array[j++] = src.array[i];
    }
}
exports.arraycopyNoCheck = arraycopyNoCheck;
/**
 * "Slow" array copy; has to check every element for illegal assignments.
 * You cannot do any tricks here; you must copy element by element until you
 * have either copied everything, or encountered an element that cannot be
 * assigned (which causes an exception).
 * Guarantees: src and dest are two different reference types. They cannot be
 *             primitive arrays.
 */
function arraycopyCheck(thread, src, srcPos, dest, destPos, length) {
    var j = destPos;
    var end = srcPos + length;
    var destCompCls = dest.getClass().getComponentClass();
    for (var i = srcPos; i < end; i++) {
        // Check if null or castable.
        if (src.array[i] === null || src.array[i].getClass().isCastable(destCompCls)) {
            dest.array[j] = src.array[i];
        }
        else {
            thread.throwNewException('Ljava/lang/ArrayStoreException;', 'Array element in src cannot be cast to dest array type.');
            return;
        }
        j++;
    }
}
exports.arraycopyCheck = arraycopyCheck;
function initString(cl, str) {
    var carr = initCarr(cl, str);
    var strCons = cl.getResolvedClass('Ljava/lang/String;').getConstructor(null);
    var strObj = new strCons(null);
    strObj['java/lang/String/value'] = carr;
    return strObj;
}
exports.initString = initString;
function initCarr(cl, str) {
    var arrClsCons = cl.getInitializedClass(null, '[C').getConstructor(null), carr = new arrClsCons(null, str.length), carrArray = carr.array;
    for (var i = 0; i < str.length; i++) {
        carrArray[i] = str.charCodeAt(i);
    }
    return carr;
}
exports.initCarr = initCarr;
function newArrayFromClass(thread, clazz, length) {
    return new (clazz.getConstructor(thread))(thread, length);
}
exports.newArrayFromClass = newArrayFromClass;
function newArray(thread, cl, desc, length) {
    var cls = cl.getInitializedClass(thread, desc);
    return newArrayFromClass(thread, cls, length);
}
exports.newArray = newArray;
/**
 * Separate from newArray to avoid programming mistakes where newArray and newArrayFromData are conflated.
 */
function multiNewArray(thread, cl, desc, lengths) {
    var cls = cl.getInitializedClass(thread, desc);
    return new (cls.getConstructor(thread))(thread, lengths);
}
exports.multiNewArray = multiNewArray;
function newObjectFromClass(thread, clazz) {
    return new (clazz.getConstructor(thread))(thread);
}
exports.newObjectFromClass = newObjectFromClass;
function newObject(thread, cl, desc) {
    var cls = cl.getInitializedClass(thread, desc);
    return newObjectFromClass(thread, cls);
}
exports.newObject = newObject;
function getStaticFields(thread, cl, desc) {
    return cl.getInitializedClass(thread, desc).getConstructor(thread);
}
exports.getStaticFields = getStaticFields;
function newArrayFromDataWithClass(thread, cls, data) {
    var arr = newArrayFromClass(thread, cls, 0);
    arr.array = data;
    return arr;
}
exports.newArrayFromDataWithClass = newArrayFromDataWithClass;
function newArrayFromData(thread, cl, desc, data) {
    var arr = newArray(thread, cl, desc, 0);
    arr.array = data;
    return arr;
}
exports.newArrayFromData = newArrayFromData;
/**
 * Returns the boxed class name of the given primitive type.
 */
function boxClassName(primType) {
    switch (primType) {
        case 'B':
            return 'Ljava/lang/Byte;';
        case 'C':
            return 'Ljava/lang/Character;';
        case 'D':
            return 'Ljava/lang/Double;';
        case 'F':
            return 'Ljava/lang/Float;';
        case 'I':
            return 'Ljava/lang/Integer;';
        case 'J':
            return 'Ljava/lang/Long;';
        case 'S':
            return 'Ljava/lang/Short;';
        case 'Z':
            return 'Ljava/lang/Boolean;';
        case 'V':
            return 'Ljava/lang/Void;';
        default:
            throw new Error("Tried to box a non-primitive class: " + this.className);
    }
}
exports.boxClassName = boxClassName;
/**
 * Boxes the given primitive value.
 */
function boxPrimitiveValue(thread, type, val) {
    // XXX: We assume Integer for typing purposes only; avoids a huge union type.
    var primCls = thread.getBsCl().getInitializedClass(thread, boxClassName(type)), primClsCons = primCls.getConstructor(thread);
    return primClsCons.box(val);
}
exports.boxPrimitiveValue = boxPrimitiveValue;
/**
 * Boxes the given arguments into an Object[].
 *
 * @param descriptor The descriptor at the *call site*.
 * @param data The actual arguments for this function call.
 * @param isStatic If false, disregard the first type in the descriptor, as it is the 'this' argument.
 */
function boxArguments(thread, objArrCls, descriptor, data, isStatic, skipArgs) {
    if (skipArgs === void 0) { skipArgs = 0; }
    var paramTypes = getTypes(descriptor), boxedArgs = newArrayFromClass(thread, objArrCls, paramTypes.length - (isStatic ? 1 : 2) - skipArgs), i, j = 0, boxedArgsArr = boxedArgs.array, type;
    // Ignore return value.
    paramTypes.pop();
    if (!isStatic) {
        // Ignore 'this' argument.
        paramTypes.shift();
    }
    if (skipArgs > 0) {
        // Ignore regular arguments
        paramTypes = paramTypes.slice(skipArgs);
        data = data.slice(skipArgs);
    }
    for (i = 0; i < paramTypes.length; i++) {
        type = paramTypes[i];
        switch (type[0]) {
            case '[':
            case 'L':
                // Single argument slot, no boxing required.
                boxedArgsArr[i] = data[j];
                break;
            case 'J':
            case 'D':
                boxedArgsArr[i] = boxPrimitiveValue(thread, type, data[j]);
                j++;
                break;
            default:
                boxedArgsArr[i] = boxPrimitiveValue(thread, type, data[j]);
                break;
        }
        j++;
    }
    return boxedArgs;
}
exports.boxArguments = boxArguments;
function forwardResult(thread) {
    return function (e, rv) {
        if (e) {
            thread.throwException(e);
        }
        else {
            thread.asyncReturn(rv);
        }
    };
}
exports.forwardResult = forwardResult;
