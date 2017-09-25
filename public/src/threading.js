var enums = require('./enums');
var assert = require('./assert');
var gLong = require('./gLong');
var opcodes = require('./opcodes');
var logging = require('./logging');
var util = require('./util');
var ThreadStatus = enums.ThreadStatus;
var global = require('./global');
if (typeof RELEASE === 'undefined')
    global.RELEASE = false;
var debug = logging.debug, vtrace = logging.vtrace, trace = logging.trace, 
// The number of method resumes we should allow before yielding for
// responsiveness. Updated using a cumulative moving average to ensure
// Doppio is responsive.
maxMethodResumes = 10000, 
// The number of method resumes until Doppio should yield again.
methodResumesLeft = maxMethodResumes, 
// Used for the CMA.
numSamples = 1;
/**
 * Represents a stack frame for a bytecode method.
 */
var BytecodeStackFrame = (function () {
    /**
     * Constructs a bytecode method's stack frame.
     * @param method The bytecode method to run.
     * @param args The arguments to pass to the bytecode method.
     */
    function BytecodeStackFrame(method, args) {
        this.pc = 0;
        this.stack = [];
        this.returnToThreadLoop = false;
        this.lockedMethodLock = false;
        /**
         * Indicates the type of this stack frame.
         */
        this.type = enums.StackFrameType.BYTECODE;
        this.method = method;
        assert(!method.accessFlags.isNative(), 'Cannot run a native method using a BytecodeStackFrame.');
        // @todo This should be a runtime error, since reflection can cause you to
        // try to do this.
        assert(!method.accessFlags.isAbstract(), 'Cannot run an abstract method!');
        this.locals = args;
    }
    BytecodeStackFrame.prototype.run = function (thread) {
        var _this = this;
        var method = this.method, code = this.method.getCodeAttribute().getCode(), opcodeTable = opcodes.LookupTable;
        if (!RELEASE && logging.log_level >= logging.TRACE) {
            if (this.pc === 0) {
                trace("\nT" + thread.getRef() + " D" + thread.getStackTrace().length + " Running " + this.method.getFullSignature() + " [Bytecode]:");
            }
            else {
                trace("\nT" + thread.getRef() + " D" + thread.getStackTrace().length + " Resuming " + this.method.getFullSignature() + ":" + this.pc + " [Bytecode]:");
            }
            vtrace("  S: [" + logging.debug_vars(this.stack) + "], L: [" + logging.debug_vars(this.locals) + "]");
        }
        if (method.accessFlags.isSynchronized() && !this.lockedMethodLock) {
            // We are starting a synchronized method! These must implicitly enter
            // their respective locks.
            this.lockedMethodLock = method.methodLock(thread, this).enter(thread, function () {
                // Lock succeeded. Set the flag so we don't attempt to reacquire it
                // when this method reruns.
                _this.lockedMethodLock = true;
            });
            if (!this.lockedMethodLock) {
                // Failed. Thread is automatically blocked. Return.
                assert(thread.getStatus() === ThreadStatus.BLOCKED, "Failed to enter a monitor. Thread must be BLOCKED.");
                return;
            }
        }
        // Reset the returnToThreadLoop switch. The current value is leftover
        // from the previous time this method was run, and is meaningless.
        this.returnToThreadLoop = false;
        // Run until we get the signal to return to the thread loop.
        while (!this.returnToThreadLoop) {
            var op = code.readUInt8(this.pc);
            if (!RELEASE && logging.log_level === logging.VTRACE) {
                vtrace("  " + this.pc + " " + annotateOpcode(op, this, code, this.pc));
            }
            opcodeTable[op](thread, this, code, this.pc);
            if (!RELEASE && !this.returnToThreadLoop && logging.log_level === logging.VTRACE) {
                vtrace("    S: [" + logging.debug_vars(this.stack) + "], L: [" + logging.debug_vars(this.locals) + "]");
            }
        }
    };
    BytecodeStackFrame.prototype.scheduleResume = function (thread, rv, rv2) {
        // Advance to the next opcode.
        var prevOp = this.method.getCodeAttribute().getCode().readUInt8(this.pc);
        switch (prevOp) {
            case enums.OpCode.INVOKEINTERFACE:
            case enums.OpCode.INVOKEINTERFACE_FAST:
                this.pc += 5;
                break;
            case enums.OpCode.INVOKESPECIAL:
            case enums.OpCode.INVOKESTATIC:
            case enums.OpCode.INVOKEVIRTUAL:
            case enums.OpCode.INVOKESTATIC_FAST:
            case enums.OpCode.INVOKENONVIRTUAL_FAST:
            case enums.OpCode.INVOKEVIRTUAL_FAST:
            case enums.OpCode.INVOKEHANDLE:
            case enums.OpCode.INVOKEBASIC:
            case enums.OpCode.LINKTOSPECIAL:
            case enums.OpCode.LINKTOVIRTUAL:
            case enums.OpCode.INVOKEDYNAMIC:
            case enums.OpCode.INVOKEDYNAMIC_FAST:
                this.pc += 3;
                break;
            default:
                // Should be impossible.
                assert(false, "Resuming from a non-invoke opcode! Opcode: " + enums.OpCode[prevOp] + " [" + prevOp + "]");
                break;
        }
        if (rv !== undefined) {
            this.stack.push(rv);
        }
        if (rv2 !== undefined) {
            this.stack.push(rv2);
        }
    };
    /**
     * Checks if this method can handle the specified exception 'e'.
     * Returns true if it can, or if it needs to asynchronously resolve some
     * classes.
     *
     * In the latter case, scheduleException will handle rethrowing the exception
     * in the event that it can't actually handle it.
     */
    BytecodeStackFrame.prototype.scheduleException = function (thread, e) {
        var codeAttr = this.method.getCodeAttribute(), pc = this.pc, method = this.method, 
        // STEP 1: See if we can find an appropriate handler for this exception!
        exceptionHandlers = codeAttr.exceptionHandlers, ecls = e.getClass(), handler;
        for (var i = 0; i < exceptionHandlers.length; i++) {
            var eh = exceptionHandlers[i];
            if (eh.startPC <= pc && pc < eh.endPC) {
                if (eh.catchType === "<any>") {
                    handler = eh;
                    break;
                }
                else {
                    var resolvedCatchType = method.cls.getLoader().getResolvedClass(eh.catchType);
                    if (resolvedCatchType != null) {
                        if (ecls.isCastable(resolvedCatchType)) {
                            handler = eh;
                            break;
                        }
                    }
                    else {
                        // ASYNC PATH: We'll need to asynchronously resolve these handlers.
                        debug(method.getFullSignature() + " needs to resolve some exception types...");
                        var handlerClasses = [];
                        for (var i_1 = 0; i_1 < exceptionHandlers.length; i_1++) {
                            var handler_1 = exceptionHandlers[i_1];
                            if (handler_1.catchType !== "<any>") {
                                handlerClasses.push(handler_1.catchType);
                            }
                        }
                        debug(method.getFullSignature() + ": Has to resolve exception classes. Deferring scheduling...");
                        thread.setStatus(ThreadStatus.ASYNC_WAITING);
                        method.cls.getLoader().resolveClasses(thread, handlerClasses, function (classes) {
                            if (classes !== null) {
                                debug(method.getFullSignature() + ": Rethrowing exception to handle!");
                                // Rethrow the exception to trigger scheduleException again.
                                // @todo If the ClassLoader throws an exception during resolution,
                                // this could result in an infinite loop. Fix would be to sync check
                                // if class failed to load previously.
                                thread.throwException(e);
                            }
                        });
                        // Tell the thread we'll handle it.
                        return true;
                    }
                }
            }
        }
        // STEP 2: Either continue on if we could not find an appropriate handler,
        // or set up the stack for appropriate resumption.
        if (handler != null) {
            // Found the handler.
            debug(method.getFullSignature() + ": Caught " + e.getClass().getInternalName() + " as subclass of " + handler.catchType);
            this.stack = [e]; // clear out anything on the stack; it was made during the try block
            this.pc = handler.handlerPC;
            return true;
        }
        else {
            // abrupt method invocation completion
            debug(method.getFullSignature() + ": Did not catch " + e.getClass().getInternalName() + ".");
            // STEP 3: Synchronized method? Exit from the method's monitor.
            if (method.accessFlags.isSynchronized()) {
                method.methodLock(thread, this).exit(thread);
            }
            return false;
        }
    };
    /**
     * Returns the classloader for the stack frame.
     */
    BytecodeStackFrame.prototype.getLoader = function () {
        return this.method.cls.getLoader();
    };
    BytecodeStackFrame.prototype.getStackTraceFrame = function () {
        return {
            method: this.method,
            pc: this.pc,
            stack: this.stack.slice(0),
            locals: this.locals.slice(0)
        };
    };
    return BytecodeStackFrame;
})();
exports.BytecodeStackFrame = BytecodeStackFrame;
/**
 * Represents a native method's stack frame.
 */
