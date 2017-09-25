"use strict";
/**
 * A class can be in one of these states at any given point in time.
 */
(function (ClassState) {
    // The class has yet to be loaded.
    ClassState[ClassState["NOT_LOADED"] = 0] = "NOT_LOADED";
    // The class's definition has been downloaded and parsed.
    ClassState[ClassState["LOADED"] = 1] = "LOADED";
    // This class and its super classes' definitions have been downloaded and
    // parsed.
    ClassState[ClassState["RESOLVED"] = 2] = "RESOLVED";
    // This class, its super classes', and its interfaces have been downloaded,
    // parsed, and statically initialized.
    ClassState[ClassState["INITIALIZED"] = 3] = "INITIALIZED";
})(exports.ClassState || (exports.ClassState = {}));
var ClassState = exports.ClassState;
/**
 * A thread can be in one of these states at any given point in time.
 *
 * NOTE: When altering ThreadStatus, remember to update the following things.
 *
 * - Thread.validTransitions: Describes each valid thread transition.
 * - sun.misc.VM.getThreadStateValues: Maps ThreadStatus values to Thread.State
 *   values.
 * - Assertion statements in Thread regarding its status.
 */
(function (ThreadStatus) {
    // A thread that has not yet started is in this state.
    ThreadStatus[ThreadStatus["NEW"] = 0] = "NEW";
    // A thread that is able to be run. The thread may actually be running.
    // Query the ThreadPool to determine if this is the case.
    ThreadStatus[ThreadStatus["RUNNABLE"] = 1] = "RUNNABLE";
    // A thread that is blocked waiting for a monitor lock is in this state.
    ThreadStatus[ThreadStatus["BLOCKED"] = 2] = "BLOCKED";
    // A thread that is blocked waiting for a monitor lock that was previously
    // interrupted from waiting on a monitor is in this state.
    // Why? Well, the thread has *already* been interrupted once, but cannot
    // process the interruption until it regains the lock.
    ThreadStatus[ThreadStatus["UNINTERRUPTABLY_BLOCKED"] = 3] = "UNINTERRUPTABLY_BLOCKED";
    // A thread that is waiting indefinitely for another thread to perform a
    // particular action is in this state.
    ThreadStatus[ThreadStatus["WAITING"] = 4] = "WAITING";
    // A thread that is waiting for another thread to perform an action for up to
    // a specified waiting time is in this state.
    ThreadStatus[ThreadStatus["TIMED_WAITING"] = 5] = "TIMED_WAITING";
    // A thread that is waiting for an asynchronous browser operation to complete.
    ThreadStatus[ThreadStatus["ASYNC_WAITING"] = 6] = "ASYNC_WAITING";
    // A thread that is parked.
    ThreadStatus[ThreadStatus["PARKED"] = 7] = "PARKED";
    // A thread that has exited is in this state.
    ThreadStatus[ThreadStatus["TERMINATED"] = 8] = "TERMINATED";
})(exports.ThreadStatus || (exports.ThreadStatus = {}));
var ThreadStatus = exports.ThreadStatus;
/**
 * Java-visible thread state values.
 */
(function (JVMTIThreadState) {
    JVMTIThreadState[JVMTIThreadState["ALIVE"] = 1] = "ALIVE";
    JVMTIThreadState[JVMTIThreadState["TERMINATED"] = 2] = "TERMINATED";
    JVMTIThreadState[JVMTIThreadState["RUNNABLE"] = 4] = "RUNNABLE";
    JVMTIThreadState[JVMTIThreadState["BLOCKED_ON_MONITOR_ENTER"] = 1024] = "BLOCKED_ON_MONITOR_ENTER";
    JVMTIThreadState[JVMTIThreadState["WAITING_INDEFINITELY"] = 16] = "WAITING_INDEFINITELY";
    JVMTIThreadState[JVMTIThreadState["WAITING_WITH_TIMEOUT"] = 32] = "WAITING_WITH_TIMEOUT";
})(exports.JVMTIThreadState || (exports.JVMTIThreadState = {}));
var JVMTIThreadState = exports.JVMTIThreadState;
/**
 * Three-state boolean.
 */
(function (TriState) {
    TriState[TriState["TRUE"] = 0] = "TRUE";
    TriState[TriState["FALSE"] = 1] = "FALSE";
    TriState[TriState["INDETERMINATE"] = 2] = "INDETERMINATE";
})(exports.TriState || (exports.TriState = {}));
var TriState = exports.TriState;
/**
 * The current status of the JVM.
 */
