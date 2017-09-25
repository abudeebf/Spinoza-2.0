"use strict";
var util = require('./util');
var enums = require('./enums');
var assert = require('./assert');
var global = require('./global');
if (typeof RELEASE === 'undefined')
    global.RELEASE = false;
var ExceptionHandler = (function () {
    function ExceptionHandler(startPC, endPC, handlerPC, catchType) {
        this.startPC = startPC;
        this.endPC = endPC;
        this.handlerPC = handlerPC;
        this.catchType = catchType;
    }
    ExceptionHandler.prototype.getName = function () {
        return 'ExceptionHandler';
    };
    ExceptionHandler.parse = function (bytesArray, constantPool) {
        var startPC = bytesArray.getUint16(), endPC = bytesArray.getUint16(), handlerPC = bytesArray.getUint16(), cti = bytesArray.getUint16(), catchType = cti === 0 ? "<any>" : constantPool.get(cti).name;
        return new this(startPC, endPC, handlerPC, catchType);
    };
    return ExceptionHandler;
})();
exports.ExceptionHandler = ExceptionHandler;
var Code = (function () {
    function Code(maxStack, maxLocals, exceptionHandlers, attrs, code) {
        this.maxStack = maxStack;
        this.maxLocals = maxLocals;
        this.exceptionHandlers = exceptionHandlers;
        this.attrs = attrs;
        this.code = code;
    }
    Code.prototype.getName = function () {
        return 'Code';
    };
    Code.parse = function (byteStream, constantPool) {
        var maxStack = byteStream.getUint16(), maxLocals = byteStream.getUint16(), codeLen = byteStream.getUint32();
        if (codeLen === 0) {
            if (RELEASE) {
                throw "Error parsing code: Code length is zero";
            }
        }
        var code = byteStream.slice(codeLen).getBuffer(), exceptLen = byteStream.getUint16(), exceptionHandlers = [];
        for (var i = 0; i < exceptLen; i++) {
            exceptionHandlers.push(ExceptionHandler.parse(byteStream, constantPool));
        }
        // yes, there are even attrs on attrs. BWOM... BWOM...
        var attrs = makeAttributes(byteStream, constantPool);
        return new this(maxStack, maxLocals, exceptionHandlers, attrs, code);
    };
    Code.prototype.getCode = function () {
        return this.code;
    };
    Code.prototype.getAttribute = function (name) {
        for (var i = 0; i < this.attrs.length; i++) {
            var attr = this.attrs[i];
            if (attr.getName() === name) {
                return attr;
            }
        }
        return null;
    };
    return Code;
})();
exports.Code = Code;
var LineNumberTable = (function () {
    function LineNumberTable(entries) {
        this.entries = entries;
    }
    LineNumberTable.prototype.getName = function () {
        return 'LineNumberTable';
    };
    /**
     * Returns the relevant source code line number for the specified program
     * counter.
     */
    LineNumberTable.prototype.getLineNumber = function (pc) {
        var j, lineNumber = -1;
        // get the last line number before the stack frame's pc
        for (j = 0; j < this.entries.length; j++) {
            var entry = this.entries[j];
            if (entry.startPC <= pc) {
                lineNumber = entry.lineNumber;
            }
            else {
                // Further entries are past the PC.
                break;
            }
        }
        return lineNumber;
    };
    LineNumberTable.parse = function (byteStream, constantPool) {
        var entries = [];
        var lntLen = byteStream.getUint16();
        for (var i = 0; i < lntLen; i++) {
            var spc = byteStream.getUint16();
            var ln = byteStream.getUint16();
            entries.push({
                'startPC': spc,
                'lineNumber': ln
            });
        }
        return new this(entries);
    };
    return LineNumberTable;
})();
exports.LineNumberTable = LineNumberTable;
var SourceFile = (function () {
    function SourceFile(filename) {
        this.filename = filename;
    }
    SourceFile.prototype.getName = function () {
        return 'SourceFile';
    };
    SourceFile.parse = function (byteStream, constantPool) {
        return new this(constantPool.get(byteStream.getUint16()).value);
    };
    return SourceFile;
})();
exports.SourceFile = SourceFile;
var StackMapTable = (function () {
    function StackMapTable(entries) {
        this.entries = entries;
    }
    StackMapTable.prototype.getName = function () {
        return 'StackMapTable';
    };
    StackMapTable.parse = function (byteStream, constantPool) {
        var numEntries = byteStream.getUint16(), entries = [];
        for (var i = 0; i < numEntries; i++) {
            entries.push(this.parseEntry(byteStream, constantPool));
        }
        return new this(entries);
    };
    StackMapTable.parseEntry = function (byteStream, constantPool) {
        var frameType = byteStream.getUint8(), locals, offsetDelta, i;
        if (frameType < 64) {
            return {
                type: enums.StackMapTableEntryType.SAME_FRAME,
                offsetDelta: frameType
            };
        }
        else if (frameType < 128) {
            return {
                type: enums.StackMapTableEntryType.SAME_LOCALS_1_STACK_ITEM_FRAME,
                offsetDelta: frameType - 64,
                stack: [this.parseVerificationTypeInfo(byteStream, constantPool)]
            };
        }
        else if (frameType < 247) {
        }
        else if (frameType === 247) {
            return {
                type: enums.StackMapTableEntryType.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED,
                offsetDelta: byteStream.getUint16(),
                stack: [this.parseVerificationTypeInfo(byteStream, constantPool)]
            };
        }
        else if (frameType < 251) {
            return {
                type: enums.StackMapTableEntryType.CHOP_FRAME,
                offsetDelta: byteStream.getUint16(),
                k: 251 - frameType
            };
        }
        else if (frameType === 251) {
            return {
                type: enums.StackMapTableEntryType.SAME_FRAME_EXTENDED,
                offsetDelta: byteStream.getUint16()
            };
        }
        else if (frameType < 255) {
            offsetDelta = byteStream.getUint16();
            locals = [];
            for (i = 0; i < frameType - 251; i++) {
                locals.push(this.parseVerificationTypeInfo(byteStream, constantPool));
            }
            return {
                type: enums.StackMapTableEntryType.APPEND_FRAME,
                offsetDelta: offsetDelta,
                locals: locals
            };
        }
        else if (frameType === 255) {
            offsetDelta = byteStream.getUint16();
            var numLocals = byteStream.getUint16();
            locals = [];
            for (i = 0; i < numLocals; i++) {
                locals.push(this.parseVerificationTypeInfo(byteStream, constantPool));
            }
            var numStackItems = byteStream.getUint16();
            var stack = [];
            for (i = 0; i < numStackItems; i++) {
                stack.push(this.parseVerificationTypeInfo(byteStream, constantPool));
            }
            return {
                type: enums.StackMapTableEntryType.FULL_FRAME,
                offsetDelta: offsetDelta,
                numLocals: numLocals,
                locals: locals,
                numStackItems: numStackItems,
                stack: stack
            };
        }
    };
    StackMapTable.parseVerificationTypeInfo = function (byteStream, constantPool) {
        var tag = byteStream.getUint8();
        if (tag === 7) {
            var cls = constantPool.get(byteStream.getUint16()).name;
            return 'class ' + (/\w/.test(cls[0]) ? util.descriptor2typestr(cls) : "\"" + cls + "\"");
        }
        else if (tag === 8) {
            return 'uninitialized ' + byteStream.getUint16();
        }
        else {
            var tagToType = ['bogus', 'int', 'float', 'double', 'long', 'null', 'this', 'object', 'uninitialized'];
            return tagToType[tag];
        }
    };
    return StackMapTable;
})();
exports.StackMapTable = StackMapTable;
var LocalVariableTable = (function () {
    function LocalVariableTable(entries) {
        this.entries = entries;
    }
    LocalVariableTable.prototype.getName = function () {
        return 'LocalVariableTable';
    };
    LocalVariableTable.parse = function (byteStream, constantPool) {
        var numEntries = byteStream.getUint16(), entries = [];
        for (var i = 0; i < numEntries; i++) {
            entries.push(this.parseEntries(byteStream, constantPool));
        }
        return new this(entries);
    };
    LocalVariableTable.parseEntries = function (bytes_array, constant_pool) {
        return {
            startPC: bytes_array.getUint16(),
            length: bytes_array.getUint16(),
            name: constant_pool.get(bytes_array.getUint16()).value,
            descriptor: constant_pool.get(bytes_array.getUint16()).value,
            ref: bytes_array.getUint16()
        };
    };
    return LocalVariableTable;
})();
exports.LocalVariableTable = LocalVariableTable;
var LocalVariableTypeTable = (function () {
    function LocalVariableTypeTable(entries) {
        this.entries = entries;
    }
    LocalVariableTypeTable.prototype.getName = function () {
        return 'LocalVariableTypeTable';
    };
    LocalVariableTypeTable.parse = function (byteStream, constantPool) {
        var numEntries = byteStream.getUint16(), i, entries = [];
        for (i = 0; i < numEntries; i++) {
            entries.push(this.parseTableEntry(byteStream, constantPool));
        }
        return new this(entries);
    };
    LocalVariableTypeTable.parseTableEntry = function (byteStream, constantPool) {
        return {
            startPC: byteStream.getUint16(),
            length: byteStream.getUint16(),
            name: constantPool.get(byteStream.getUint16()).value,
            signature: constantPool.get(byteStream.getUint16()).value,
            index: byteStream.getUint16()
        };
    };
    return LocalVariableTypeTable;
})();
exports.LocalVariableTypeTable = LocalVariableTypeTable;
var Exceptions = (function () {
    function Exceptions(exceptions) {
        this.exceptions = exceptions;
    }
    Exceptions.prototype.getName = function () {
        return 'Exceptions';
    };
    Exceptions.parse = function (byteStream, constantPool) {
        var numExceptions = byteStream.getUint16();
        var excRefs = [];
        for (var i = 0; i < numExceptions; i++) {
            excRefs.push(byteStream.getUint16());
        }
        return new this(excRefs.map(function (ref) { return constantPool.get(ref).name; }));
    };
    return Exceptions;
})();
exports.Exceptions = Exceptions;
var InnerClasses = (function () {
    function InnerClasses(classes) {
        this.classes = classes;
    }
    InnerClasses.prototype.getName = function () {
        return 'InnerClasses';
    };
    InnerClasses.parse = function (bytes_array, constant_pool) {
        var numClasses = bytes_array.getUint16(), classes = [];
        for (var i = 0; i < numClasses; i++) {
            classes.push(this.parseClass(bytes_array, constant_pool));
        }
        return new this(classes);
    };
    InnerClasses.parseClass = function (byteStream, constantPool) {
        return {
            innerInfoIndex: byteStream.getUint16(),
            outerInfoIndex: byteStream.getUint16(),
            innerNameIndex: byteStream.getUint16(),
            innerAccessFlags: byteStream.getUint16()
        };
    };
    return InnerClasses;
})();
exports.InnerClasses = InnerClasses;
var ConstantValue = (function () {
    function ConstantValue(value) {
        this.value = value;
    }
    ConstantValue.prototype.getName = function () {
        return 'ConstantValue';
    };
    ConstantValue.parse = function (bytes_array, constant_pool) {
        var ref = bytes_array.getUint16();
        return new this(constant_pool.get(ref));
    };
    return ConstantValue;
})();
exports.ConstantValue = ConstantValue;
var Synthetic = (function () {
    function Synthetic() {
    }
    Synthetic.prototype.getName = function () {
        return 'Synthetic';
    };
    Synthetic.parse = function (byteStream, constantPool) {
        return new this();
    };
    return Synthetic;
})();
exports.Synthetic = Synthetic;
var Deprecated = (function () {
    function Deprecated() {
    }
    Deprecated.prototype.getName = function () {
        return 'Deprecated';
    };
    Deprecated.parse = function (byteStream, constantPool) {
        return new this();
    };
    return Deprecated;
})();
exports.Deprecated = Deprecated;
var Signature = (function () {
    function Signature(sig) {
        this.sig = sig;
    }
    Signature.prototype.getName = function () {
        return 'Signature';
    };
    Signature.parse = function (byteStream, constantPool) {
        return new this(constantPool.get(byteStream.getUint16()).value);
    };
    return Signature;
})();
exports.Signature = Signature;
var RuntimeVisibleAnnotations = (function () {
    function RuntimeVisibleAnnotations(rawBytes, isHidden, isCallerSensitive, isCompiled) {
        this.rawBytes = rawBytes;
        this.isHidden = isHidden;
        this.isCallerSensitive = isCallerSensitive;
        this.isCompiled = isCompiled;
    }
    RuntimeVisibleAnnotations.prototype.getName = function () {
        return 'RuntimeVisibleAnnotations';
    };
    RuntimeVisibleAnnotations.parse = function (byteStream, constantPool, attrLen) {
        // No need to parse; OpenJDK parses these from within Java code from
        // the raw bytes.
        // ...but we need to look for the 'Hidden' annotation, which specifies if
        // the method should be omitted from stack frames.
        // And the 'compiled' annotation, which specifies if the method was
        // compiled.
        // And the 'CallerSensitive' annotation, which specifies that the function's
        // behavior differs depending on the caller.
        /**
         * Skip the current RuntimeVisibleAnnotation.
         */
        function skipAnnotation() {
            byteStream.skip(2); // type index
            var numValuePairs = byteStream.getUint16(), i;
            for (i = 0; i < numValuePairs; i++) {
                byteStream.skip(2); // element name index
                skipElementValue();
            }
        }
        /**
         * Skip this particular element value.
         */
        function skipElementValue() {
            var tag = String.fromCharCode(byteStream.getUint8());
            switch (tag) {
                case 'e':
                    // Fall-through.
                    byteStream.skip(2);
                case 'Z':
                case 'B':
                case 'C':
                case 'S':
                case 'I':
                case 'F':
                case 'J':
                case 'D':
                case 's':
                case 'c':
                    byteStream.skip(2);
                    break;
                case '@':
                    skipAnnotation();
                    break;
                case '[':
                    var numValues = byteStream.getUint16(), i;
                    for (i = 0; i < numValues; i++) {
                        skipElementValue();
                    }
                    break;
            }
        }
        var rawBytes = byteStream.read(attrLen), isHidden = false, isCompiled = false, isCallerSensitive = false;
        byteStream.seek(byteStream.pos() - rawBytes.length);
        var numAttributes = byteStream.getUint16(), i;
        for (i = 0; i < numAttributes; i++) {
            var typeName = constantPool.get(byteStream.getUint16());
            // Rewind.
            byteStream.seek(byteStream.pos() - 2);
            skipAnnotation();
            switch (typeName.value) {
                case 'Ljava/lang/invoke/LambdaForm$Hidden;':
                    isHidden = true;
                    break;
                case 'Lsig/sun/reflect/CallerSensitive;':
                    isCallerSensitive = true;
                    break;
                case 'Lsig/java/lang/invoke/LambdaForm$Compiled':
                    isCompiled = true;
                    break;
            }
        }
        return new this(rawBytes, isHidden, isCallerSensitive, isCompiled);
    };
    return RuntimeVisibleAnnotations;
})();
exports.RuntimeVisibleAnnotations = RuntimeVisibleAnnotations;
var AnnotationDefault = (function () {
    function AnnotationDefault(rawBytes) {
        this.rawBytes = rawBytes;
    }
    AnnotationDefault.prototype.getName = function () {
        return 'AnnotationDefault';
    };
    AnnotationDefault.parse = function (byteStream, constantPool, attrLen) {
        return new this(byteStream.read(attrLen));
    };
    return AnnotationDefault;
})();
exports.AnnotationDefault = AnnotationDefault;
var EnclosingMethod = (function () {
    function EnclosingMethod(encClass, encMethod) {
        this.encClass = encClass;
        this.encMethod = encMethod;
    }
    EnclosingMethod.prototype.getName = function () {
        return 'EnclosingMethod';
    };
    EnclosingMethod.parse = function (byteStream, constantPool) {
        var encClass = constantPool.get(byteStream.getUint16()), methodRef = byteStream.getUint16(), encMethod = null;
        if (methodRef > 0) {
            encMethod = constantPool.get(methodRef);
            assert(encMethod.getType() === enums.ConstantPoolItemType.NAME_AND_TYPE, "Enclosing method must be a name and type info.");
        }
        return new this(encClass, encMethod);
    };
    return EnclosingMethod;
})();
exports.EnclosingMethod = EnclosingMethod;
var BootstrapMethods = (function () {
    function BootstrapMethods(bootstrapMethods) {
        this.bootstrapMethods = bootstrapMethods;
    }
    BootstrapMethods.prototype.getName = function () {
        return 'BootstrapMethods';
    };
    BootstrapMethods.parse = function (byteStream, constantPool) {
        var numBootstrapMethods = byteStream.getUint16(), bootstrapMethods = [];
        for (var i = 0; i < numBootstrapMethods; i++) {
            var methodHandle = constantPool.get(byteStream.getUint16());
            var numArgs = byteStream.getUint16();
            var args = [];
            for (var j = 0; j < numArgs; j++) {
                args.push(constantPool.get(byteStream.getUint16()));
            }
            bootstrapMethods.push([methodHandle, args]);
        }
        return new this(bootstrapMethods);
    };
    return BootstrapMethods;
})();
exports.BootstrapMethods = BootstrapMethods;
var RuntimeVisibleParameterAnnotations = (function () {
    function RuntimeVisibleParameterAnnotations(rawBytes) {
        this.rawBytes = rawBytes;
    }
    RuntimeVisibleParameterAnnotations.prototype.getName = function () {
        return 'RuntimeVisibleParameterAnnotations';
    };
    RuntimeVisibleParameterAnnotations.parse = function (byteStream, constantPool, attrLen) {
        return new this(byteStream.read(attrLen));
    };
    return RuntimeVisibleParameterAnnotations;
})();
exports.RuntimeVisibleParameterAnnotations = RuntimeVisibleParameterAnnotations;
function makeAttributes(byteStream, constantPool) {
    var attrTypes = {
        'Code': Code,
        'LineNumberTable': LineNumberTable,
        'SourceFile': SourceFile,
        'StackMapTable': StackMapTable,
        'LocalVariableTable': LocalVariableTable,
        'LocalVariableTypeTable': LocalVariableTypeTable,
        'ConstantValue': ConstantValue,
        'Exceptions': Exceptions,
        'InnerClasses': InnerClasses,
        'Synthetic': Synthetic,
        'Deprecated': Deprecated,
        'Signature': Signature,
        'RuntimeVisibleAnnotations': RuntimeVisibleAnnotations,
        'AnnotationDefault': AnnotationDefault,
        'EnclosingMethod': EnclosingMethod,
        'BootstrapMethods': BootstrapMethods,
        'RuntimeVisibleParameterAnnotations': RuntimeVisibleParameterAnnotations
    };
    var numAttrs = byteStream.getUint16();
    var attrs = [];
    for (var i = 0; i < numAttrs; i++) {
        var name = constantPool.get(byteStream.getUint16()).value;
        var attrLen = byteStream.getUint32();
        if (attrTypes[name] != null) {
            var oldLen = byteStream.size();
            var attr = attrTypes[name].parse(byteStream, constantPool, attrLen, name);
            var newLen = byteStream.size();
            assert((oldLen - newLen) <= attrLen, "A parsed attribute read beyond its data! " + name);
            if (oldLen - newLen !== attrLen) {
                byteStream.skip(attrLen - oldLen + newLen);
            }
            attrs.push(attr);
        }
        else {
            // we must silently ignore other attrs
            byteStream.skip(attrLen);
        }
    }
    return attrs;
}
exports.makeAttributes = makeAttributes;