var NativeStackFrame = (function () {
    /**
     * Constructs a native method's stack frame.
     * @param method The native method to run.
     * @param args The arguments to pass to the native method.
     */
    function NativeStackFrame(method, args) {
        this.type = enums.StackFrameType.NATIVE;
        this.method = method;
        this.args = args;
        assert(method.accessFlags.isNative());
        this.nativeMethod = method.getNativeFunction();
    }
    /**
     * Calls the native method.
     * NOTE: Should only be called once.
     */
    NativeStackFrame.prototype.run = function (thread) {
        trace("\nT" + thread.getRef() + " D" + thread.getStackTrace().length + " Running " + this.method.getFullSignature() + " [Native]:");
        var rv = this.nativeMethod.apply(null, this.method.convertArgs(thread, this.args));
        // Ensure thread is running, and we are the running method.
        if (thread.getStatus() === ThreadStatus.RUNNABLE && thread.currentMethod() === this.method) {
            // Normal native method exit.
            var returnType = this.method.returnType;
            switch (returnType) {
                case 'J':
                case 'D':
                    // Two stack return values for methods that return a long or a double.
                    thread.asyncReturn(rv, null);
                    break;
                case 'Z':
                    // Convert to a number.
                    thread.asyncReturn(rv ? 1 : 0);
                    break;
                default:
                    thread.asyncReturn(rv);
                    break;
            }
        }
    };
    /**
     * N/A
     */
    NativeStackFrame.prototype.scheduleResume = function (thread, rv, rv2) {
        // NOP
    };
    /**
     * Not relevant; the first execution block of a native method will never
     * receive an exception.
     */
    NativeStackFrame.prototype.scheduleException = function (thread, e) {
        return false;
    };
    NativeStackFrame.prototype.getStackTraceFrame = function () {
        return {
            method: this.method,
            pc: -1,
            stack: [],
            locals: []
        };
    };
    /**
     * Returns the classloader for the stack frame.
     */
    NativeStackFrame.prototype.getLoader = function () {
        return this.method.cls.getLoader();
    };
    return NativeStackFrame;
})();
exports.NativeStackFrame = NativeStackFrame;
/**
 * InternalStackFrames are used by the JVM to launch JVM functions that
 * eventually call back into JavaScript code when they complete or throw a
 * fatal exception.
 */