(function (JVMStatus) {
    // The JVM is booting up.
    JVMStatus[JVMStatus["BOOTING"] = 0] = "BOOTING";
    // The JVM is booted, and waiting for a class to run.
    JVMStatus[JVMStatus["BOOTED"] = 1] = "BOOTED";
    // The JVM is running.
    JVMStatus[JVMStatus["RUNNING"] = 2] = "RUNNING";
    // The JVM has completed running, and is performing termination steps.
    JVMStatus[JVMStatus["TERMINATING"] = 3] = "TERMINATING";
    // The JVM is completely finished executing.
    JVMStatus[JVMStatus["TERMINATED"] = 4] = "TERMINATED";
})(exports.JVMStatus || (exports.JVMStatus = {}));
var JVMStatus = exports.JVMStatus;
/**
 * Indicates the type of a stack frame.
 */
(function (StackFrameType) {
    /**
     * A JVM internal stack frame. These should be completely invisible to the
     * JVM program.
     */
    StackFrameType[StackFrameType["INTERNAL"] = 0] = "INTERNAL";
    /**
     * A bytecode method's stack frame. These have an actual stack.
     */
    StackFrameType[StackFrameType["BYTECODE"] = 1] = "BYTECODE";
    /**
     * A native method's stack frame. These typically consist of just a JavaScript
     * function and a method association.
     */
    StackFrameType[StackFrameType["NATIVE"] = 2] = "NATIVE";
})(exports.StackFrameType || (exports.StackFrameType = {}));
var StackFrameType = exports.StackFrameType;
/**
 * Various constant values. Enum'd so they are inlined by the TypeScript
 * compiler.
 */
(function (Constants) {
    Constants[Constants["INT_MAX"] = Math.pow(2, 31) - 1] = "INT_MAX";
    Constants[Constants["INT_MIN"] = -Constants.INT_MAX - 1] = "INT_MIN";
    Constants[Constants["FLOAT_POS_INFINITY"] = Math.pow(2, 128)] = "FLOAT_POS_INFINITY";
    Constants[Constants["FLOAT_NEG_INFINITY"] = -1 * Constants.FLOAT_POS_INFINITY] = "FLOAT_NEG_INFINITY";
    Constants[Constants["FLOAT_POS_INFINITY_AS_INT"] = 2139095040] = "FLOAT_POS_INFINITY_AS_INT";
    Constants[Constants["FLOAT_NEG_INFINITY_AS_INT"] = -8388608] = "FLOAT_NEG_INFINITY_AS_INT";
    // We use the JavaScript NaN as our NaN value, and convert it to
    // a NaN value in the SNaN range when an int equivalent is requested.
    Constants[Constants["FLOAT_NaN_AS_INT"] = 2143289344] = "FLOAT_NaN_AS_INT";
})(exports.Constants || (exports.Constants = {}));
var Constants = exports.Constants;
/**
 * Integer indicating the type of a constant pool item.
 * @url https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.4-140
 */
(function (ConstantPoolItemType) {
    ConstantPoolItemType[ConstantPoolItemType["CLASS"] = 7] = "CLASS";
    ConstantPoolItemType[ConstantPoolItemType["FIELDREF"] = 9] = "FIELDREF";
    ConstantPoolItemType[ConstantPoolItemType["METHODREF"] = 10] = "METHODREF";
    ConstantPoolItemType[ConstantPoolItemType["INTERFACE_METHODREF"] = 11] = "INTERFACE_METHODREF";
    ConstantPoolItemType[ConstantPoolItemType["STRING"] = 8] = "STRING";
    ConstantPoolItemType[ConstantPoolItemType["INTEGER"] = 3] = "INTEGER";
    ConstantPoolItemType[ConstantPoolItemType["FLOAT"] = 4] = "FLOAT";
    ConstantPoolItemType[ConstantPoolItemType["LONG"] = 5] = "LONG";
    ConstantPoolItemType[ConstantPoolItemType["DOUBLE"] = 6] = "DOUBLE";
    ConstantPoolItemType[ConstantPoolItemType["NAME_AND_TYPE"] = 12] = "NAME_AND_TYPE";
    ConstantPoolItemType[ConstantPoolItemType["UTF8"] = 1] = "UTF8";
    ConstantPoolItemType[ConstantPoolItemType["METHOD_HANDLE"] = 15] = "METHOD_HANDLE";
    ConstantPoolItemType[ConstantPoolItemType["METHOD_TYPE"] = 16] = "METHOD_TYPE";
    ConstantPoolItemType[ConstantPoolItemType["INVOKE_DYNAMIC"] = 18] = "INVOKE_DYNAMIC";
})(exports.ConstantPoolItemType || (exports.ConstantPoolItemType = {}));
var ConstantPoolItemType = exports.ConstantPoolItemType;
/**
 * Integer indicating the type of a StackMapTable entry.
 * @see https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.7.4
 */
