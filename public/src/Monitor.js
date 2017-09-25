var enums = require('./enums');
var assert = require('./assert');
/**
 * Represents a JVM monitor.
 */
var Monitor = (function () {
    function Monitor() {
        /**
         * The owner of the monitor.
         */
        this.owner = null;
        /**
         * Number of times that the current owner has locked this monitor.
         */
        this.count = 0;
        /**
         * JVM threads that are waiting for the current owner to relinquish the
         * monitor.
         */
        this.blocked = {};
        /**
         * Queue of JVM threads that are waiting for a JVM thread to notify them.
         */
        this.waiting = {};
    }
    /**
     * Attempts to acquire the monitor.
     *
     * Thread transitions:
     * * RUNNABLE => BLOCKED [If fails to acquire lock]
     *
     * @param thread The thread that is trying to acquire the monitor.
     * @param cb If this method returns false, then this callback will be
     *   triggered once the thread becomes owner of the monitor. At that time,
     *   the thread will be in the RUNNABLE state.
     * @return True if successfull, false if not. If not successful, the thread
     *   becomes BLOCKED, and the input callback will be triggered once the
     *   thread owns the monitor and is RUNNABLE.
     */
    Monitor.prototype.enter = function (thread, cb) {
        if (this.owner === thread) {
            this.count++;
            return true;
        }
        else {
            return this.contendForLock(thread, 1, enums.ThreadStatus.BLOCKED, cb);
        }
    };
    /**
     * Generic version of Monitor.enter for contending for the lock.
     *
     * Thread transitions:
     * * RUNNABLE => UNINTERRUPTIBLY_BLOCKED [If fails to acquire lock]
     * * RUNNABLE => BLOCKED [If fails to acquire lock]
     *
     * @param thread The thread contending for the lock.
     * @param count The lock count to use once the thread owns the lock.
     * @param blockStatus The ThreadStatus to use should the thread need to
     *   contend for the lock (either BLOCKED or UNINTERRUPTIBLY_BLOCKED).
     * @param cb The callback to call once the thread becomes owner of the lock.
     * @return True if the thread immediately acquired the lock, false if the
     *   thread is now blocked on the lock.
     */
    Monitor.prototype.contendForLock = function (thread, count, blockStatus, cb) {
        var owner = this.owner;
        assert(owner != thread, "Thread attempting to contend for lock it already owns!");
        if (owner === null) {
            assert(this.count === 0);
            this.owner = thread;
            this.count = count;
            return true;
        }
        else {
            /**
             * "If another thread already owns the monitor associated with objectref,
             *  the thread blocks until the monitor's entry count is zero, then tries
             *  again to gain ownership."
             * @from http://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html#jvms-6.5.monitorenter
             */
            this.blocked[thread.getRef()] = { thread: thread, cb: cb, count: count };
            thread.setStatus(blockStatus, this);
            return false;
        }
    };
    /**
     * Exits the monitor. Handles notifying the waiting threads if the lock
     * becomes available.
     *
     * Thread transitions:
     * * *NONE* on the argument thread.
     * * A *BLOCKED* thread may be scheduled if the owner gives up the monitor.
     *
     * @param thread The thread that is exiting the monitor.
     * @return True if exit succeeded, false if an exception occurred.
     */
    Monitor.prototype.exit = function (thread) {
        var owner = this.owner;
        if (owner === thread) {
            if (--this.count === 0) {
                this.owner = null;
                this.appointNewOwner();
            }
        }
        else {
            /**
             * "If the thread that executes monitorexit is not the owner of the
             *  monitor associated with the instance referenced by objectref,
             *  monitorexit throws an IllegalMonitorStateException."
             * @from http://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html#jvms-6.5.monitorexit
             */
            thread.throwNewException('Ljava/lang/IllegalMonitorStateException;', "Cannot exit a monitor that you do not own.");
        }
        return owner === thread;
    };
    /**
     * Chooses one of the blocked threads to become the monitor's owner.
     */
    Monitor.prototype.appointNewOwner = function () {
        var blockedThreadRefs = Object.keys(this.blocked);
        if (blockedThreadRefs.length > 0) {
            // Unblock a random thread.
            var unblockedRef = blockedThreadRefs[Math.floor(Math.random() * blockedThreadRefs.length)], 
            // XXX: Typing hack. Key must be a number.
            unblocked = this.blocked[unblockedRef];
            this.unblock(unblocked.thread, false);
        }
    };
    /**
     * "Causes the current thread to wait until another thread invokes the
     *  notify() method or the notifyAll() method for this object, or some other
     *  thread interrupts the current thread, or a certain amount of real time
     *  has elapsed.
     *
     *  This method causes the current thread (call it T) to place itself in the
     *  wait set for this object and then to relinquish any and all
     *  synchronization claims on this object."
     *
     * We coalesce all possible wait configurations into this one function.
     * @from http://docs.oracle.com/javase/7/docs/api/java/lang/Object.html#wait(long, int)
     * @param thread The thread that wants to wait on this monitor.
     * @param cb The callback triggered once the thread wakes up.
     * @param timeoutMs? An optional timeout that specifies how long the thread
     *   should wait, in milliseconds. If this value is 0, then we ignore it.
     * @param timeoutNs? An optional timeout that specifies how long the thread
     *   should wait, in nanosecond precision (currently ignored).
     * @todo Use high-precision timers in browsers that support it.
     * @return True if the wait succeeded, false if it triggered an exception.
     */
    Monitor.prototype.wait = function (thread, cb, timeoutMs, timeoutNs) {
        var _this = this;
        if (this.getOwner() === thread) {
            // INVARIANT: Thread shouldn't currently be blocked on a monitor.
            assert(thread.getStatus() !== enums.ThreadStatus.BLOCKED);
            this.waiting[thread.getRef()] = {
                thread: thread,
                cb: cb,
                count: this.count,
                isTimed: timeoutMs != null && timeoutMs !== 0
            };
            // Revoke ownership.
            this.owner = null;
            this.count = 0;
            if (timeoutMs != null && timeoutMs !== 0) {
                // Scheduler a timer that wakes up the thread.
                // XXX: Casting to 'number', since NodeJS typings specify a Timer.
                this.waiting[thread.getRef()].timer = setTimeout(function () {
                    _this.unwait(thread, true);
                }, timeoutMs);
                thread.setStatus(enums.ThreadStatus.TIMED_WAITING, this);
            }
            else {
                thread.setStatus(enums.ThreadStatus.WAITING, this);
            }
            // Select a new owner.
            this.appointNewOwner();
            return true;
        }
        else {
            /**
             * "The current thread must own this object's monitor"
             */
            thread.throwNewException('Ljava/lang/IllegalMonitorStateException;', "Cannot wait on an object that you do not own.");
            return false;
        }
    };
    /**
     * Removes the specified thread from the waiting set, and makes it compete
     * for the monitor lock. Once it acquires the lock, we restore its lock
     * count prior to triggering the wait callback.
     *
     * If the thread is interrupted, the wait callback is *not* triggered.
     *
     * @param thread The thread to remove.
     * @param fromTimer Indicates if this function call was triggered from a
     *   timer event.
     * @param [interrupting] If true, then we are *interrupting* the wait. Do not
     *   trigger the wait callback.
     * @param [unwaitCb] If interrupting is true, then this callback is triggered
     *   once the thread reacquires the lock.
     */
    Monitor.prototype.unwait = function (thread, fromTimer, interrupting, unwaitCb) {
        if (interrupting === void 0) { interrupting = false; }
        if (unwaitCb === void 0) { unwaitCb = null; }
        // Step 1: Remove the thread from the waiting set.
        var waitEntry = this.waiting[thread.getRef()], 
        // Interrupting a previously-waiting thread before it acquires a lock
        // makes no semantic sense, as the thread is currently suspended in a
        // synchronized block that requires ownership of the monitor.
        blockStatus = enums.ThreadStatus.UNINTERRUPTABLY_BLOCKED, blockCb = function () {
            // Thread is RUNNABLE before we trigger the callback.
            thread.setStatus(enums.ThreadStatus.RUNNABLE);
            if (interrupting) {
                unwaitCb();
            }
            else {
                waitEntry.cb(fromTimer);
            }
        };
        assert(waitEntry != null);
        delete this.waiting[thread.getRef()];
        // Step 2: Remove the timer if the timer did not trigger this event.
        if (thread.getStatus() === enums.ThreadStatus.TIMED_WAITING && !fromTimer) {
            var timerId = waitEntry.timer;
            assert(timerId != null);
            clearTimeout(timerId);
        }
        // Step 3: Acquire the monitor [ASYNC]
        if (this.contendForLock(thread, waitEntry.count, blockStatus, blockCb)) {
            // Success! Trigger the blockCb anyway. If 'contendForLock' returns false,
            // it will trigger blockCb once the thread acquires the lock.
            blockCb();
        }
    };
    /**
     * Removes the specified thread from being blocked on the monitor so it can
     * re-compete for ownership.
     * @param [interrupting] If true, we are interrupting the monitor block. The
     *   thread should not acquire the lock, and the block callback should not
     *   be triggered.
     */
    Monitor.prototype.unblock = function (thread, interrupting) {
        if (interrupting === void 0) { interrupting = false; }
        var blockEntry = this.blocked[thread.getRef()];
        // Cannot interrupt an uninterruptibly blocked thread.
        assert(interrupting ? thread.getStatus() === enums.ThreadStatus.BLOCKED : true);
        if (blockEntry != null) {
            delete this.blocked[thread.getRef()];
            thread.setStatus(enums.ThreadStatus.RUNNABLE);
            if (!interrupting) {
                // No one else can own the monitor.
                assert(this.owner == null && this.count === 0, "T" + thread.getRef() + ": We're not interrupting a block, but someone else owns the monitor?! Owned by " + (this.owner == null ? "[no one]" : "" + this.owner.getRef()) + " Count: " + this.count);
                // Assign this thread as the monitor owner.
                this.owner = thread;
                this.count = blockEntry.count;
                // Trigger the callback.
                blockEntry.cb();
            }
        }
    };
    /**
     * Notifies a single waiting thread.
     * @param thread The notifying thread. *MUST* be the owner.
     */
    Monitor.prototype.notify = function (thread) {
        if (this.owner === thread) {
            var waitingRefs = Object.keys(this.waiting);
            if (waitingRefs.length > 0) {
                // Notify a random thread.
                this.unwait(this.waiting[waitingRefs[Math.floor(Math.random() * waitingRefs.length)]].thread, false);
            }
        }
        else {
            /**
             * "Throws IllegalMonitorStateException if the current thread is not the
             *  owner of this object's monitor."
             * @from http://docs.oracle.com/javase/7/docs/api/java/lang/Object.html#notify()
             */
            thread.throwNewException('Ljava/lang/IllegalMonitorStateException;', "Cannot notify on a monitor that you do not own.");
        }
    };
    /**
     * Notifies all waiting threads.
     * @param thread The notifying thread. *MUST* be the owner.
     */
    Monitor.prototype.notifyAll = function (thread) {
        if (this.owner === thread) {
            var waitingRefs = Object.keys(this.waiting), i;
            // Notify each thread.
            for (i = 0; i < waitingRefs.length; i++) {
                this.unwait(this.waiting[waitingRefs[i]].thread, false);
            }
        }
        else {
            /**
             * "Throws IllegalMonitorStateException if the current thread is not the
             *  owner of this object's monitor."
             * @from http://docs.oracle.com/javase/7/docs/api/java/lang/Object.html#notifyAll()
             */
            thread.throwNewException('Ljava/lang/IllegalMonitorStateException;', "Cannot notifyAll on a monitor that you do not own.");
        }
    };
    /**
     * @return The owner of the monitor.
     */
    Monitor.prototype.getOwner = function () {
        return this.owner;
    };
    Monitor.prototype.isWaiting = function (thread) {
        // Waiting, but *not* timed waiting.
        return this.waiting[thread.getRef()] != null && !this.waiting[thread.getRef()].isTimed;
    };
    Monitor.prototype.isTimedWaiting = function (thread) {
        // Timed waiting, *not* waiting.
        return this.waiting[thread.getRef()] != null && this.waiting[thread.getRef()].isTimed;
    };
    Monitor.prototype.isBlocked = function (thread) {
        // Blocked.
        return this.blocked[thread.getRef()] != null;
    };
    return Monitor;
})();
module.exports = Monitor;