var InternalStackFrame = (function () {
    /**
     * @param cb Callback function. Called with an exception if one occurs, or
     *   the return value from the called method, if relevant.
     */
    function InternalStackFrame(cb) {
        this.isException = false;
        this.type = enums.StackFrameType.INTERNAL;
        this.cb = cb;
    }
    InternalStackFrame.prototype.run = function (thread) {
        // Pop myself off of the stack.
        thread.framePop();
        // Pause the thread before returning into native JavaScript code.
        thread.setStatus(ThreadStatus.ASYNC_WAITING);
        if (this.isException) {
            this.cb(this.val);
        }
        else {
            this.cb(null, this.val);
        }
    };
    /**
     * Resumes the JavaScript code that created this stack frame.
     */
    InternalStackFrame.prototype.scheduleResume = function (thread, rv) {
        this.isException = false;
        this.val = rv;
    };
    /**
     * Resumes the JavaScript code that created this stack frame with the given
     * exception.
     */
    InternalStackFrame.prototype.scheduleException = function (thread, e) {
        this.isException = true;
        this.val = e;
        return true;
    };
    InternalStackFrame.prototype.getStackTraceFrame = function () {
        // These should not be language visible.
        return null;
    };
    InternalStackFrame.prototype.getLoader = function () {
        throw new Error("Internal stack frames have no loader.");
    };
    return InternalStackFrame;
})();
exports.InternalStackFrame = InternalStackFrame;
/**
 * Represents a single JVM thread.
 */