(function (StackMapTableEntryType) {
    StackMapTableEntryType[StackMapTableEntryType["SAME_FRAME"] = 0] = "SAME_FRAME";
    StackMapTableEntryType[StackMapTableEntryType["SAME_LOCALS_1_STACK_ITEM_FRAME"] = 1] = "SAME_LOCALS_1_STACK_ITEM_FRAME";
    StackMapTableEntryType[StackMapTableEntryType["SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED"] = 2] = "SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED";
    StackMapTableEntryType[StackMapTableEntryType["CHOP_FRAME"] = 3] = "CHOP_FRAME";
    StackMapTableEntryType[StackMapTableEntryType["SAME_FRAME_EXTENDED"] = 4] = "SAME_FRAME_EXTENDED";
    StackMapTableEntryType[StackMapTableEntryType["APPEND_FRAME"] = 5] = "APPEND_FRAME";
    StackMapTableEntryType[StackMapTableEntryType["FULL_FRAME"] = 6] = "FULL_FRAME";
})(exports.StackMapTableEntryType || (exports.StackMapTableEntryType = {}));
var StackMapTableEntryType = exports.StackMapTableEntryType;
/**
 * Integer indicating the reference type of a MethodHandle item in the constant
 * pool.
 * @see https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.4.8
 */
(function (MethodHandleReferenceKind) {
    MethodHandleReferenceKind[MethodHandleReferenceKind["GETFIELD"] = 1] = "GETFIELD";
    MethodHandleReferenceKind[MethodHandleReferenceKind["GETSTATIC"] = 2] = "GETSTATIC";
    MethodHandleReferenceKind[MethodHandleReferenceKind["PUTFIELD"] = 3] = "PUTFIELD";
    MethodHandleReferenceKind[MethodHandleReferenceKind["PUTSTATIC"] = 4] = "PUTSTATIC";
    MethodHandleReferenceKind[MethodHandleReferenceKind["INVOKEVIRTUAL"] = 5] = "INVOKEVIRTUAL";
    MethodHandleReferenceKind[MethodHandleReferenceKind["INVOKESTATIC"] = 6] = "INVOKESTATIC";
    MethodHandleReferenceKind[MethodHandleReferenceKind["INVOKESPECIAL"] = 7] = "INVOKESPECIAL";
    MethodHandleReferenceKind[MethodHandleReferenceKind["NEWINVOKESPECIAL"] = 8] = "NEWINVOKESPECIAL";
    MethodHandleReferenceKind[MethodHandleReferenceKind["INVOKEINTERFACE"] = 9] = "INVOKEINTERFACE";
})(exports.MethodHandleReferenceKind || (exports.MethodHandleReferenceKind = {}));
var MethodHandleReferenceKind = exports.MethodHandleReferenceKind;
/**
 * JVM op codes. The enum value corresponds to that opcode's value.
 */
