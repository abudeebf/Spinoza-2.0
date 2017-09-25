/**
 * Contains JVM opcode implementations for the JVM interpreter.
 */
// We use snake case for the opcode names so they match the JVM spec.
// As for typedef:memberVariableDeclarator, we disable this so we can have
// member variable opcodes without explicitly typing them as IOpcodeImplementation.
/* tslint:disable:variable-name typedef:memberVariableDeclarator */
"use strict";
var gLong = require('./gLong');
var util = require('./util');
var enums = require('./enums');
var assert = require('./assert');
/**
 * Helper function: Checks if object is null. Throws a NullPointerException
 * if it is.
 * @return True if the object is null.
 */
function isNull(thread, frame, obj) {
    if (obj == null) {
        throwException(thread, frame, 'Ljava/lang/NullPointerException;', '');
        return true;
    }
    return false;
}
exports.isNull = isNull;
/**
 * Helper function: Pops off two items, returns the second.
 */
function pop2(stack) {
    // Ignore NULL.
    stack.pop();
    return stack.pop();
}
exports.pop2 = pop2;
function resolveCPItem(thread, frame, cpItem) {
    thread.setStatus(enums.ThreadStatus.ASYNC_WAITING);
    cpItem.resolve(thread, frame.getLoader(), frame.method.cls, function (status) {
        if (status) {
            thread.setStatus(enums.ThreadStatus.RUNNABLE);
        }
    }, false);
    frame.returnToThreadLoop = true;
}
exports.resolveCPItem = resolveCPItem;
function initializeClassFromClass(thread, frame, cls) {
    thread.setStatus(enums.ThreadStatus.ASYNC_WAITING);
    cls.initialize(thread, function (cdata) {
        if (cdata != null) {
            thread.setStatus(enums.ThreadStatus.RUNNABLE);
        }
    }, false);
    frame.returnToThreadLoop = true;
}
exports.initializeClassFromClass = initializeClassFromClass;
/**
 * Helper function: Pauses the thread and initializes a class.
 */
function initializeClass(thread, frame, clsRef) {
    thread.setStatus(enums.ThreadStatus.ASYNC_WAITING);
    function initialize(cls) {
        cls.initialize(thread, function (cdata) {
            if (cdata != null) {
                thread.setStatus(enums.ThreadStatus.RUNNABLE);
            }
        });
    }
    if (!clsRef.isResolved()) {
        clsRef.resolve(thread, frame.getLoader(), frame.method.cls, function (status) {
            if (status) {
                initialize(clsRef.cls);
            }
        }, false);
    }
    else {
        initialize(clsRef.cls);
    }
    frame.returnToThreadLoop = true;
}
exports.initializeClass = initializeClass;
/**
 * Interrupts the current method's execution and throws an exception.
 *
 * NOTE: This does *not* interrupt JavaScript control flow, so any opcode
 * calling this function must *return* and not do anything else.
 */
function throwException(thread, frame, clsName, msg) {
    thread.throwNewException(clsName, msg);
    frame.returnToThreadLoop = true;
}
exports.throwException = throwException;
exports.ArrayTypes = {
    4: 'Z', 5: 'C', 6: 'F', 7: 'D', 8: 'B', 9: 'S', 10: 'I', 11: 'J'
};
/**
 * Contains definitions for all JVM opcodes.
 */