var JVMThread = (function () {
    /**
     * Initializes a new JVM thread. Starts the thread in the NEW state.
     */
    function JVMThread(jvm, tpool, threadObj) {
        /**
         * The current state of this thread, from the JVM level.
         */
        this.status = ThreadStatus.NEW;
        /**
         * The call stack.
         */
        this.stack = [];
        /**
         * Whether or not this thread has been interrupted. It's a JVM thing.
         */
        this.interrupted = false;
        /**
         * If the thread is WAITING, BLOCKED, or TIMED_WAITING, this field holds the
         * monitor that is involved.
         */
        this.monitor = null;
        this.jvm = jvm;
        this.bsCl = jvm.getBootstrapClassLoader();
        this.tpool = tpool;
        this.jvmThreadObj = threadObj;
    }
    /**
     * Get the JVM thread object that represents this thread.
     */
    JVMThread.prototype.getJVMObject = function () {
        return this.jvmThreadObj;
    };
    /**
     * Is this thread a daemon?
     */
    JVMThread.prototype.isDaemon = function () {
        return this.jvmThreadObj['java/lang/Thread/daemon'] !== 0;
    };
    /**
     * Get the priority of this thread.
     */
    JVMThread.prototype.getPriority = function () {
        return this.jvmThreadObj['java/lang/Thread/priority'];
    };
    /**
     * XXX: Used during bootstrapping to set the first thread's Thread object.
     */
    JVMThread.prototype.setJVMObject = function (obj) {
        obj['java/lang/Thread/threadStatus'] = this.jvmThreadObj['java/lang/Thread/threadStatus'];
        this.jvmThreadObj = obj;
    };
    /**
     * Return the reference number for this thread.
     */
    JVMThread.prototype.getRef = function () {
        return this.jvmThreadObj.ref;
    };
    /**
     * Check if this thread's interrupted flag is set.
     */
    JVMThread.prototype.isInterrupted = function () {
        return this.interrupted;
    };
    /**
     * Returns the currently running method. Returns NULL if stack is empty.
     */
    JVMThread.prototype.currentMethod = function () {
        var stack = this.stack, idx = stack.length, method;
        while (--idx >= 0) {
            method = stack[idx].getStackTraceFrame().method;
            if (method !== null) {
                return method;
            }
        }
        return null;
    };
    /**
     * Set or unset this thread's interrupted flag.
     */
    JVMThread.prototype.setInterrupted = function (interrupted) {
        this.interrupted = interrupted;
    };
    /**
     * Retrieve the bootstrap classloader.
     */
    JVMThread.prototype.getBsCl = function () {
        return this.bsCl;
    };
    /**
     * Get the classloader for the current frame.
     */
    JVMThread.prototype.getLoader = function () {
        var loader = this.stack[this.stack.length - 1].getLoader();
        if (loader) {
            return loader;
        }
        else {
            // Crawl stack until we find one.
            var len = this.stack.length;
            for (var i = 2; i <= len; i++) {
                loader = this.stack[len - i].getLoader();
                if (loader) {
                    return loader;
                }
            }
            throw new Error("Unable to find loader.");
        }
    };
    JVMThread.prototype.import = function (names, cb, explicit) {
        var _this = this;
        if (explicit === void 0) { explicit = true; }
        var loader = this.getLoader();
        this.setStatus(ThreadStatus.ASYNC_WAITING);
        if (Array.isArray(names)) {
            var rv = [];
            util.asyncForEach(names, function (name, nextItem) {
                _this._import(name, loader, function (cons) {
                    rv.push(cons);
                    nextItem();
                }, explicit);
            }, function (e) {
                cb(rv);
            });
        }
        else {
            this._import(names, loader, cb, explicit);
        }
    };
    JVMThread.prototype._import = function (name, loader, cb, explicit) {
        var _this = this;
        var cls = loader.getInitializedClass(this, name);
        if (cls) {
            setImmediate(function () { return cb(cls.getConstructor(_this)); });
        }
        else {
            loader.initializeClass(this, name, function (cdata) {
                if (cdata) {
                    cb(cdata.getConstructor(_this));
                }
            }, explicit);
        }
    };
    /**
     * Retrieve the JVM instantiation that this thread belongs to.
     */
    JVMThread.prototype.getJVM = function () {
        return this.jvm;
    };
    /**
     * Retrieve the thread pool that this thread belongs to.
     */
    JVMThread.prototype.getThreadPool = function () {
        return this.tpool;
    };
    /**
     * Retrieves the current stack trace.
     */
    JVMThread.prototype.getStackTrace = function () {
        var trace = [], i, frame;
        for (i = 0; i < this.stack.length; i++) {
            frame = this.stack[i].getStackTraceFrame();
            if (frame != null) {
                trace.push(frame);
            }
        }
        return trace;
    };
    /**
     * [DEBUG] Return a printable string of the thread's current stack trace.
     */
    JVMThread.prototype.getPrintableStackTrace = function () {
        var rv = "";
        this.getStackTrace().reverse().forEach(function (trace) {
            rv += "\tat " + util.ext_classname(trace.method.cls.getInternalName()) + "::" + trace.method.name + "(";
            if (trace.pc >= 0) {
                // Bytecode method
                var code = trace.method.getCodeAttribute();
                var table = code.getAttribute('LineNumberTable');
                var srcAttr = trace.method.cls.getAttribute('SourceFile');
                if (srcAttr != null) {
                    rv += srcAttr.filename;
                }
                else {
                    rv += 'unknown';
                }
                if (table != null) {
                    var lineNumber = table.getLineNumber(trace.pc);
                    rv += ":" + lineNumber;
                    rv += " Bytecode offset: " + trace.pc;
                }
            }
            else {
                // Native method.
                rv += "native";
            }
            rv += ")\n";
        });
        return rv;
    };
    /**
     * The thread's main execution loop. Everything starts here!
     *
     * SHOULD ONLY BE INVOKED BY THE SCHEDULER.
     */
    JVMThread.prototype.run = function () {
        var stack = this.stack, startTime = (new Date()).getTime();
        // Reset counter. Threads always start from a fresh stack / yield.
        methodResumesLeft = maxMethodResumes;
        while (this.status === ThreadStatus.RUNNABLE && stack.length > 0) {
            var sf = stack[stack.length - 1];
            if (!RELEASE) {
                if (sf.type === enums.StackFrameType.BYTECODE && this.jvm.shouldVtrace(sf.method.fullSignature)) {
                    var oldLevel = logging.log_level;
                    logging.log_level = logging.VTRACE;
                    sf.run(this);
                    logging.log_level = oldLevel;
                }
                else {
                    sf.run(this);
                }
            }
            else {
                sf.run(this);
            }
            if (--methodResumesLeft === 0) {
                var endTime = (new Date()).getTime();
                var duration = endTime - startTime;
                // Estimated number of methods we can resume before needing to yield.
                var estMaxMethodResumes = ((maxMethodResumes / duration) * this.jvm.getResponsiveness()) | 0;
                // Update CMA.
                maxMethodResumes = ((estMaxMethodResumes + numSamples * maxMethodResumes) / (numSamples + 1)) | 0;
                if (maxMethodResumes <= 0) {
                    // Sanity check. Should never really occur.
                    maxMethodResumes = 10;
                }
                vtrace("T" + this.getRef() + " Quantum over. Method resumes: Max " + maxMethodResumes + " Est " + estMaxMethodResumes + " Samples " + numSamples);
                numSamples++;
                // Tell the scheduler that our quantum is over.
                this.tpool.quantumOver(this);
                // Break out of while loop.
                break;
            }
        }
        if (stack.length === 0) {
            // This thread has finished!
            this.setStatus(ThreadStatus.TERMINATED);
        }
    };
    /**
     * [DEBUG] Performs a sanity check on the thread.
     */
    JVMThread.prototype.sanityCheck = function () {
        switch (this.status) {
            case ThreadStatus.NEW:
                return true;
            case ThreadStatus.RUNNABLE:
                assert(this.stack.length > 0, 'A runnable thread must not have an empty stack.');
                return true;
            case ThreadStatus.TIMED_WAITING:
                assert(this.monitor != null && this.monitor.isTimedWaiting(this), 'A timed waiting thread must be waiting on a monitor.');
                return true;
            case ThreadStatus.WAITING:
                assert(this.monitor != null && this.monitor.isWaiting(this), "A waiting thread must be waiting on a monitor.");
                return true;
            case ThreadStatus.BLOCKED:
            case ThreadStatus.UNINTERRUPTABLY_BLOCKED:
                assert(this.monitor != null && this.monitor.isBlocked(this), "A blocked thread must be blocked on a monitor");
                return true;
            case ThreadStatus.ASYNC_WAITING:
                return true;
            case ThreadStatus.TERMINATED:
                assert(this.stack.length === 0, "A terminated thread must have an empty stack.");
                return true;
            case ThreadStatus.PARKED:
                assert(this.jvm.getParker().isParked(this), "A parked thread must be parked.");
                return true;
            default:
                // Invalid ThreadStatus.
                return false;
        }
    };
    /**
     * Should only be called by setStatus.
     * Updates both the JVMThread object and this object.
     */
    JVMThread.prototype.rawSetStatus = function (newStatus) {
        var jvmNewStatus = 0, oldStatus = this.status;
        if (logging.log_level === logging.VTRACE) {
            vtrace("\nT" + this.getRef() + " " + ThreadStatus[oldStatus] + " => " + ThreadStatus[newStatus]);
        }
        assert(validateThreadTransition(oldStatus, newStatus), "Invalid thread transition: " + ThreadStatus[oldStatus] + " => " + ThreadStatus[newStatus]);
        this.status = newStatus;
        // Map our status value back to JVM's threadStatus value.
        // Ensures that JVM code can introspect on our threads.
        switch (newStatus) {
            case ThreadStatus.NEW:
                jvmNewStatus |= enums.JVMTIThreadState.ALIVE;
                break;
            case ThreadStatus.RUNNABLE:
                jvmNewStatus |= enums.JVMTIThreadState.RUNNABLE;
                break;
            case ThreadStatus.BLOCKED:
            case ThreadStatus.UNINTERRUPTABLY_BLOCKED:
                jvmNewStatus |= enums.JVMTIThreadState.BLOCKED_ON_MONITOR_ENTER;
                break;
            case ThreadStatus.WAITING:
            case ThreadStatus.ASYNC_WAITING:
            case ThreadStatus.PARKED:
                jvmNewStatus |= enums.JVMTIThreadState.WAITING_INDEFINITELY;
                break;
            case ThreadStatus.TIMED_WAITING:
                jvmNewStatus |= enums.JVMTIThreadState.WAITING_WITH_TIMEOUT;
                break;
            case ThreadStatus.TERMINATED:
                jvmNewStatus |= enums.JVMTIThreadState.TERMINATED;
                break;
            default:
                jvmNewStatus = enums.JVMTIThreadState.RUNNABLE;
                break;
        }
        this.jvmThreadObj['java/lang/Thread/threadStatus'] = jvmNewStatus;
        this.tpool.statusChange(this, oldStatus, this.status);
    };
    /**
     * Transitions the thread from one state to the next.
     * Contains JVM-specific thread logic.
     */
    JVMThread.prototype.setStatus = function (status, monitor) {
        if (monitor === void 0) { monitor = null; }
        if (this.status !== status) {
            var oldStatus = this.status;
            // Update the monitor.
            this.monitor = monitor;
            if (status !== ThreadStatus.TERMINATED) {
                // Actually change state.
                this.rawSetStatus(status);
            }
            else {
                // Call exit() first.
                this.exit();
            }
            // Validate current state (debug builds only)
            assert(this.sanityCheck(), "Invalid thread status.");
        }
    };
    /**
     * Called when a thread finishes executing.
     */
    JVMThread.prototype.exit = function () {
        var _this = this;
        var monitor = this.jvmThreadObj.getMonitor();
        if (monitor.isBlocked(this) || monitor.getOwner() === this || this.status === ThreadStatus.TERMINATED) {
            // Thread is already shutting down.
            return;
        }
        if (this.stack.length === 0) {
            // De-schedule thread.
            this.setStatus(ThreadStatus.ASYNC_WAITING);
            // Only applicable if it's not an early death, e.g. before VM bootup.
            if (this.jvm.hasVMBooted()) {
                trace("T" + this.getRef() + " Exiting.");
                var phase2 = function () {
                    trace("T" + _this.getRef() + " Entered exit monitor.");
                    // Exit.
                    _this.jvmThreadObj["exit()V"](_this, null, function (e) {
                        // Notify everyone.
                        monitor.notifyAll(_this);
                        // Exit monitor.
                        monitor.exit(_this);
                        trace("T" + _this.getRef() + " Terminated.");
                        // Actually become terminated.
                        _this.rawSetStatus(ThreadStatus.TERMINATED);
                    });
                };
                // Acquire the monitor associated with our JavaObject.
                if (monitor.enter(this, phase2)) {
                    phase2();
                }
            }
            else {
                trace("T" + this.getRef() + " Not exiting; VM is still booting.");
            }
        }
        else {
            // There are things on the stack. This exit is occuring before the stack has emptied.
            // Clear the stack, set to terminated.
            while (this.stack.length > 0) {
                this.stack.pop();
            }
            trace("T" + this.getRef() + " Terminated.");
            this.rawSetStatus(ThreadStatus.TERMINATED);
        }
    };
    /**
     * Called when the priority of the thread changes.
     * Should only be called by java.lang.setPriority0.
     */
    JVMThread.prototype.signalPriorityChange = function () {
        this.tpool.priorityChange(this);
    };
    /**
     * Get the monitor that this thread is waiting or blocked on.
     */
    JVMThread.prototype.getMonitorBlock = function () {
        return this.monitor;
    };
    /**
     * Get the thread's current state.
     */
    JVMThread.prototype.getStatus = function () {
        return this.status;
    };
    JVMThread.prototype.asyncReturn = function (rv, rv2) {
        var stack = this.stack;
        assert(this.status === ThreadStatus.RUNNABLE || this.status === ThreadStatus.ASYNC_WAITING);
        assert(typeof (rv) !== 'boolean' && rv2 == null);
        // Pop off the current method.
        var frame = stack.pop();
        if (frame.type != enums.StackFrameType.INTERNAL) {
            var frameCast = frame;
            if (frame.type === enums.StackFrameType.BYTECODE) {
                // This line will be preceded by a line that prints the method, so can be short n' sweet.
                trace("  Returning: " + logging.debug_var(rv));
            }
            trace("\nT" + this.getRef() + " D" + (this.getStackTrace().length + 1) + " Returning value from " + frameCast.method.getFullSignature() + " [" + (frameCast.method.accessFlags.isNative() ? 'Native' : 'Bytecode') + "]: " + logging.debug_var(rv));
            assert(validateReturnValue(this, frameCast.method, frameCast.method.returnType, this.bsCl, frameCast.method.cls.getLoader(), rv, rv2), "Invalid return value for method " + frameCast.method.getFullSignature());
        }
        // Tell the top of the stack that this RV is waiting for it.
        var idx = stack.length - 1;
        // If idx is 0, then the thread will TERMINATE next time it enters its main
        // loop.
        if (idx >= 0) {
            stack[idx].scheduleResume(this, rv, rv2);
        }
        // Thread state transition.
        this.setStatus(ThreadStatus.RUNNABLE);
    };
    /**
     * Pops the top stackframe off of the call stack.
     * WARNING: SHOULD ONLY BE CALLED BY InternalStackFrame.run()!
     */
    JVMThread.prototype.framePop = function () {
        this.stack.pop();
    };
    /**
     * Throws the given JVM exception. Causes the thread to unwind the stack until
     * it can find a stack frame that can handle the exception.
     *
     * Causes the following state transition:
     * * RUNNING => RUNNABLE
     * * RUNNABLE => RUNNABLE
     * * ASYNC_WAITING => RUNNABLE
     *
     * Or, if the exception is uncaught, one of the following transitions:
     * * RUNNING => TERMINATED
     * * RUNNABLE => TERMINATED
     * * ASYNC_WAITING => TERMINATED
     *
     * It is not valid to call this method if the thread is in any other state.
     */
    JVMThread.prototype.throwException = function (exception) {
        assert(this.status === ThreadStatus.RUNNABLE || this.status === ThreadStatus.ASYNC_WAITING, "Tried to throw exception while thread was in state " + ThreadStatus[this.status]);
        var stack = this.stack, idx = stack.length - 1;
        // Stack may actually be empty, so guard against this.
        if (idx >= 0) {
            // An internal stack frame cannot process its own thrown exception.
            if (stack[idx].type === enums.StackFrameType.INTERNAL) {
                stack.pop();
                idx--;
            }
            // Find a stack frame that can handle the exception.
            // Set our status *before* scheduling the exception. Some exception handlers
            // may want to do something asynchronous before resuming execution.
            this.setStatus(ThreadStatus.RUNNABLE);
            while (stack.length > 0 && !stack[idx].scheduleException(this, exception)) {
                stack.pop();
                idx--;
            }
        }
        if (stack.length === 0) {
            // Uncaught exception!
            this.handleUncaughtException(exception);
        }
    };
    /**
     * Construct a new exception object of the given class with the given message.
     * Convenience function for native JavaScript code.
     * @param clsName Name of the class (e.g. "Ljava/lang/Throwable;")
     * @param msg The message to include with the exception.
     */
    JVMThread.prototype.throwNewException = function (clsName, msg) {
        var _this = this;
        var cls = this.bsCl.getInitializedClass(this, clsName), throwException = function () {
            var eCons = cls.getConstructor(_this), e = new eCons(_this);
            // Construct the exception, and throw it when done.
            e['<init>(Ljava/lang/String;)V'](_this, [util.initString(_this.bsCl, msg)], function (err) {
                if (err) {
                    _this.throwException(err);
                }
                else {
                    _this.throwException(e);
                }
            });
        };
        if (cls != null) {
            // No initialization required.
            throwException();
        }
        else {
            // Initialization required.
            this.setStatus(ThreadStatus.ASYNC_WAITING);
            this.bsCl.initializeClass(this, clsName, function (cdata) {
                if (cdata != null) {
                    cls = cdata;
                    throwException();
                }
            }, false);
        }
    };
    /**
     * Handles an uncaught exception on a thread.
     */
    JVMThread.prototype.handleUncaughtException = function (exception) {
        this.jvmThreadObj['dispatchUncaughtException(Ljava/lang/Throwable;)V'](this, [exception]);
    };
    return JVMThread;
})();
exports.JVMThread = JVMThread;
/**
 * [DEBUG] Stores all of the valid thread transitions.
 * @todo Any way to make this smaller?
 * @todo Move into 'debug' module that we NOP out in release builds.
 */