(function (OpCode) {
    OpCode[OpCode["AALOAD"] = 50] = "AALOAD";
    OpCode[OpCode["AASTORE"] = 83] = "AASTORE";
    OpCode[OpCode["ACONST_NULL"] = 1] = "ACONST_NULL";
    OpCode[OpCode["ALOAD"] = 25] = "ALOAD";
    OpCode[OpCode["ALOAD_0"] = 42] = "ALOAD_0";
    OpCode[OpCode["ALOAD_1"] = 43] = "ALOAD_1";
    OpCode[OpCode["ALOAD_2"] = 44] = "ALOAD_2";
    OpCode[OpCode["ALOAD_3"] = 45] = "ALOAD_3";
    OpCode[OpCode["ANEWARRAY"] = 189] = "ANEWARRAY";
    OpCode[OpCode["ARETURN"] = 176] = "ARETURN";
    OpCode[OpCode["ARRAYLENGTH"] = 190] = "ARRAYLENGTH";
    OpCode[OpCode["ASTORE"] = 58] = "ASTORE";
    OpCode[OpCode["ASTORE_0"] = 75] = "ASTORE_0";
    OpCode[OpCode["ASTORE_1"] = 76] = "ASTORE_1";
    OpCode[OpCode["ASTORE_2"] = 77] = "ASTORE_2";
    OpCode[OpCode["ASTORE_3"] = 78] = "ASTORE_3";
    OpCode[OpCode["ATHROW"] = 191] = "ATHROW";
    OpCode[OpCode["BALOAD"] = 51] = "BALOAD";
    OpCode[OpCode["BASTORE"] = 84] = "BASTORE";
    OpCode[OpCode["BIPUSH"] = 16] = "BIPUSH";
    OpCode[OpCode["BREAKPOINT"] = 202] = "BREAKPOINT";
    OpCode[OpCode["CALOAD"] = 52] = "CALOAD";
    OpCode[OpCode["CASTORE"] = 85] = "CASTORE";
    OpCode[OpCode["CHECKCAST"] = 192] = "CHECKCAST";
    OpCode[OpCode["D2F"] = 144] = "D2F";
    OpCode[OpCode["D2I"] = 142] = "D2I";
    OpCode[OpCode["D2L"] = 143] = "D2L";
    OpCode[OpCode["DADD"] = 99] = "DADD";
    OpCode[OpCode["DALOAD"] = 49] = "DALOAD";
    OpCode[OpCode["DASTORE"] = 82] = "DASTORE";
    OpCode[OpCode["DCMPG"] = 152] = "DCMPG";
    OpCode[OpCode["DCMPL"] = 151] = "DCMPL";
    OpCode[OpCode["DCONST_0"] = 14] = "DCONST_0";
    OpCode[OpCode["DCONST_1"] = 15] = "DCONST_1";
    OpCode[OpCode["DDIV"] = 111] = "DDIV";
    OpCode[OpCode["DLOAD"] = 24] = "DLOAD";
    OpCode[OpCode["DLOAD_0"] = 38] = "DLOAD_0";
    OpCode[OpCode["DLOAD_1"] = 39] = "DLOAD_1";
    OpCode[OpCode["DLOAD_2"] = 40] = "DLOAD_2";
    OpCode[OpCode["DLOAD_3"] = 41] = "DLOAD_3";
    OpCode[OpCode["DMUL"] = 107] = "DMUL";
    OpCode[OpCode["DNEG"] = 119] = "DNEG";
    OpCode[OpCode["DREM"] = 115] = "DREM";
    OpCode[OpCode["DRETURN"] = 175] = "DRETURN";
    OpCode[OpCode["DSTORE"] = 57] = "DSTORE";
    OpCode[OpCode["DSTORE_0"] = 71] = "DSTORE_0";
    OpCode[OpCode["DSTORE_1"] = 72] = "DSTORE_1";
    OpCode[OpCode["DSTORE_2"] = 73] = "DSTORE_2";
    OpCode[OpCode["DSTORE_3"] = 74] = "DSTORE_3";
    OpCode[OpCode["DSUB"] = 103] = "DSUB";
    OpCode[OpCode["DUP"] = 89] = "DUP";
    OpCode[OpCode["DUP_X1"] = 90] = "DUP_X1";
    OpCode[OpCode["DUP_X2"] = 91] = "DUP_X2";
    OpCode[OpCode["DUP2"] = 92] = "DUP2";
    OpCode[OpCode["DUP2_X1"] = 93] = "DUP2_X1";
    OpCode[OpCode["DUP2_X2"] = 94] = "DUP2_X2";
    OpCode[OpCode["F2D"] = 141] = "F2D";
    OpCode[OpCode["F2I"] = 139] = "F2I";
    OpCode[OpCode["F2L"] = 140] = "F2L";
    OpCode[OpCode["FADD"] = 98] = "FADD";
    OpCode[OpCode["FALOAD"] = 48] = "FALOAD";
    OpCode[OpCode["FASTORE"] = 81] = "FASTORE";
    OpCode[OpCode["FCMPG"] = 150] = "FCMPG";
    OpCode[OpCode["FCMPL"] = 149] = "FCMPL";
    OpCode[OpCode["FCONST_0"] = 11] = "FCONST_0";
    OpCode[OpCode["FCONST_1"] = 12] = "FCONST_1";
    OpCode[OpCode["FCONST_2"] = 13] = "FCONST_2";
    OpCode[OpCode["FDIV"] = 110] = "FDIV";
    OpCode[OpCode["FLOAD"] = 23] = "FLOAD";
    OpCode[OpCode["FLOAD_0"] = 34] = "FLOAD_0";
    OpCode[OpCode["FLOAD_1"] = 35] = "FLOAD_1";
    OpCode[OpCode["FLOAD_2"] = 36] = "FLOAD_2";
    OpCode[OpCode["FLOAD_3"] = 37] = "FLOAD_3";
    OpCode[OpCode["FMUL"] = 106] = "FMUL";
    OpCode[OpCode["FNEG"] = 118] = "FNEG";
    OpCode[OpCode["FREM"] = 114] = "FREM";
    OpCode[OpCode["FRETURN"] = 174] = "FRETURN";
    OpCode[OpCode["FSTORE"] = 56] = "FSTORE";
    OpCode[OpCode["FSTORE_0"] = 67] = "FSTORE_0";
    OpCode[OpCode["FSTORE_1"] = 68] = "FSTORE_1";
    OpCode[OpCode["FSTORE_2"] = 69] = "FSTORE_2";
    OpCode[OpCode["FSTORE_3"] = 70] = "FSTORE_3";
    OpCode[OpCode["FSUB"] = 102] = "FSUB";
    OpCode[OpCode["GETFIELD"] = 180] = "GETFIELD";
    OpCode[OpCode["GETSTATIC"] = 178] = "GETSTATIC";
    OpCode[OpCode["GOTO"] = 167] = "GOTO";
    OpCode[OpCode["GOTO_W"] = 200] = "GOTO_W";
    OpCode[OpCode["I2B"] = 145] = "I2B";
    OpCode[OpCode["I2C"] = 146] = "I2C";
    OpCode[OpCode["I2D"] = 135] = "I2D";
    OpCode[OpCode["I2F"] = 134] = "I2F";
    OpCode[OpCode["I2L"] = 133] = "I2L";
    OpCode[OpCode["I2S"] = 147] = "I2S";
    OpCode[OpCode["IADD"] = 96] = "IADD";
    OpCode[OpCode["IALOAD"] = 46] = "IALOAD";
    OpCode[OpCode["IAND"] = 126] = "IAND";
    OpCode[OpCode["IASTORE"] = 79] = "IASTORE";
    OpCode[OpCode["ICONST_M1"] = 2] = "ICONST_M1";
    OpCode[OpCode["ICONST_0"] = 3] = "ICONST_0";
    OpCode[OpCode["ICONST_1"] = 4] = "ICONST_1";
    OpCode[OpCode["ICONST_2"] = 5] = "ICONST_2";
    OpCode[OpCode["ICONST_3"] = 6] = "ICONST_3";
    OpCode[OpCode["ICONST_4"] = 7] = "ICONST_4";
    OpCode[OpCode["ICONST_5"] = 8] = "ICONST_5";
    OpCode[OpCode["IDIV"] = 108] = "IDIV";
    OpCode[OpCode["IF_ACMPEQ"] = 165] = "IF_ACMPEQ";
    OpCode[OpCode["IF_ACMPNE"] = 166] = "IF_ACMPNE";
    OpCode[OpCode["IF_ICMPEQ"] = 159] = "IF_ICMPEQ";
    OpCode[OpCode["IF_ICMPGE"] = 162] = "IF_ICMPGE";
    OpCode[OpCode["IF_ICMPGT"] = 163] = "IF_ICMPGT";
    OpCode[OpCode["IF_ICMPLE"] = 164] = "IF_ICMPLE";
    OpCode[OpCode["IF_ICMPLT"] = 161] = "IF_ICMPLT";
    OpCode[OpCode["IF_ICMPNE"] = 160] = "IF_ICMPNE";
    OpCode[OpCode["IFEQ"] = 153] = "IFEQ";
    OpCode[OpCode["IFGE"] = 156] = "IFGE";
    OpCode[OpCode["IFGT"] = 157] = "IFGT";
    OpCode[OpCode["IFLE"] = 158] = "IFLE";
    OpCode[OpCode["IFLT"] = 155] = "IFLT";
    OpCode[OpCode["IFNE"] = 154] = "IFNE";
    OpCode[OpCode["IFNONNULL"] = 199] = "IFNONNULL";
    OpCode[OpCode["IFNULL"] = 198] = "IFNULL";
    OpCode[OpCode["IINC"] = 132] = "IINC";
    OpCode[OpCode["ILOAD"] = 21] = "ILOAD";
    OpCode[OpCode["ILOAD_0"] = 26] = "ILOAD_0";
    OpCode[OpCode["ILOAD_1"] = 27] = "ILOAD_1";
    OpCode[OpCode["ILOAD_2"] = 28] = "ILOAD_2";
    OpCode[OpCode["ILOAD_3"] = 29] = "ILOAD_3";
    // IMPDEP1 = 0xfe,
    // IMPDEP2 = 0xff,
    OpCode[OpCode["IMUL"] = 104] = "IMUL";
    OpCode[OpCode["INEG"] = 116] = "INEG";
    OpCode[OpCode["INSTANCEOF"] = 193] = "INSTANCEOF";
    OpCode[OpCode["INVOKEDYNAMIC"] = 186] = "INVOKEDYNAMIC";
    OpCode[OpCode["INVOKEINTERFACE"] = 185] = "INVOKEINTERFACE";
    OpCode[OpCode["INVOKESPECIAL"] = 183] = "INVOKESPECIAL";
    OpCode[OpCode["INVOKESTATIC"] = 184] = "INVOKESTATIC";
    OpCode[OpCode["INVOKEVIRTUAL"] = 182] = "INVOKEVIRTUAL";
    OpCode[OpCode["IOR"] = 128] = "IOR";
    OpCode[OpCode["IREM"] = 112] = "IREM";
    OpCode[OpCode["IRETURN"] = 172] = "IRETURN";
    OpCode[OpCode["ISHL"] = 120] = "ISHL";
    OpCode[OpCode["ISHR"] = 122] = "ISHR";
    OpCode[OpCode["ISTORE"] = 54] = "ISTORE";
    OpCode[OpCode["ISTORE_0"] = 59] = "ISTORE_0";
    OpCode[OpCode["ISTORE_1"] = 60] = "ISTORE_1";
    OpCode[OpCode["ISTORE_2"] = 61] = "ISTORE_2";
    OpCode[OpCode["ISTORE_3"] = 62] = "ISTORE_3";
    OpCode[OpCode["ISUB"] = 100] = "ISUB";
    OpCode[OpCode["IUSHR"] = 124] = "IUSHR";
    OpCode[OpCode["IXOR"] = 130] = "IXOR";
    OpCode[OpCode["JSR"] = 168] = "JSR";
    OpCode[OpCode["JSR_W"] = 201] = "JSR_W";
    OpCode[OpCode["L2D"] = 138] = "L2D";
    OpCode[OpCode["L2F"] = 137] = "L2F";
    OpCode[OpCode["L2I"] = 136] = "L2I";
    OpCode[OpCode["LADD"] = 97] = "LADD";
    OpCode[OpCode["LALOAD"] = 47] = "LALOAD";
    OpCode[OpCode["LAND"] = 127] = "LAND";
    OpCode[OpCode["LASTORE"] = 80] = "LASTORE";
    OpCode[OpCode["LCMP"] = 148] = "LCMP";
    OpCode[OpCode["LCONST_0"] = 9] = "LCONST_0";
    OpCode[OpCode["LCONST_1"] = 10] = "LCONST_1";
    OpCode[OpCode["LDC"] = 18] = "LDC";
    OpCode[OpCode["LDC_W"] = 19] = "LDC_W";
    OpCode[OpCode["LDC2_W"] = 20] = "LDC2_W";
    OpCode[OpCode["LDIV"] = 109] = "LDIV";
    OpCode[OpCode["LLOAD"] = 22] = "LLOAD";
    OpCode[OpCode["LLOAD_0"] = 30] = "LLOAD_0";
    OpCode[OpCode["LLOAD_1"] = 31] = "LLOAD_1";
    OpCode[OpCode["LLOAD_2"] = 32] = "LLOAD_2";
    OpCode[OpCode["LLOAD_3"] = 33] = "LLOAD_3";
    OpCode[OpCode["LMUL"] = 105] = "LMUL";
    OpCode[OpCode["LNEG"] = 117] = "LNEG";
    OpCode[OpCode["LOOKUPSWITCH"] = 171] = "LOOKUPSWITCH";
    OpCode[OpCode["LOR"] = 129] = "LOR";
    OpCode[OpCode["LREM"] = 113] = "LREM";
    OpCode[OpCode["LRETURN"] = 173] = "LRETURN";
    OpCode[OpCode["LSHL"] = 121] = "LSHL";
    OpCode[OpCode["LSHR"] = 123] = "LSHR";
    OpCode[OpCode["LSTORE"] = 55] = "LSTORE";
    OpCode[OpCode["LSTORE_0"] = 63] = "LSTORE_0";
    OpCode[OpCode["LSTORE_1"] = 64] = "LSTORE_1";
    OpCode[OpCode["LSTORE_2"] = 65] = "LSTORE_2";
    OpCode[OpCode["LSTORE_3"] = 66] = "LSTORE_3";
    OpCode[OpCode["LSUB"] = 101] = "LSUB";
    OpCode[OpCode["LUSHR"] = 125] = "LUSHR";
    OpCode[OpCode["LXOR"] = 131] = "LXOR";
    OpCode[OpCode["MONITORENTER"] = 194] = "MONITORENTER";
    OpCode[OpCode["MONITOREXIT"] = 195] = "MONITOREXIT";
    OpCode[OpCode["MULTIANEWARRAY"] = 197] = "MULTIANEWARRAY";
    OpCode[OpCode["NEW"] = 187] = "NEW";
    OpCode[OpCode["NEWARRAY"] = 188] = "NEWARRAY";
    OpCode[OpCode["NOP"] = 0] = "NOP";
    OpCode[OpCode["POP"] = 87] = "POP";
    OpCode[OpCode["POP2"] = 88] = "POP2";
    OpCode[OpCode["PUTFIELD"] = 181] = "PUTFIELD";
    OpCode[OpCode["PUTSTATIC"] = 179] = "PUTSTATIC";
    OpCode[OpCode["RET"] = 169] = "RET";
    OpCode[OpCode["RETURN"] = 177] = "RETURN";
    OpCode[OpCode["SALOAD"] = 53] = "SALOAD";
    OpCode[OpCode["SASTORE"] = 86] = "SASTORE";
    OpCode[OpCode["SIPUSH"] = 17] = "SIPUSH";
    OpCode[OpCode["SWAP"] = 95] = "SWAP";
    OpCode[OpCode["TABLESWITCH"] = 170] = "TABLESWITCH";
    OpCode[OpCode["WIDE"] = 196] = "WIDE";
    // Special Doppio 'fast' opcodes
    OpCode[OpCode["GETSTATIC_FAST32"] = 208] = "GETSTATIC_FAST32";
    OpCode[OpCode["GETSTATIC_FAST64"] = 209] = "GETSTATIC_FAST64";
    OpCode[OpCode["NEW_FAST"] = 210] = "NEW_FAST";
    OpCode[OpCode["ANEWARRAY_FAST"] = 213] = "ANEWARRAY_FAST";
    OpCode[OpCode["CHECKCAST_FAST"] = 214] = "CHECKCAST_FAST";
    OpCode[OpCode["INSTANCEOF_FAST"] = 215] = "INSTANCEOF_FAST";
    OpCode[OpCode["MULTIANEWARRAY_FAST"] = 216] = "MULTIANEWARRAY_FAST";
    OpCode[OpCode["PUTSTATIC_FAST32"] = 217] = "PUTSTATIC_FAST32";
    OpCode[OpCode["PUTSTATIC_FAST64"] = 218] = "PUTSTATIC_FAST64";
    OpCode[OpCode["GETFIELD_FAST32"] = 219] = "GETFIELD_FAST32";
    OpCode[OpCode["GETFIELD_FAST64"] = 220] = "GETFIELD_FAST64";
    OpCode[OpCode["PUTFIELD_FAST32"] = 221] = "PUTFIELD_FAST32";
    OpCode[OpCode["PUTFIELD_FAST64"] = 222] = "PUTFIELD_FAST64";
    OpCode[OpCode["INVOKENONVIRTUAL_FAST"] = 223] = "INVOKENONVIRTUAL_FAST";
    OpCode[OpCode["INVOKESTATIC_FAST"] = 240] = "INVOKESTATIC_FAST";
    OpCode[OpCode["INVOKEVIRTUAL_FAST"] = 241] = "INVOKEVIRTUAL_FAST";
    OpCode[OpCode["INVOKEINTERFACE_FAST"] = 242] = "INVOKEINTERFACE_FAST";
    OpCode[OpCode["INVOKEHANDLE"] = 243] = "INVOKEHANDLE";
    OpCode[OpCode["INVOKEBASIC"] = 244] = "INVOKEBASIC";
    OpCode[OpCode["LINKTOSPECIAL"] = 245] = "LINKTOSPECIAL";
    OpCode[OpCode["LINKTOVIRTUAL"] = 247] = "LINKTOVIRTUAL";
    OpCode[OpCode["INVOKEDYNAMIC_FAST"] = 248] = "INVOKEDYNAMIC_FAST";
})(exports.OpCode || (exports.OpCode = {}));
var OpCode = exports.OpCode;
(function (OpcodeLayoutType) {
    OpcodeLayoutType[OpcodeLayoutType["OPCODE_ONLY"] = 0] = "OPCODE_ONLY";
    OpcodeLayoutType[OpcodeLayoutType["CONSTANT_POOL_UINT8"] = 1] = "CONSTANT_POOL_UINT8";
    OpcodeLayoutType[OpcodeLayoutType["CONSTANT_POOL"] = 2] = "CONSTANT_POOL";
    OpcodeLayoutType[OpcodeLayoutType["CONSTANT_POOL_AND_UINT8_VALUE"] = 3] = "CONSTANT_POOL_AND_UINT8_VALUE";
    OpcodeLayoutType[OpcodeLayoutType["UINT8_VALUE"] = 4] = "UINT8_VALUE";
    OpcodeLayoutType[OpcodeLayoutType["UINT8_AND_INT8_VALUE"] = 5] = "UINT8_AND_INT8_VALUE";
    OpcodeLayoutType[OpcodeLayoutType["INT8_VALUE"] = 6] = "INT8_VALUE";
    OpcodeLayoutType[OpcodeLayoutType["INT16_VALUE"] = 7] = "INT16_VALUE";
    OpcodeLayoutType[OpcodeLayoutType["INT32_VALUE"] = 8] = "INT32_VALUE";
    // LOOKUPSWITCH,
    // TABLESWITCH,
    OpcodeLayoutType[OpcodeLayoutType["ARRAY_TYPE"] = 9] = "ARRAY_TYPE";
    OpcodeLayoutType[OpcodeLayoutType["WIDE"] = 10] = "WIDE";
})(exports.OpcodeLayoutType || (exports.OpcodeLayoutType = {}));
var OpcodeLayoutType = exports.OpcodeLayoutType;
// Contains the opcode layout types for each valid opcode.
// To conserve code space, it's assumed all opcodes not in the table
// are OPCODE_ONLY.
var olt = new Array(0xff);
(function () {
    for (var i = 0; i < 0xff; i++) {
        olt[i] = OpcodeLayoutType.OPCODE_ONLY;
    }
})();
function assignOpcodeLayout(layoutType, opcodes) {
    opcodes.forEach(function (opcode) {
        olt[opcode] = layoutType;
    });
}
assignOpcodeLayout(OpcodeLayoutType.UINT8_VALUE, [OpCode.ALOAD, OpCode.ASTORE, OpCode.DLOAD, OpCode.DSTORE,
    OpCode.FLOAD, OpCode.FSTORE, OpCode.ILOAD, OpCode.ISTORE,
    OpCode.LLOAD, OpCode.LSTORE, OpCode.RET]);