var Opcodes = (function () {
    function Opcodes() {
    }
    /* 32-bit array load opcodes */
    /**
     * 32-bit array load opcode
     */
    Opcodes._aload_32 = function (thread, frame) {
        var stack = frame.stack, idx = stack.pop(), obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            var len = obj.array.length;
            if (idx < 0 || idx >= len) {
                throwException(thread, frame, 'Ljava/lang/ArrayIndexOutOfBoundsException;', idx + " not in length " + len + " array of type " + obj.getClass().getInternalName());
            }
            else {
                stack.push(obj.array[idx]);
                frame.pc++;
            }
        }
        // 'obj' is NULL. isNull threw an exception for us.
    };
    /* 64-bit array load opcodes */
    /**
     * 64-bit array load opcode.
     */
    Opcodes._aload_64 = function (thread, frame) {
        var stack = frame.stack, idx = stack.pop(), obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            var len = obj.array.length;
            if (idx < 0 || idx >= len) {
                throwException(thread, frame, 'Ljava/lang/ArrayIndexOutOfBoundsException;', idx + " not in length " + len + " array of type " + obj.getClass().getInternalName());
            }
            else {
                stack.push(obj.array[idx]);
                // 64-bit value.
                stack.push(null);
                frame.pc++;
            }
        }
        // 'obj' is NULL. isNull threw an exception for us.
    };
    /* 32-bit array store opcodes */
    /**
     * 32-bit array store.
     * @private
     */
    Opcodes._astore_32 = function (thread, frame) {
        var stack = frame.stack, value = stack.pop(), idx = stack.pop(), obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            var len = obj.array.length;
            if (idx < 0 || idx >= len) {
                throwException(thread, frame, 'Ljava/lang/ArrayIndexOutOfBoundsException;', idx + " not in length " + len + " array of type " + obj.getClass().getInternalName());
            }
            else {
                obj.array[idx] = value;
                frame.pc++;
            }
        }
        // 'obj' is NULL. isNull threw an exception for us.
    };
    /* 64-bit array store opcodes */
    /**
     * 64-bit array store.
     * @private
     */
    Opcodes._astore_64 = function (thread, frame) {
        var stack = frame.stack, value = pop2(stack), idx = stack.pop(), obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            var len = obj.array.length;
            if (idx < 0 || idx >= len) {
                throwException(thread, frame, 'Ljava/lang/ArrayIndexOutOfBoundsException;', idx + " not in length " + len + " array of type " + obj.getClass().getInternalName());
            }
            else {
                obj.array[idx] = value;
                frame.pc++;
            }
        }
        // 'obj' is NULL. isNull threw an exception for us.
    };
    /* 32-bit constants */
    Opcodes.aconst_null = function (thread, frame) {
        frame.stack.push(null);
        frame.pc++;
    };
    Opcodes._const_0_32 = function (thread, frame) {
        frame.stack.push(0);
        frame.pc++;
    };
    Opcodes._const_1_32 = function (thread, frame) {
        frame.stack.push(1);
        frame.pc++;
    };
    Opcodes._const_2_32 = function (thread, frame) {
        frame.stack.push(2);
        frame.pc++;
    };
    Opcodes.iconst_m1 = function (thread, frame) {
        frame.stack.push(-1);
        frame.pc++;
    };
    Opcodes.iconst_3 = function (thread, frame) {
        frame.stack.push(3);
        frame.pc++;
    };
    Opcodes.iconst_4 = function (thread, frame) {
        frame.stack.push(4);
        frame.pc++;
    };
    Opcodes.iconst_5 = function (thread, frame) {
        frame.stack.push(5);
        frame.pc++;
    };
    /* 64-bit constants */
    Opcodes.lconst_0 = function (thread, frame) {
        frame.stack.push(gLong.ZERO, null);
        frame.pc++;
    };
    Opcodes.lconst_1 = function (thread, frame) {
        frame.stack.push(gLong.ONE, null);
        frame.pc++;
    };
    Opcodes.dconst_0 = function (thread, frame) {
        frame.stack.push(0, null);
        frame.pc++;
    };
    Opcodes.dconst_1 = function (thread, frame) {
        frame.stack.push(1, null);
        frame.pc++;
    };
    /* 32-bit load opcodes */
    Opcodes._load_32 = function (thread, frame, code, pc) {
        frame.stack.push(frame.locals[code.readUInt8(pc + 1)]);
        frame.pc += 2;
    };
    Opcodes._load_0_32 = function (thread, frame) {
        frame.stack.push(frame.locals[0]);
        frame.pc++;
    };
    Opcodes._load_1_32 = function (thread, frame) {
        frame.stack.push(frame.locals[1]);
        frame.pc++;
    };
    Opcodes._load_2_32 = function (thread, frame) {
        frame.stack.push(frame.locals[2]);
        frame.pc++;
    };
    Opcodes._load_3_32 = function (thread, frame) {
        frame.stack.push(frame.locals[3]);
        frame.pc++;
    };
    /* 64-bit load opcodes */
    Opcodes._load_64 = function (thread, frame, code, pc) {
        frame.stack.push(frame.locals[code.readUInt8(pc + 1)], null);
        frame.pc += 2;
    };
    Opcodes._load_0_64 = function (thread, frame) {
        frame.stack.push(frame.locals[0], null);
        frame.pc++;
    };
    Opcodes._load_1_64 = function (thread, frame) {
        frame.stack.push(frame.locals[1], null);
        frame.pc++;
    };
    Opcodes._load_2_64 = function (thread, frame) {
        frame.stack.push(frame.locals[2], null);
        frame.pc++;
    };
    Opcodes._load_3_64 = function (thread, frame) {
        frame.stack.push(frame.locals[3], null);
        frame.pc++;
    };
    /* 32-bit store opcodes */
    Opcodes._store_32 = function (thread, frame, code, pc) {
        frame.locals[code.readUInt8(pc + 1)] = frame.stack.pop();
        frame.pc += 2;
    };
    Opcodes._store_0_32 = function (thread, frame) {
        frame.locals[0] = frame.stack.pop();
        frame.pc++;
    };
    Opcodes._store_1_32 = function (thread, frame) {
        frame.locals[1] = frame.stack.pop();
        frame.pc++;
    };
    Opcodes._store_2_32 = function (thread, frame) {
        frame.locals[2] = frame.stack.pop();
        frame.pc++;
    };
    Opcodes._store_3_32 = function (thread, frame) {
        frame.locals[3] = frame.stack.pop();
        frame.pc++;
    };
    /* 64-bit store opcodes */
    Opcodes._store_64 = function (thread, frame, code, pc) {
        var offset = code.readUInt8(pc + 1);
        // NULL
        frame.locals[offset + 1] = frame.stack.pop();
        // The actual value.
        frame.locals[offset] = frame.stack.pop();
        frame.pc += 2;
    };
    Opcodes._store_0_64 = function (thread, frame) {
        frame.locals[1] = frame.stack.pop();
        frame.locals[0] = frame.stack.pop();
        frame.pc++;
    };
    Opcodes._store_1_64 = function (thread, frame) {
        frame.locals[2] = frame.stack.pop();
        frame.locals[1] = frame.stack.pop();
        frame.pc++;
    };
    Opcodes._store_2_64 = function (thread, frame) {
        frame.locals[3] = frame.stack.pop();
        frame.locals[2] = frame.stack.pop();
        frame.pc++;
    };
    Opcodes._store_3_64 = function (thread, frame) {
        frame.locals[4] = frame.stack.pop();
        frame.locals[3] = frame.stack.pop();
        frame.pc++;
    };
    /* Misc. */
    Opcodes.sipush = function (thread, frame, code, pc) {
        frame.stack.push(code.readInt16BE(pc + 1));
        frame.pc += 3;
    };
    Opcodes.bipush = function (thread, frame, code, pc) {
        frame.stack.push(code.readInt8(pc + 1));
        frame.pc += 2;
    };
    Opcodes.pop = function (thread, frame) {
        frame.stack.pop();
        frame.pc++;
    };
    Opcodes.pop2 = function (thread, frame) {
        // http://i.imgur.com/MieF0KG.jpg
        frame.stack.pop();
        frame.stack.pop();
        frame.pc++;
    };
    Opcodes.dup = function (thread, frame) {
        var stack = frame.stack, v = stack.pop();
        stack.push(v, v);
        frame.pc++;
    };
    Opcodes.dup_x1 = function (thread, frame) {
        var stack = frame.stack, v1 = stack.pop(), v2 = stack.pop();
        stack.push(v1, v2, v1);
        frame.pc++;
    };
    Opcodes.dup_x2 = function (thread, frame) {
        var stack = frame.stack, v1 = stack.pop(), v2 = stack.pop(), v3 = stack.pop();
        stack.push(v1, v3, v2, v1);
        frame.pc++;
    };
    Opcodes.dup2 = function (thread, frame) {
        var stack = frame.stack, v1 = stack.pop(), v2 = stack.pop();
        stack.push(v2, v1, v2, v1);
        frame.pc++;
    };
    Opcodes.dup2_x1 = function (thread, frame) {
        var stack = frame.stack, v1 = stack.pop(), v2 = stack.pop(), v3 = stack.pop();
        stack.push(v2, v1, v3, v2, v1);
        frame.pc++;
    };
    Opcodes.dup2_x2 = function (thread, frame) {
        var stack = frame.stack, v1 = stack.pop(), v2 = stack.pop(), v3 = stack.pop(), v4 = stack.pop();
        stack.push(v2, v1, v4, v3, v2, v1);
        frame.pc++;
    };
    Opcodes.swap = function (thread, frame) {
        var stack = frame.stack, v1 = stack.pop(), v2 = stack.pop();
        stack.push(v1, v2);
        frame.pc++;
    };
    /* Math Opcodes */
    Opcodes.iadd = function (thread, frame) {
        var stack = frame.stack;
        stack.push((stack.pop() + stack.pop()) | 0);
        frame.pc++;
    };
    Opcodes.ladd = function (thread, frame) {
        var stack = frame.stack;
        // push2
        stack.push(pop2(stack).add(pop2(stack)), null);
        frame.pc++;
    };
    Opcodes.fadd = function (thread, frame) {
        var stack = frame.stack;
        stack.push(util.wrapFloat(stack.pop() + stack.pop()));
        frame.pc++;
    };
    Opcodes.dadd = function (thread, frame) {
        var stack = frame.stack;
        // push2
        stack.push(pop2(stack) + pop2(stack), null);
        frame.pc++;
    };
    Opcodes.isub = function (thread, frame) {
        var stack = frame.stack;
        stack.push((-stack.pop() + stack.pop()) | 0);
        frame.pc++;
    };
    Opcodes.fsub = function (thread, frame) {
        var stack = frame.stack;
        stack.push(util.wrapFloat(-stack.pop() + stack.pop()));
        frame.pc++;
    };
    Opcodes.dsub = function (thread, frame) {
        var stack = frame.stack;
        stack.push(-pop2(stack) + pop2(stack), null);
        frame.pc++;
    };
    Opcodes.lsub = function (thread, frame) {
        var stack = frame.stack;
        stack.push(pop2(stack).negate().add(pop2(stack)), null);
        frame.pc++;
    };
    Opcodes.imul = function (thread, frame) {
        var stack = frame.stack;
        stack.push(Math.imul(stack.pop(), stack.pop()));
        frame.pc++;
    };
    Opcodes.lmul = function (thread, frame) {
        var stack = frame.stack;
        // push2
        stack.push(pop2(stack).multiply(pop2(stack)), null);
        frame.pc++;
    };
    Opcodes.fmul = function (thread, frame) {
        var stack = frame.stack;
        stack.push(util.wrapFloat(stack.pop() * stack.pop()));
        frame.pc++;
    };
    Opcodes.dmul = function (thread, frame) {
        var stack = frame.stack;
        stack.push(pop2(stack) * pop2(stack), null);
        frame.pc++;
    };
    Opcodes.idiv = function (thread, frame) {
        var stack = frame.stack, b = stack.pop(), a = stack.pop();
        if (b === 0) {
            throwException(thread, frame, 'Ljava/lang/ArithmeticException;', '/ by zero');
        }
        else {
            // spec: "if the dividend is the negative integer of largest possible magnitude
            // for the int type, and the divisor is -1, then overflow occurs, and the
            // result is equal to the dividend."
            if (a === enums.Constants.INT_MIN && b === -1) {
                stack.push(a);
            }
            else {
                stack.push((a / b) | 0);
            }
            frame.pc++;
        }
    };
    Opcodes.ldiv = function (thread, frame) {
        var stack = frame.stack, b = pop2(stack), a = pop2(stack);
        if (b.isZero()) {
            throwException(thread, frame, 'Ljava/lang/ArithmeticException;', '/ by zero');
        }
        else {
            stack.push(a.div(b), null);
            frame.pc++;
        }
    };
    Opcodes.fdiv = function (thread, frame) {
        var stack = frame.stack, a = stack.pop();
        stack.push(util.wrapFloat(stack.pop() / a));
        frame.pc++;
    };
    Opcodes.ddiv = function (thread, frame) {
        var stack = frame.stack, v = pop2(stack);
        stack.push(pop2(stack) / v, null);
        frame.pc++;
    };
    Opcodes.irem = function (thread, frame) {
        var stack = frame.stack, b = stack.pop(), a = stack.pop();
        if (b === 0) {
            throwException(thread, frame, 'Ljava/lang/ArithmeticException;', '/ by zero');
        }
        else {
            stack.push(a % b);
            frame.pc++;
        }
    };
    Opcodes.lrem = function (thread, frame) {
        var stack = frame.stack, b = pop2(stack), a = pop2(stack);
        if (b.isZero()) {
            throwException(thread, frame, 'Ljava/lang/ArithmeticException;', '/ by zero');
        }
        else {
            stack.push(a.modulo(b), null);
            frame.pc++;
        }
    };
    Opcodes.frem = function (thread, frame) {
        var stack = frame.stack, b = stack.pop();
        stack.push(stack.pop() % b);
        frame.pc++;
    };
    Opcodes.drem = function (thread, frame) {
        var stack = frame.stack, b = pop2(stack);
        stack.push(pop2(stack) % b, null);
        frame.pc++;
    };
    Opcodes.ineg = function (thread, frame) {
        var stack = frame.stack;
        stack.push(-stack.pop() | 0);
        frame.pc++;
    };
    Opcodes.lneg = function (thread, frame) {
        var stack = frame.stack;
        stack.push(pop2(stack).negate(), null);
        frame.pc++;
    };
    Opcodes.fneg = function (thread, frame) {
        var stack = frame.stack;
        stack.push(-stack.pop());
        frame.pc++;
    };
    Opcodes.dneg = function (thread, frame) {
        var stack = frame.stack;
        stack.push(-pop2(stack), null);
        frame.pc++;
    };
    /* Bitwise Operations */
    Opcodes.ishl = function (thread, frame) {
        var stack = frame.stack, s = stack.pop();
        stack.push(stack.pop() << s);
        frame.pc++;
    };
    Opcodes.lshl = function (thread, frame) {
        var stack = frame.stack, s = stack.pop();
        stack.push(pop2(stack).shiftLeft(gLong.fromInt(s)), null);
        frame.pc++;
    };
    Opcodes.ishr = function (thread, frame) {
        var stack = frame.stack, s = stack.pop();
        stack.push(stack.pop() >> s);
        frame.pc++;
    };
    Opcodes.lshr = function (thread, frame) {
        var stack = frame.stack, s = stack.pop();
        stack.push(pop2(stack).shiftRight(gLong.fromInt(s)), null);
        frame.pc++;
    };
    Opcodes.iushr = function (thread, frame) {
        var stack = frame.stack, s = stack.pop();
        stack.push((stack.pop() >>> s) | 0);
        frame.pc++;
    };
    Opcodes.lushr = function (thread, frame) {
        var stack = frame.stack, s = stack.pop();
        stack.push(pop2(stack).shiftRightUnsigned(gLong.fromInt(s)), null);
        frame.pc++;
    };
    Opcodes.iand = function (thread, frame) {
        var stack = frame.stack;
        stack.push(stack.pop() & stack.pop());
        frame.pc++;
    };
    Opcodes.land = function (thread, frame) {
        var stack = frame.stack;
        stack.push(pop2(stack).and(pop2(stack)), null);
        frame.pc++;
    };
    Opcodes.ior = function (thread, frame) {
        var stack = frame.stack;
        stack.push(stack.pop() | stack.pop());
        frame.pc++;
    };
    Opcodes.lor = function (thread, frame) {
        var stack = frame.stack;
        stack.push(pop2(stack).or(pop2(stack)), null);
        frame.pc++;
    };
    Opcodes.ixor = function (thread, frame) {
        var stack = frame.stack;
        stack.push(stack.pop() ^ stack.pop());
        frame.pc++;
    };
    Opcodes.lxor = function (thread, frame) {
        var stack = frame.stack;
        stack.push(pop2(stack).xor(pop2(stack)), null);
        frame.pc++;
    };
    Opcodes.iinc = function (thread, frame, code, pc) {
        var idx = code.readUInt8(pc + 1), val = code.readInt8(pc + 2);
        frame.locals[idx] = (frame.locals[idx] + val) | 0;
        frame.pc += 3;
    };
    Opcodes.i2l = function (thread, frame) {
        var stack = frame.stack;
        stack.push(gLong.fromInt(stack.pop()), null);
        frame.pc++;
    };
    Opcodes.i2f = function (thread, frame) {
        // NOP; we represent ints as floats anyway.
        // @todo What about quantities unexpressable as floats?
        frame.pc++;
    };
    Opcodes.i2d = function (thread, frame) {
        frame.stack.push(null);
        frame.pc++;
    };
    Opcodes.l2i = function (thread, frame) {
        var stack = frame.stack;
        // Ignore NULL.
        stack.pop();
        stack.push(stack.pop().toInt());
        frame.pc++;
    };
    Opcodes.l2f = function (thread, frame) {
        var stack = frame.stack;
        // Ignore NULL.
        stack.pop();
        stack.push(stack.pop().toNumber());
        frame.pc++;
    };
    Opcodes.l2d = function (thread, frame) {
        var stack = frame.stack;
        // Ignore NULL.
        stack.pop();
        stack.push(stack.pop().toNumber(), null);
        frame.pc++;
    };
    Opcodes.f2i = function (thread, frame) {
        var stack = frame.stack;
        stack.push(util.float2int(stack.pop()));
        frame.pc++;
    };
    Opcodes.f2l = function (thread, frame) {
        var stack = frame.stack;
        stack.push(gLong.fromNumber(stack.pop()), null);
        frame.pc++;
    };
    Opcodes.f2d = function (thread, frame) {
        frame.stack.push(null);
        frame.pc++;
    };
    Opcodes.d2i = function (thread, frame) {
        var stack = frame.stack;
        stack.pop();
        stack.push(util.float2int(stack.pop()));
        frame.pc++;
    };
    Opcodes.d2l = function (thread, frame) {
        var stack = frame.stack, d_val = pop2(stack);
        if (d_val === Number.POSITIVE_INFINITY) {
            stack.push(gLong.MAX_VALUE, null);
        }
        else if (d_val === Number.NEGATIVE_INFINITY) {
            stack.push(gLong.MIN_VALUE, null);
        }
        else {
            stack.push(gLong.fromNumber(d_val), null);
        }
        frame.pc++;
    };
    Opcodes.d2f = function (thread, frame) {
        var stack = frame.stack;
        stack.pop();
        stack.push(util.wrapFloat(stack.pop()));
        frame.pc++;
    };
    Opcodes.i2b = function (thread, frame) {
        var stack = frame.stack;
        stack.push((stack.pop() << 24) >> 24);
        frame.pc++;
    };
    Opcodes.i2c = function (thread, frame) {
        var stack = frame.stack;
        stack.push(stack.pop() & 0xFFFF);
        frame.pc++;
    };
    Opcodes.i2s = function (thread, frame) {
        var stack = frame.stack;
        stack.push((stack.pop() << 16) >> 16);
        frame.pc++;
    };
    Opcodes.lcmp = function (thread, frame) {
        var stack = frame.stack, v2 = pop2(stack);
        stack.push(pop2(stack).compare(v2));
        frame.pc++;
    };
    Opcodes.fcmpl = function (thread, frame) {
        var stack = frame.stack, v2 = stack.pop(), v1 = stack.pop();
        if (v1 === v2) {
            stack.push(0);
        }
        else if (v1 > v2) {
            stack.push(1);
        }
        else {
            // v1 < v2, and if v1 or v2 is NaN.
            stack.push(-1);
        }
        frame.pc++;
    };
    Opcodes.fcmpg = function (thread, frame) {
        var stack = frame.stack, v2 = stack.pop(), v1 = stack.pop();
        if (v1 === v2) {
            stack.push(0);
        }
        else if (v1 < v2) {
            stack.push(-1);
        }
        else {
            // v1 > v2, and if v1 or v2 is NaN.
            stack.push(1);
        }
        frame.pc++;
    };
    Opcodes.dcmpl = function (thread, frame) {
        var stack = frame.stack, v2 = pop2(stack), v1 = pop2(stack);
        if (v1 === v2) {
            stack.push(0);
        }
        else if (v1 > v2) {
            stack.push(1);
        }
        else {
            // v1 < v2, and if v1 or v2 is NaN.
            stack.push(-1);
        }
        frame.pc++;
    };
    Opcodes.dcmpg = function (thread, frame) {
        var stack = frame.stack, v2 = pop2(stack), v1 = pop2(stack);
        if (v1 === v2) {
            stack.push(0);
        }
        else if (v1 < v2) {
            stack.push(-1);
        }
        else {
            // v1 > v2, and if v1 or v2 is NaN.
            stack.push(1);
        }
        frame.pc++;
    };
    /* Unary branch opcodes */
    Opcodes.ifeq = function (thread, frame, code, pc) {
        if (frame.stack.pop() === 0) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.ifne = function (thread, frame, code, pc) {
        if (frame.stack.pop() !== 0) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.iflt = function (thread, frame, code, pc) {
        if (frame.stack.pop() < 0) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.ifge = function (thread, frame, code, pc) {
        if (frame.stack.pop() >= 0) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.ifgt = function (thread, frame, code, pc) {
        if (frame.stack.pop() > 0) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.ifle = function (thread, frame, code, pc) {
        if (frame.stack.pop() <= 0) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    /* Binary branch opcodes */
    Opcodes.if_icmpeq = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 === v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_icmpne = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 !== v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_icmplt = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 < v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_icmpge = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 >= v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_icmpgt = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 > v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_icmple = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 <= v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_acmpeq = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 === v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.if_acmpne = function (thread, frame, code, pc) {
        var v2 = frame.stack.pop();
        var v1 = frame.stack.pop();
        if (v1 !== v2) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    /* Jump opcodes */
    Opcodes.goto = function (thread, frame, code, pc) {
        frame.pc += code.readInt16BE(pc + 1);
    };
    Opcodes.jsr = function (thread, frame, code, pc) {
        frame.stack.push(frame.pc + 3);
        frame.pc += code.readInt16BE(pc + 1);
    };
    Opcodes.ret = function (thread, frame, code, pc) {
        frame.pc = frame.locals[code.readUInt8(pc + 1)];
    };
    Opcodes.tableswitch = function (thread, frame, code, pc) {
        // Ignore padding bytes. The +1 is to skip the opcode byte.
        pc += ((4 - (pc + 1) % 4) % 4) + 1;
        var defaultOffset = code.readInt32BE(pc), low = code.readInt32BE(pc + 4), high = code.readInt32BE(pc + 8), offset = frame.stack.pop();
        if (offset >= low && offset <= high) {
            frame.pc += code.readInt32BE(pc + 12 + ((offset - low) * 4));
        }
        else {
            frame.pc += defaultOffset;
        }
    };
    Opcodes.lookupswitch = function (thread, frame, code, pc) {
        // Skip padding bytes. The +1 is to skip the opcode byte.
        pc += ((4 - (pc + 1) % 4) % 4) + 1;
        var defaultOffset = code.readInt32BE(pc), nPairs = code.readInt32BE(pc + 4), i, v = frame.stack.pop();
        pc += 8;
        for (i = 0; i < nPairs; i++) {
            if (code.readInt32BE(pc) === v) {
                frame.pc += code.readInt32BE(pc + 4);
                return;
            }
            pc += 8;
        }
        // No match found.
        frame.pc += defaultOffset;
    };
    Opcodes.return = function (thread, frame) {
        frame.returnToThreadLoop = true;
        if (frame.method.accessFlags.isSynchronized()) {
            // monitorexit
            if (!frame.method.methodLock(thread, frame).exit(thread)) {
                // monitorexit threw an exception.
                return;
            }
        }
        thread.asyncReturn();
    };
    /* 32-bit return bytecodes */
    Opcodes._return_32 = function (thread, frame) {
        frame.returnToThreadLoop = true;
        if (frame.method.accessFlags.isSynchronized()) {
            // monitorexit
            if (!frame.method.methodLock(thread, frame).exit(thread)) {
                // monitorexit threw an exception.
                return;
            }
        }
        thread.asyncReturn(frame.stack[0]);
    };
    /* 64-bit return opcodes */
    Opcodes._return_64 = function (thread, frame) {
        frame.returnToThreadLoop = true;
        if (frame.method.accessFlags.isSynchronized()) {
            // monitorexit
            if (!frame.method.methodLock(thread, frame).exit(thread)) {
                // monitorexit threw an exception.
                return;
            }
        }
        thread.asyncReturn(frame.stack[0], null);
    };
    Opcodes.getstatic = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        assert(fieldInfo.getType() === enums.ConstantPoolItemType.FIELDREF);
        if (fieldInfo.isResolved()) {
            // Get the *actual* class that owns this field.
            // This may not be initialized if it's an interface, so we need to check.
            var fieldOwnerCls = fieldInfo.field.cls;
            if (fieldOwnerCls.isInitialized(thread)) {
                // Opcode is ready to execute! Rewrite to a 'fast' version,
                // and run the fast version.
                if (fieldInfo.nameAndTypeInfo.descriptor === 'J' || fieldInfo.nameAndTypeInfo.descriptor === 'D') {
                    code.writeUInt8(enums.OpCode.GETSTATIC_FAST64, pc);
                }
                else {
                    code.writeUInt8(enums.OpCode.GETSTATIC_FAST32, pc);
                }
                // Stash the result of field lookup.
                fieldInfo.fieldOwnerConstructor = fieldOwnerCls.getConstructor(thread);
            }
            else {
                // Initialize class and rerun opcode
                initializeClassFromClass(thread, frame, fieldOwnerCls);
            }
        }
        else {
            // Resolve the field.
            resolveCPItem(thread, frame, fieldInfo);
        }
    };
    /**
     * A fast version of getstatic that assumes that relevant classes are
     * initialized.
     *
     * Retrieves a 32-bit value.
     */
    Opcodes.getstatic_fast32 = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        frame.stack.push(fieldInfo.fieldOwnerConstructor[fieldInfo.fullFieldName]);
        frame.pc += 3;
    };
    /**
     * A fast version of getstatic that assumes that relevant classes are
     * initialized.
     *
     * Retrieves a 64-bit value.
     */
    Opcodes.getstatic_fast64 = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        frame.stack.push(fieldInfo.fieldOwnerConstructor[fieldInfo.fullFieldName], null);
        frame.pc += 3;
    };
    Opcodes.putstatic = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        assert(fieldInfo.getType() === enums.ConstantPoolItemType.FIELDREF);
        if (fieldInfo.isResolved()) {
            // Get the *actual* class that owns this field.
            // This may not be initialized if it's an interface, so we need to check.
            var fieldOwnerCls = fieldInfo.field.cls;
            if (fieldOwnerCls.isInitialized(thread)) {
                // Opcode is ready to execute! Rewrite to a 'fast' version,
                // and run the fast version.
                if (fieldInfo.nameAndTypeInfo.descriptor === 'J' || fieldInfo.nameAndTypeInfo.descriptor === 'D') {
                    code.writeUInt8(enums.OpCode.PUTSTATIC_FAST64, pc);
                }
                else {
                    code.writeUInt8(enums.OpCode.PUTSTATIC_FAST32, pc);
                }
                // Stash the result of field lookup.
                fieldInfo.fieldOwnerConstructor = fieldOwnerCls.getConstructor(thread);
            }
            else {
                // Initialize class and rerun opcode
                initializeClassFromClass(thread, frame, fieldOwnerCls);
            }
        }
        else {
            // Resolve the field.
            resolveCPItem(thread, frame, fieldInfo);
        }
    };
    /**
     * A fast version of putstatic that assumes that relevant classes are
     * initialized.
     *
     * Puts a 32-bit value.
     */
    Opcodes.putstatic_fast32 = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        fieldInfo.fieldOwnerConstructor[fieldInfo.fullFieldName] = frame.stack.pop();
        frame.pc += 3;
    };
    /**
     * A fast version of putstatic that assumes that relevant classes are
     * initialized.
     *
     * Puts a 64-bit value.
     */
    Opcodes.putstatic_fast64 = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        fieldInfo.fieldOwnerConstructor[fieldInfo.fullFieldName] = pop2(frame.stack);
        frame.pc += 3;
    };
    Opcodes.getfield = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), loader = frame.getLoader(), obj = frame.stack[frame.stack.length - 1];
        assert(fieldInfo.getType() === enums.ConstantPoolItemType.FIELDREF);
        // Check if the object is null; if we do not do this before get_class, then
        // we might try to get a class that we have not initialized!
        if (!isNull(thread, frame, obj)) {
            // cls is guaranteed to be in the inheritance hierarchy of obj, so it must be
            // initialized. However, it may not be loaded in the current class's
            // ClassLoader...
            if (fieldInfo.isResolved()) {
                var field = fieldInfo.field;
                if (field.rawDescriptor == 'J' || field.rawDescriptor == 'D') {
                    code.writeUInt8(enums.OpCode.GETFIELD_FAST64, pc);
                }
                else {
                    code.writeUInt8(enums.OpCode.GETFIELD_FAST32, pc);
                }
            }
            else {
                resolveCPItem(thread, frame, fieldInfo);
            }
        }
    };
    Opcodes.getfield_fast32 = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            stack.push(obj[fieldInfo.fullFieldName]);
            frame.pc += 3;
        }
    };
    Opcodes.getfield_fast64 = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            stack.push(obj[fieldInfo.fullFieldName], null);
            frame.pc += 3;
        }
    };
    Opcodes.putfield = function (thread, frame, code, pc) {
        var fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), loader = frame.getLoader(), isLong = fieldInfo.nameAndTypeInfo.descriptor == 'J' || fieldInfo.nameAndTypeInfo.descriptor == 'D', obj = frame.stack[frame.stack.length - (isLong ? 3 : 2)];
        assert(fieldInfo.getType() === enums.ConstantPoolItemType.FIELDREF);
        // Check if the object is null; if we do not do this before get_class, then
        // we might try to get a class that we have not initialized!
        if (!isNull(thread, frame, obj)) {
            // cls is guaranteed to be in the inheritance hierarchy of obj, so it must be
            // initialized. However, it may not be loaded in the current class's
            // ClassLoader...
            if (fieldInfo.isResolved()) {
                var field = fieldInfo.field;
                if (isLong) {
                    code.writeUInt8(enums.OpCode.PUTFIELD_FAST64, pc);
                }
                else {
                    code.writeUInt8(enums.OpCode.PUTFIELD_FAST32, pc);
                }
                // Stash the resolved full field name.
                fieldInfo.fullFieldName = util.descriptor2typestr(field.cls.getInternalName()) + "/" + fieldInfo.nameAndTypeInfo.name;
            }
            else {
                resolveCPItem(thread, frame, fieldInfo);
            }
        }
    };
    Opcodes.putfield_fast32 = function (thread, frame, code, pc) {
        var stack = frame.stack, val = stack.pop(), obj = stack.pop(), fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (!isNull(thread, frame, obj)) {
            obj[fieldInfo.fullFieldName] = val;
            frame.pc += 3;
        }
        // NPE has been thrown.
    };
    Opcodes.putfield_fast64 = function (thread, frame, code, pc) {
        var stack = frame.stack, val = pop2(stack), obj = stack.pop(), fieldInfo = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (!isNull(thread, frame, obj)) {
            obj[fieldInfo.fullFieldName] = val;
            frame.pc += 3;
        }
        // NPE has been thrown.
    };
    Opcodes.invokevirtual = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        // Ensure referenced class is loaded in the current classloader.
        // Even though we don't use this class for anything, and we know that it
        // must be loaded because it is in the object's inheritance hierarchy,
        // it needs to be present in the current classloader.
        if (methodReference.isResolved()) {
            var m = methodReference.method;
            if (m.isSignaturePolymorphic()) {
                switch (m.name) {
                    case 'invokeBasic':
                        code.writeUInt8(enums.OpCode.INVOKEBASIC, pc);
                        break;
                    case 'invoke':
                    case 'invokeExact':
                        code.writeUInt8(enums.OpCode.INVOKEHANDLE, pc);
                        break;
                    default:
                        throwException(thread, frame, 'Ljava/lang/AbstractMethodError;', "Invalid signature polymorphic method: " + m.cls.getExternalName() + "." + m.name);
                        break;
                }
            }
            else {
                code.writeUInt8(enums.OpCode.INVOKEVIRTUAL_FAST, pc);
            }
        }
        else {
            resolveCPItem(thread, frame, methodReference);
        }
    };
    Opcodes.invokeinterface = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (methodReference.isResolved()) {
            if (methodReference.method.cls.isInitialized(thread)) {
                // Rewrite to fast and rerun.
                code.writeUInt8(enums.OpCode.INVOKEINTERFACE_FAST, pc);
            }
            else {
                // Initialize our class and rerun opcode.
                // Note that the existance of an object of an interface type does *not*
                // mean that the interface is initialized!
                initializeClass(thread, frame, methodReference.classInfo);
            }
        }
        else {
            resolveCPItem(thread, frame, methodReference);
        }
    };
    Opcodes.invokedynamic = function (thread, frame, code, pc) {
        var callSiteSpecifier = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        thread.setStatus(enums.ThreadStatus.ASYNC_WAITING);
        callSiteSpecifier.constructCallSiteObject(thread, frame.getLoader(), frame.method.cls, pc, function (status) {
            if (status) {
                assert(typeof (callSiteSpecifier.getCallSiteObject(pc)[0].vmtarget) === 'function', "MethodName should be resolved...");
                code.writeUInt8(enums.OpCode.INVOKEDYNAMIC_FAST, pc);
                // Resume and rerun fast opcode.
                thread.setStatus(enums.ThreadStatus.RUNNABLE);
            }
        });
        frame.returnToThreadLoop = true;
    };
    /**
     * XXX: Actually perform superclass method lookup.
     */
    Opcodes.invokespecial = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (methodReference.isResolved()) {
            // Rewrite and rerun.
            code.writeUInt8(enums.OpCode.INVOKENONVIRTUAL_FAST, pc);
        }
        else {
            resolveCPItem(thread, frame, methodReference);
        }
    };
    Opcodes.invokestatic = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (methodReference.isResolved()) {
            var m = methodReference.method;
            if (m.cls.isInitialized(thread)) {
                var newOpcode = enums.OpCode.INVOKESTATIC_FAST;
                if (methodReference.method.isSignaturePolymorphic()) {
                    switch (methodReference.method.name) {
                        case 'linkToInterface':
                        case 'linkToVirtual':
                            newOpcode = enums.OpCode.LINKTOVIRTUAL;
                            break;
                        case 'linkToStatic':
                        case 'linkToSpecial':
                            newOpcode = enums.OpCode.LINKTOSPECIAL;
                            break;
                        default:
                            assert(false, "Should be impossible.");
                            break;
                    }
                }
                // Rewrite and rerun.
                code.writeUInt8(newOpcode, pc);
            }
            else {
                initializeClassFromClass(thread, frame, m.cls);
            }
        }
        else {
            resolveCPItem(thread, frame, methodReference);
        }
    };
    /// Fast invoke opcodes.
    Opcodes.invokenonvirtual_fast = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, paramSize = methodReference.paramWordSize, obj = stack[stack.length - paramSize - 1], args = stack.slice(stack.length - paramSize);
        if (!isNull(thread, frame, obj)) {
            stack.length -= paramSize + 1;
            assert(typeof obj[methodReference.fullSignature] === 'function', "Resolved method " + methodReference.fullSignature + " isn't defined?!", thread);
            obj[methodReference.fullSignature](thread, args);
            frame.returnToThreadLoop = true;
        }
    };
    Opcodes.invokestatic_fast = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, paramSize = methodReference.paramWordSize, args = stack.slice(stack.length - paramSize);
        stack.length -= paramSize;
        assert(methodReference.jsConstructor != null, "jsConstructor is missing?!");
        assert(typeof (methodReference.jsConstructor[methodReference.fullSignature]) === 'function', "Resolved method isn't defined?!");
        methodReference.jsConstructor[methodReference.fullSignature](thread, args);
        frame.returnToThreadLoop = true;
    };
    Opcodes.invokevirtual_fast = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), count = methodReference.getParamWordSize(), stack = frame.stack, obj = stack[stack.length - count - 1];
        if (!isNull(thread, frame, obj)) {
            // Use the class of the *object*.
            assert(typeof obj[methodReference.signature] === 'function', "Resolved method " + methodReference.signature + " isn't defined?!");
            obj[methodReference.signature](thread, stack.slice(stack.length - count));
            stack.length -= count + 1;
            frame.returnToThreadLoop = true;
        }
        // Object is NULL; NPE has been thrown.
    };
    Opcodes.invokedynamic_fast = function (thread, frame, code, pc) {
        var callSiteSpecifier = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), cso = callSiteSpecifier.getCallSiteObject(pc), appendix = cso[1], fcn = cso[0].vmtarget, stack = frame.stack, paramSize = callSiteSpecifier.paramWordSize, args = stack.slice(stack.length - paramSize);
        stack.length -= paramSize;
        if (appendix !== null) {
            args.push(appendix);
        }
        fcn(thread, null, args);
        frame.returnToThreadLoop = true;
    };
    /**
     * Opcode for MethodHandle.invoke and MethodHandle.invokeExact.
     */
    Opcodes.invokehandle = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, fcn = methodReference.memberName.vmtarget, 
        // Add in 1 for the method handle itself.
        paramSize = methodReference.paramWordSize + 1, appendix = methodReference.appendix, args = stack.slice(stack.length - paramSize);
        if (appendix !== null) {
            args.push(appendix);
        }
        if (!isNull(thread, frame, args[0])) {
            stack.length -= paramSize;
            // fcn will handle invoking 'this' and such.
            // TODO: If this can be varargs, pass in parameter types to the function.
            fcn(thread, null, args);
            frame.returnToThreadLoop = true;
        }
    };
    /**
     * Opcode for MethodHandle.invokeBasic.
     * Unlike invoke/invokeExact, invokeBasic does not call a generated bytecode
     * method. It calls the vmtarget embedded in the MethodHandler directly.
     * This can cause crashes with malformed calls, thus it is only accesssible
     * to trusted JDK code.
     */
    Opcodes.invokebasic = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), paramSize = methodReference.getParamWordSize(), stack = frame.stack, obj = stack[stack.length - paramSize - 1], 
        // Need to include the MethodHandle in the arguments to vmtarget. vmtarget
        // will appropriately invoke it.
        args = stack.slice(stack.length - paramSize - 1), lmbdaForm, mn, m;
        // obj is a MethodHandle.
        if (!isNull(thread, frame, obj)) {
            stack.length -= paramSize + 1;
            lmbdaForm = obj['java/lang/invoke/MethodHandle/form'];
            mn = lmbdaForm['java/lang/invoke/LambdaForm/vmentry'];
            assert(mn.vmtarget !== null && mn.vmtarget !== undefined, "vmtarget must be defined");
            mn.vmtarget(thread, methodReference.nameAndTypeInfo.descriptor, args);
            frame.returnToThreadLoop = true;
        }
    };
    /**
     * Also used for linkToStatic.
     * TODO: De-conflate the two.
     * TODO: Varargs functions.
     */
    Opcodes.linktospecial = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, paramSize = methodReference.paramWordSize, 
        // Final argument is the relevant MemberName. Function args are right
        // before it.
        args = stack.slice(stack.length - paramSize), memberName = args.pop(), 
        // TODO: Use parsed descriptor.
        desc = methodReference.nameAndTypeInfo.descriptor;
        if (!isNull(thread, frame, memberName)) {
            stack.length -= paramSize;
            assert(memberName.getClass().getInternalName() === "Ljava/lang/invoke/MemberName;");
            // parameterTypes for function are the same as the method reference, but without the trailing MemberName.
            // TODO: Use parsed descriptor, avoid re-doing work here.
            memberName.vmtarget(thread, desc.replace("Ljava/lang/invoke/MemberName;)", ")"), args);
            frame.returnToThreadLoop = true;
        }
    };
    // XXX: Varargs functions. We're supposed to box args if target is varargs.
    Opcodes.linktovirtual = function (thread, frame, code, pc) {
        var methodReference = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), paramSize = methodReference.paramWordSize, stack = frame.stack, args = stack.slice(stack.length - paramSize), 
        // Final argument is the relevant MemberName. Function args are right
        // before it.
        memberName = args.pop(), desc = methodReference.nameAndTypeInfo.descriptor;
        if (!isNull(thread, frame, memberName)) {
            stack.length -= paramSize;
            assert(memberName.getClass().getInternalName() === "Ljava/lang/invoke/MemberName;");
            // parameterTypes for function are the same as the method reference, but without the trailing MemberName.
            memberName.vmtarget(thread, desc.replace("Ljava/lang/invoke/MemberName;)", ")"), args);
            frame.returnToThreadLoop = true;
        }
    };
    Opcodes.breakpoint = function (thread, frame) {
        throwException(thread, frame, "Ljava/lang/Error;", "breakpoint not implemented.");
    };
    Opcodes.new = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (classRef.isResolved()) {
            var cls = classRef.cls;
            if (cls.isInitialized(thread)) {
                code.writeUInt8(enums.OpCode.NEW_FAST, pc);
            }
            else {
                initializeClassFromClass(thread, frame, cls);
            }
        }
        else {
            resolveCPItem(thread, frame, classRef);
        }
    };
    Opcodes.new_fast = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        frame.stack.push(new classRef.clsConstructor(thread));
        frame.pc += 3;
    };
    Opcodes.newarray = function (thread, frame, code, pc) {
        // TODO: Stash all of these array types during JVM startup.
        var stack = frame.stack, type = "[" + exports.ArrayTypes[code.readUInt8(pc + 1)], cls = frame.getLoader().getInitializedClass(thread, type), length = stack.pop();
        if (length >= 0) {
            stack.push(new (cls.getConstructor(thread))(thread, length));
            frame.pc += 2;
        }
        else {
            throwException(thread, frame, 'Ljava/lang/NegativeArraySizeException;', "Tried to init " + type + " array with length " + length);
        }
    };
    Opcodes.anewarray = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (classRef.isResolved()) {
            // Rewrite and rerun.
            code.writeUInt8(enums.OpCode.ANEWARRAY_FAST, pc);
            classRef.arrayClass = frame.getLoader().getInitializedClass(thread, "[" + classRef.cls.getInternalName());
            classRef.arrayClassConstructor = classRef.arrayClass.getConstructor(thread);
        }
        else {
            resolveCPItem(thread, frame, classRef);
        }
    };
    Opcodes.anewarray_fast = function (thread, frame, code, pc) {
        var stack = frame.stack, classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), length = stack.pop();
        if (length >= 0) {
            stack.push(new classRef.arrayClassConstructor(thread, length));
            frame.pc += 3;
        }
        else {
            throwException(thread, frame, 'Ljava/lang/NegativeArraySizeException;', "Tried to init " + classRef.arrayClass.getInternalName() + " array with length " + length);
        }
    };
    Opcodes.arraylength = function (thread, frame) {
        var stack = frame.stack, obj = stack.pop();
        if (!isNull(thread, frame, obj)) {
            stack.push(obj.array.length);
            frame.pc++;
        }
        // obj is NULL. isNull threw an exception for us.
    };
    Opcodes.athrow = function (thread, frame) {
        thread.throwException(frame.stack.pop());
        frame.returnToThreadLoop = true;
    };
    Opcodes.checkcast = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (classRef.isResolved()) {
            // Rewrite to fast version, and re-execute.
            code.writeUInt8(enums.OpCode.CHECKCAST_FAST, pc);
        }
        else {
            resolveCPItem(thread, frame, classRef);
        }
    };
    Opcodes.checkcast_fast = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), cls = classRef.cls, stack = frame.stack, o = stack[stack.length - 1];
        if ((o != null) && !o.getClass().isCastable(cls)) {
            var targetClass = cls.getExternalName();
            var candidateClass = o.getClass().getExternalName();
            throwException(thread, frame, 'Ljava/lang/ClassCastException;', candidateClass + " cannot be cast to " + targetClass);
        }
        else {
            // Success!
            frame.pc += 3;
        }
    };
    Opcodes.instanceof = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (classRef.isResolved()) {
            // Rewrite and rerun.
            code.writeUInt8(enums.OpCode.INSTANCEOF_FAST, pc);
        }
        else {
            // Fetch class and rerun opcode.
            resolveCPItem(thread, frame, classRef);
        }
    };
    Opcodes.instanceof_fast = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), cls = classRef.cls, stack = frame.stack, o = stack.pop();
        stack.push(o !== null ? (o.getClass().isCastable(cls) ? 1 : 0) : 0);
        frame.pc += 3;
    };
    Opcodes.monitorenter = function (thread, frame) {
        var stack = frame.stack, monitorObj = stack.pop(), monitorEntered = function () {
            // [Note: Thread is now in the RUNNABLE state.]
            // Increment the PC.
            frame.pc++;
        };
        if (!monitorObj.getMonitor().enter(thread, monitorEntered)) {
            // Opcode failed. monitorEntered will be run once we own the monitor.
            // The thread is now in the BLOCKED state. Tell the frame to return to
            // the thread loop.
            frame.returnToThreadLoop = true;
        }
        else {
            monitorEntered();
        }
    };
    Opcodes.monitorexit = function (thread, frame) {
        var monitorObj = frame.stack.pop();
        if (monitorObj.getMonitor().exit(thread)) {
            frame.pc++;
        }
        else {
            // monitorexit failed, and threw an exception.
            frame.returnToThreadLoop = true;
        }
    };
    Opcodes.multianewarray = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (classRef.isResolved()) {
            // Rewrite and rerun.
            code.writeUInt8(enums.OpCode.MULTIANEWARRAY_FAST, pc);
        }
        else {
            resolveCPItem(thread, frame, classRef);
        }
    };
    Opcodes.multianewarray_fast = function (thread, frame, code, pc) {
        var classRef = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1)), stack = frame.stack, dim = code.readUInt8(pc + 3), i, 
        // Arguments to the constructor.
        args = new Array(dim), dimSize;
        for (i = 0; i < dim; i++) {
            dimSize = stack.pop();
            args[dim - i - 1] = dimSize;
            if (dimSize < 0) {
                throwException(thread, frame, 'Ljava/lang/NegativeArraySizeException;', "Tried to init " + classRef.cls.getInternalName() + " array with a dimension of length " + dimSize);
                return;
            }
        }
        stack.push(new (classRef.cls.getConstructor(thread))(thread, args));
        frame.pc += 4;
    };
    Opcodes.ifnull = function (thread, frame, code, pc) {
        if (frame.stack.pop() == null) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.ifnonnull = function (thread, frame, code, pc) {
        if (frame.stack.pop() != null) {
            frame.pc += code.readInt16BE(pc + 1);
        }
        else {
            frame.pc += 3;
        }
    };
    Opcodes.goto_w = function (thread, frame, code, pc) {
        frame.pc += code.readInt32BE(pc + 1);
    };
    Opcodes.jsr_w = function (thread, frame, code, pc) {
        frame.stack.push(frame.pc + 5);
        frame.pc += code.readInt32BE(pc + 1);
    };
    Opcodes.nop = function (thread, frame) {
        frame.pc += 1;
    };
    Opcodes.ldc = function (thread, frame, code, pc) {
        var constant = frame.method.cls.constantPool.get(code.readUInt8(pc + 1));
        if (constant.isResolved()) {
            assert((function () {
                switch (constant.getType()) {
                    case enums.ConstantPoolItemType.STRING:
                    case enums.ConstantPoolItemType.CLASS:
                    case enums.ConstantPoolItemType.METHOD_HANDLE:
                    case enums.ConstantPoolItemType.METHOD_TYPE:
                    case enums.ConstantPoolItemType.INTEGER:
                    case enums.ConstantPoolItemType.FLOAT:
                        return true;
                    default:
                        return false;
                }
            })(), "Constant pool item " + enums.ConstantPoolItemType[constant.getType()] + " is not appropriate for LDC.");
            frame.stack.push(constant.getConstant(thread));
            frame.pc += 2;
        }
        else {
            resolveCPItem(thread, frame, constant);
        }
    };
    Opcodes.ldc_w = function (thread, frame, code, pc) {
        var constant = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        if (constant.isResolved()) {
            assert((function () {
                switch (constant.getType()) {
                    case enums.ConstantPoolItemType.STRING:
                    case enums.ConstantPoolItemType.CLASS:
                    case enums.ConstantPoolItemType.METHOD_HANDLE:
                    case enums.ConstantPoolItemType.METHOD_TYPE:
                    case enums.ConstantPoolItemType.INTEGER:
                    case enums.ConstantPoolItemType.FLOAT:
                        return true;
                    default:
                        return false;
                }
            })(), "Constant pool item " + enums.ConstantPoolItemType[constant.getType()] + " is not appropriate for LDC_W.");
            frame.stack.push(constant.getConstant(thread));
            frame.pc += 3;
        }
        else {
            resolveCPItem(thread, frame, constant);
        }
    };
    Opcodes.ldc2_w = function (thread, frame, code, pc) {
        var constant = frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1));
        assert(constant.getType() === enums.ConstantPoolItemType.LONG
            || constant.getType() === enums.ConstantPoolItemType.DOUBLE, "Invalid ldc_w constant pool type: " + enums.ConstantPoolItemType[constant.getType()]);
        frame.stack.push(constant.value, null);
        frame.pc += 3;
    };
    Opcodes.wide = function (thread, frame, code, pc) {
        var index = code.readUInt16BE(pc + 2);
        // Increment PC before switch to avoid issue where ret chances PC and we
        // erroneously increment the PC further.
        frame.pc += 4;
        switch (code.readUInt8(pc + 1)) {
            case enums.OpCode.ILOAD:
            case enums.OpCode.FLOAD:
            case enums.OpCode.ALOAD:
                frame.stack.push(frame.locals[index]);
                break;
            case enums.OpCode.LLOAD:
            case enums.OpCode.DLOAD:
                frame.stack.push(frame.locals[index], null);
                break;
            case enums.OpCode.ISTORE:
            case enums.OpCode.FSTORE:
            case enums.OpCode.ASTORE:
                frame.locals[index] = frame.stack.pop();
                break;
            case enums.OpCode.LSTORE:
            case enums.OpCode.DSTORE:
                // NULL
                frame.locals[index + 1] = frame.stack.pop();
                // The actual value.
                frame.locals[index] = frame.stack.pop();
                break;
            case enums.OpCode.RET:
                frame.pc = frame.locals[index];
                break;
            case enums.OpCode.IINC:
                var value = code.readInt16BE(pc + 4);
                frame.locals[index] = (frame.locals[index] + value) | 0;
                // wide iinc has 2 extra bytes.
                frame.pc += 2;
                break;
            default:
                assert(false, "Unknown wide opcode: " + code.readUInt8(pc + 1));
                break;
        }
    };
    Opcodes.iaload = Opcodes._aload_32;
    Opcodes.faload = Opcodes._aload_32;
    Opcodes.aaload = Opcodes._aload_32;
    Opcodes.baload = Opcodes._aload_32;
    Opcodes.caload = Opcodes._aload_32;
    Opcodes.saload = Opcodes._aload_32;
    Opcodes.daload = Opcodes._aload_64;
    Opcodes.laload = Opcodes._aload_64;
    Opcodes.iastore = Opcodes._astore_32;
    Opcodes.fastore = Opcodes._astore_32;
    Opcodes.aastore = Opcodes._astore_32;
    Opcodes.bastore = Opcodes._astore_32;
    Opcodes.castore = Opcodes._astore_32;
    Opcodes.sastore = Opcodes._astore_32;
    Opcodes.lastore = Opcodes._astore_64;
    Opcodes.dastore = Opcodes._astore_64;
    Opcodes.iconst_0 = Opcodes._const_0_32;
    Opcodes.iconst_1 = Opcodes._const_1_32;
    Opcodes.iconst_2 = Opcodes._const_2_32;
    Opcodes.fconst_0 = Opcodes._const_0_32;
    Opcodes.fconst_1 = Opcodes._const_1_32;
    Opcodes.fconst_2 = Opcodes._const_2_32;
    Opcodes.iload = Opcodes._load_32;
    Opcodes.iload_0 = Opcodes._load_0_32;
    Opcodes.iload_1 = Opcodes._load_1_32;
    Opcodes.iload_2 = Opcodes._load_2_32;
    Opcodes.iload_3 = Opcodes._load_3_32;
    Opcodes.fload = Opcodes._load_32;
    Opcodes.fload_0 = Opcodes._load_0_32;
    Opcodes.fload_1 = Opcodes._load_1_32;
    Opcodes.fload_2 = Opcodes._load_2_32;
    Opcodes.fload_3 = Opcodes._load_3_32;
    Opcodes.aload = Opcodes._load_32;
    Opcodes.aload_0 = Opcodes._load_0_32;
    Opcodes.aload_1 = Opcodes._load_1_32;
    Opcodes.aload_2 = Opcodes._load_2_32;
    Opcodes.aload_3 = Opcodes._load_3_32;
    Opcodes.lload = Opcodes._load_64;
    Opcodes.lload_0 = Opcodes._load_0_64;
    Opcodes.lload_1 = Opcodes._load_1_64;
    Opcodes.lload_2 = Opcodes._load_2_64;
    Opcodes.lload_3 = Opcodes._load_3_64;
    Opcodes.dload = Opcodes._load_64;
    Opcodes.dload_0 = Opcodes._load_0_64;
    Opcodes.dload_1 = Opcodes._load_1_64;
    Opcodes.dload_2 = Opcodes._load_2_64;
    Opcodes.dload_3 = Opcodes._load_3_64;
    Opcodes.istore = Opcodes._store_32;
    Opcodes.istore_0 = Opcodes._store_0_32;
    Opcodes.istore_1 = Opcodes._store_1_32;
    Opcodes.istore_2 = Opcodes._store_2_32;
    Opcodes.istore_3 = Opcodes._store_3_32;
    Opcodes.fstore = Opcodes._store_32;
    Opcodes.fstore_0 = Opcodes._store_0_32;
    Opcodes.fstore_1 = Opcodes._store_1_32;
    Opcodes.fstore_2 = Opcodes._store_2_32;
    Opcodes.fstore_3 = Opcodes._store_3_32;
    Opcodes.astore = Opcodes._store_32;
    Opcodes.astore_0 = Opcodes._store_0_32;
    Opcodes.astore_1 = Opcodes._store_1_32;
    Opcodes.astore_2 = Opcodes._store_2_32;
    Opcodes.astore_3 = Opcodes._store_3_32;
    Opcodes.lstore = Opcodes._store_64;
    Opcodes.lstore_0 = Opcodes._store_0_64;
    Opcodes.lstore_1 = Opcodes._store_1_64;
    Opcodes.lstore_2 = Opcodes._store_2_64;
    Opcodes.lstore_3 = Opcodes._store_3_64;
    Opcodes.dstore = Opcodes._store_64;
    Opcodes.dstore_0 = Opcodes._store_0_64;
    Opcodes.dstore_1 = Opcodes._store_1_64;
    Opcodes.dstore_2 = Opcodes._store_2_64;
    Opcodes.dstore_3 = Opcodes._store_3_64;
    Opcodes.ireturn = Opcodes._return_32;
    Opcodes.freturn = Opcodes._return_32;
    Opcodes.areturn = Opcodes._return_32;
    Opcodes.lreturn = Opcodes._return_64;
    Opcodes.dreturn = Opcodes._return_64;
    Opcodes.invokeinterface_fast = Opcodes.invokevirtual_fast;
    return Opcodes;
})();
exports.Opcodes = Opcodes;
exports.LookupTable = new Array(0xff);
// Put in function closure to prevent scope pollution.
(function () {
    for (var i = 0; i < 0xff; i++) {
        if (enums.OpCode.hasOwnProperty("" + i)) {
            exports.LookupTable[i] = Opcodes[enums.OpCode[i].toLowerCase()];
            assert(exports.LookupTable[i] != null, "Missing implementation of opcode " + enums.OpCode[i]);
        }
    }
})();