exports.validTransitions = {};
exports.validTransitions[ThreadStatus.NEW] = {};
exports.validTransitions[ThreadStatus.NEW][ThreadStatus.RUNNABLE] = "RunMethod invoked on new thread";
exports.validTransitions[ThreadStatus.NEW][ThreadStatus.ASYNC_WAITING] = "[JVM bootup only] Internal operation occurs on new thread";
exports.validTransitions[ThreadStatus.NEW][ThreadStatus.TERMINATED] = "[JVM halt0 only] When the JVM shuts down, it terminates all threads, including those that have never been run.";
exports.validTransitions[ThreadStatus.ASYNC_WAITING] = {};
exports.validTransitions[ThreadStatus.ASYNC_WAITING][ThreadStatus.RUNNABLE] = "Async operation completes";
exports.validTransitions[ThreadStatus.ASYNC_WAITING][ThreadStatus.TERMINATED] = "RunMethod completes and callstack is empty";
exports.validTransitions[ThreadStatus.BLOCKED] = {};
exports.validTransitions[ThreadStatus.BLOCKED][ThreadStatus.RUNNABLE] = "Acquires monitor, or is interrupted";
exports.validTransitions[ThreadStatus.BLOCKED][ThreadStatus.TERMINATED] = "Thread is terminated whilst blocked.";
exports.validTransitions[ThreadStatus.PARKED] = {};
exports.validTransitions[ThreadStatus.PARKED][ThreadStatus.ASYNC_WAITING] = "Balancing unpark, or is interrupted";
exports.validTransitions[ThreadStatus.PARKED][ThreadStatus.TERMINATED] = "Thread is terminated whilst parked.";
exports.validTransitions[ThreadStatus.RUNNABLE] = {};
exports.validTransitions[ThreadStatus.RUNNABLE][ThreadStatus.ASYNC_WAITING] = "Thread performs an asynchronous JavaScript operation";
exports.validTransitions[ThreadStatus.RUNNABLE][ThreadStatus.TERMINATED] = "Callstack is empty";
exports.validTransitions[ThreadStatus.RUNNABLE][ThreadStatus.BLOCKED] = "Thread waits to acquire monitor";
exports.validTransitions[ThreadStatus.RUNNABLE][ThreadStatus.WAITING] = "Thread waits on monitor (Object.wait)";
exports.validTransitions[ThreadStatus.RUNNABLE][ThreadStatus.TIMED_WAITING] = "Thread waits on monitor with timeout (Object.wait)";
exports.validTransitions[ThreadStatus.RUNNABLE][ThreadStatus.PARKED] = "Thread parks itself";
exports.validTransitions[ThreadStatus.TERMINATED] = {};
exports.validTransitions[ThreadStatus.TERMINATED][ThreadStatus.NEW] = "Thread is resurrected for re-use";
exports.validTransitions[ThreadStatus.TERMINATED][ThreadStatus.RUNNABLE] = "Thread is resurrected for re-use";
exports.validTransitions[ThreadStatus.TERMINATED][ThreadStatus.ASYNC_WAITING] = "[JVM Bootup] Thread is resurrected for internal operation";
exports.validTransitions[ThreadStatus.TIMED_WAITING] = {};
exports.validTransitions[ThreadStatus.TIMED_WAITING][ThreadStatus.RUNNABLE] = "Timer expires, or thread is interrupted, and thread immediately acquires lock";
exports.validTransitions[ThreadStatus.TIMED_WAITING][ThreadStatus.UNINTERRUPTABLY_BLOCKED] = "Thread is interrupted or notified, or timer expires, and lock already owned";
exports.validTransitions[ThreadStatus.TIMED_WAITING][ThreadStatus.TERMINATED] = "Thread is terminated whilst waiting.";
exports.validTransitions[ThreadStatus.UNINTERRUPTABLY_BLOCKED] = {};
exports.validTransitions[ThreadStatus.UNINTERRUPTABLY_BLOCKED][ThreadStatus.RUNNABLE] = "Thread acquires monitor";
exports.validTransitions[ThreadStatus.UNINTERRUPTABLY_BLOCKED][ThreadStatus.TERMINATED] = "Thread is terminated whilst blocked.";
exports.validTransitions[ThreadStatus.WAITING] = {};
exports.validTransitions[ThreadStatus.WAITING][ThreadStatus.RUNNABLE] = "Thread is interrupted, and immediately acquires lock";
exports.validTransitions[ThreadStatus.WAITING][ThreadStatus.UNINTERRUPTABLY_BLOCKED] = "Thread is notified or interrupted, and does not immediately acquire lock";
exports.validTransitions[ThreadStatus.WAITING][ThreadStatus.TERMINATED] = "Thread is terminated whilst waiting.";
/**
 * [DEBUG] Ensures that a thread transition is legal.
 */