assignOpcodeLayout(OpcodeLayoutType.CONSTANT_POOL_UINT8, [OpCode.LDC]);
assignOpcodeLayout(OpcodeLayoutType.CONSTANT_POOL, [OpCode.LDC_W, OpCode.LDC2_W,
    OpCode.ANEWARRAY, OpCode.CHECKCAST, OpCode.GETFIELD,
    OpCode.GETSTATIC, OpCode.INSTANCEOF, OpCode.INVOKEDYNAMIC,
    OpCode.INVOKESPECIAL, OpCode.INVOKESTATIC, OpCode.INVOKEVIRTUAL,
    OpCode.NEW, OpCode.PUTFIELD, OpCode.PUTSTATIC, OpCode.MULTIANEWARRAY_FAST,
    OpCode.INVOKENONVIRTUAL_FAST, OpCode.INVOKESTATIC_FAST, OpCode.CHECKCAST_FAST,
    OpCode.NEW_FAST,
    OpCode.ANEWARRAY_FAST, OpCode.INSTANCEOF_FAST, OpCode.GETSTATIC_FAST32,
    OpCode.GETSTATIC_FAST64, OpCode.PUTSTATIC_FAST32, OpCode.PUTSTATIC_FAST64,
    OpCode.PUTFIELD_FAST32, OpCode.PUTFIELD_FAST64,
    OpCode.GETFIELD_FAST32, OpCode.GETFIELD_FAST64, OpCode.INVOKEVIRTUAL_FAST
]);
assignOpcodeLayout(OpcodeLayoutType.CONSTANT_POOL_AND_UINT8_VALUE, [OpCode.INVOKEINTERFACE, OpCode.INVOKEINTERFACE_FAST, OpCode.MULTIANEWARRAY]);
assignOpcodeLayout(OpcodeLayoutType.INT8_VALUE, [OpCode.BIPUSH]);
assignOpcodeLayout(OpcodeLayoutType.INT16_VALUE, [OpCode.SIPUSH, OpCode.GOTO, OpCode.IFGT, OpCode.IFEQ, OpCode.IFGE, OpCode.IFLE,
    OpCode.IFLT, OpCode.IFNE, OpCode.IFNULL, OpCode.IFNONNULL, OpCode.IF_ICMPLE,
    OpCode.IF_ACMPEQ, OpCode.IF_ACMPNE, OpCode.IF_ICMPEQ, OpCode.IF_ICMPGE,
    OpCode.IF_ICMPGT, OpCode.IF_ICMPLT, OpCode.IF_ICMPNE, OpCode.JSR]);
assignOpcodeLayout(OpcodeLayoutType.INT32_VALUE, [OpCode.GOTO_W, OpCode.JSR_W]);
assignOpcodeLayout(OpcodeLayoutType.UINT8_AND_INT8_VALUE, [OpCode.IINC]);
assignOpcodeLayout(OpcodeLayoutType.ARRAY_TYPE, [OpCode.NEWARRAY]);
exports.OpcodeLayouts = olt;