function validateThreadTransition(oldStatus, newStatus) {
    var rv = exports.validTransitions.hasOwnProperty("" + oldStatus) &&
        exports.validTransitions[oldStatus].hasOwnProperty("" + newStatus);
    return rv;
}
/**
 * [DEBUG] Asserts that the return value of the function passes basic sanity
 * checks.
 */
function validateReturnValue(thread, method, returnType, bsCl, cl, rv1, rv2) {
    // invokeBasic is typed with an Object return value, but it can return any
    // damn type it wants, primitive or no.
    if (method.fullSignature === "java/lang/invoke/MethodHandle/invokeBasic([Ljava/lang/Object;)Ljava/lang/Object;") {
        return true;
    }
    var cls;
    if (util.is_primitive_type(returnType)) {
        switch (returnType) {
            case 'Z':
                assert(rv2 === undefined, "Second return value must be undefined for Boolean type.");
                assert(rv1 === 1 || rv1 === 0, "Booleans must be 0 or 1.");
                break;
            case 'B':
                assert(rv2 === undefined, "Second return value must be undefined for Byte type.");
                assert(rv1 <= 127 && rv1 >= -128, "Byte value for method " + method.name + " is out of bounds: " + rv1);
                break;
            case 'C':
                assert(rv2 === undefined, "Second return value must be undefined for Character type.");
                assert(rv1 <= 65535 && rv1 >= 0, "Character value is out of bounds: " + rv1);
                break;
            case 'S':
                assert(rv2 === undefined, "Second return value must be undefined for Short type.");
                assert(rv1 <= 32767 && rv1 >= -32768, "Short value is out of bounds: " + rv1);
                break;
            case 'I':
                assert(rv2 === undefined, "Second return value must be undefined for Int type.");
                assert(rv1 <= 2147483647 && rv1 >= -2147483648, "Int value is out of bounds: " + rv1);
                break;
            case 'J':
                assert(rv2 === null, "Second return value must be NULL for Long type.");
                assert(rv1.lessThanOrEqual(gLong.MAX_VALUE) && rv1.greaterThanOrEqual(gLong.MIN_VALUE), "Long value is out of bounds: " + rv1);
                break;
            case 'F':
                assert(rv2 === undefined, "Second return value must be undefined for Float type.");
                // NaN !== NaN, so we have to have a special case here.
                assert(util.wrapFloat(rv1) === rv1 || (isNaN(rv1) && isNaN(util.wrapFloat(rv1))), "Float value is out of bounds: " + rv1);
                break;
            case 'D':
                assert(rv2 === null, "Second return value must be NULL for Double type.");
                assert(typeof rv1 === 'number', "Invalid double value: " + rv1);
                break;
            case 'V':
                assert(rv1 === undefined && rv2 === undefined, "Return values must be undefined for Void type");
                break;
        }
    }
    else if (util.is_array_type(returnType)) {
        assert(rv2 === undefined, "Second return value must be undefined for array type.");
        assert(rv1 === null || (typeof rv1 === 'object' && typeof rv1['getClass'] === 'function'), "Invalid array object: " + rv1);
        if (rv1 != null) {
            cls = assertClassInitializedOrResolved(thread, cl, returnType, true);
            assert(rv1.getClass().isCastable(cls), "Return value of type " + rv1.getClass().getInternalName() + " unable to be cast to return type " + returnType + ".");
        }
    }
    else {
        assert(util.is_reference_type(returnType), "Invalid reference type: " + returnType);
        assert(rv2 === undefined, "Second return value must be undefined for reference type.");
        // All objects and arrays are instances of java/lang/Object.
        assert(rv1 === null || rv1 instanceof bsCl.getInitializedClass(thread, 'Ljava/lang/Object;').getConstructor(thread), "Reference return type must be an instance of Object; value: " + rv1);
        if (rv1 != null) {
            cls = assertClassInitializedOrResolved(thread, cl, returnType, false);
            if (!cls.accessFlags.isInterface()) {
                // You can return an interface type without initializing it,
                // since they don't need to be initialized until you try to
                // invoke one of their methods.
                // NOTE: We don't check if the class is in the INITIALIZED state,
                // since it is possible that it is currently in the process of being
                // initialized. getInitializedClass handles this subtlety.
                assertClassInitializedOrResolved(thread, cl, returnType, true);
            }
            assert(rv1.getClass().isCastable(cls), "Unable to cast " + rv1.getClass().getInternalName() + " to " + returnType + ".");
        }
    }
    return true;
}
function assertClassInitializedOrResolved(thread, cl, type, initialized) {
    var cls = null;
    // Break out of loop once class is found.
    while (cls === null) {
        cls = initialized ? cl.getInitializedClass(thread, type) : cl.getResolvedClass(type);
        if (cl.getLoaderObject() !== null) {
            if (cl.getLoaderObject()['java/lang/ClassLoader/parent'] === null) {
                cl = thread.getBsCl();
            }
            else {
                cl = cl.getLoaderObject()['java/lang/ClassLoader/parent'].$loader;
            }
        }
        else {
            // We just checked the bootstrap classloader, so we reached the root.
            assert(cls !== null, "Unable to get initialized class for type " + type + ".");
        }
    }
    return cls;
}
function printConstantPoolItem(cpi) {
    switch (cpi.getType()) {
        case enums.ConstantPoolItemType.METHODREF:
            var cpiMR = cpi;
            return util.ext_classname(cpiMR.classInfo.name) + "." + cpiMR.signature;
        case enums.ConstantPoolItemType.INTERFACE_METHODREF:
            var cpiIM = cpi;
            return util.ext_classname(cpiIM.classInfo.name) + "." + cpiIM.signature;
        case enums.ConstantPoolItemType.FIELDREF:
            var cpiFR = cpi;
            return util.ext_classname(cpiFR.classInfo.name) + "." + cpiFR.nameAndTypeInfo.name + ":" + util.ext_classname(cpiFR.nameAndTypeInfo.descriptor);
        case enums.ConstantPoolItemType.NAME_AND_TYPE:
            var cpiNAT = cpi;
            return cpiNAT.name + ":" + cpiNAT.descriptor;
        case enums.ConstantPoolItemType.CLASS:
            var cpiClass = cpi;
            return util.ext_classname(cpiClass.name);
        default:
            return logging.debug_var(cpi.value);
    }
}
// TODO: Prefix behind DEBUG, cache lowercase opcode names.
exports.OpcodeLayoutPrinters = {};
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.OPCODE_ONLY] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase(); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.CONSTANT_POOL] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + printConstantPoolItem(frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1))); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.CONSTANT_POOL_UINT8] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + printConstantPoolItem(frame.method.cls.constantPool.get(code.readUInt8(pc + 1))); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.CONSTANT_POOL_AND_UINT8_VALUE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + printConstantPoolItem(frame.method.cls.constantPool.get(code.readUInt16BE(pc + 1))) + " " + code.readUInt8(pc + 3); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.UINT8_VALUE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + code.readUInt8(pc + 1); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.UINT8_AND_INT8_VALUE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + code.readUInt8(pc + 1) + " " + code.readInt8(pc + 2); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.INT8_VALUE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + code.readInt8(pc + 1); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.INT16_VALUE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + code.readInt16BE(pc + 1); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.INT32_VALUE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + code.readInt32BE(pc + 1); };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.ARRAY_TYPE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase() + " " + opcodes.ArrayTypes[code.readUInt8(pc + 1)]; };
exports.OpcodeLayoutPrinters[enums.OpcodeLayoutType.WIDE] = function (frame, code, pc) { return enums.OpCode[code.readUInt8(pc)].toLowerCase(); };
function annotateOpcode(op, frame, code, pc) {
    return exports.OpcodeLayoutPrinters[enums.OpcodeLayouts[op]](frame, code, pc);
}
