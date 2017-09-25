var enums_1 = require('./enums');
var assert = require('./assert');
/**
 * Checks if the given thread status indicates that the thread is scheduleable.
 */
function isRunnable(status) {
    return status === enums_1.ThreadStatus.RUNNABLE;
}
/**
 * A Weighted Round Robin thread scheduler.
 */
var WeightedRoundRobinScheduler = (function () {
    function WeightedRoundRobinScheduler() {
        // Number of quanta given to the current thread.
        this._count = 0;
        // The queue of threads.
        this._queue = [];
        // Read by runThread. Used as a lock.
        this._threadScheduled = false;
    }
    WeightedRoundRobinScheduler.prototype.scheduleThread = function (thread) {
        this._queue.push(thread);
        if (this._queue.length === 1) {
            // There aren't any threads running. Run this thread.
            this.runThread();
        }
    };
    /**
     * Run the thread at the head of the queue.
     */
    WeightedRoundRobinScheduler.prototype.runThread = function () {
        var _this = this;
        if (this._threadScheduled) {
            return;
        }
        this._threadScheduled = true;
        setImmediate(function () {
            var queue = _this._queue;
            _this._threadScheduled = false;
            if (queue.length > 0) {
                var thread = _this._queue[0];
                assert(thread.getStatus() === enums_1.ThreadStatus.RUNNABLE, "Attempted to run non-runnable thread.");
                thread.run();
            }
        });
    };
    WeightedRoundRobinScheduler.prototype.unscheduleThread = function (thread) {
        var queue = this._queue;
        var isRunningThread = queue[0] === thread;
        assert(queue.indexOf(thread) > -1, "Tried to unschedule thread that was not scheduled.");
        // Remove thread from queue.
        if (isRunningThread) {
            queue.shift();
            this._count = 0;
            // Schedule the next thread.
            this.runThread();
        }
        else {
            queue.splice(queue.indexOf(thread), 1);
        }
    };
    WeightedRoundRobinScheduler.prototype.getRunningThread = function () {
        var queue = this._queue;
        if (queue.length > 0) {
            return queue[0];
        }
        else {
            return null;
        }
    };
    WeightedRoundRobinScheduler.prototype.priorityChange = function (thread) {
        // Not important for the algorithm. We'll pick up the change
        // next time we schedule.
    };
    WeightedRoundRobinScheduler.prototype.quantumOver = function (thread) {
        assert(this._queue[0] === thread, "A non-running thread has an expired quantum?");
        this._count++;
        if (this._count >= thread.getPriority() || thread.getStatus() !== enums_1.ThreadStatus.RUNNABLE) {
            // Move to back of queue, reset count.
            this._count = 0;
            this._queue.push(this._queue.shift());
        }
        // Schedule the next thread.
        this.runThread();
    };
    return WeightedRoundRobinScheduler;
})();
/**
 * Represents a thread pool. Handles scheduling duties.
 */
var ThreadPool = (function () {
    function ThreadPool(emptyCallback) {
        this.threads = [];
        this.scheduler = new WeightedRoundRobinScheduler();
        this.emptyCallback = emptyCallback;
    }
    /**
     * Retrieve all of the threads in the thread pool.
     */
    ThreadPool.prototype.getThreads = function () {
        // Return a copy of our internal array.
        return this.threads.slice(0);
    };
    /**
     * Checks if any remaining threads are non-daemonic and could be runnable.
     * If not, we can terminate execution.
     *
     * This check is invoked each time a thread terminates.
     */
    ThreadPool.prototype.anyNonDaemonicThreads = function () {
        for (var i = 0; i < this.threads.length; i++) {
            var t = this.threads[i];
            if (t.isDaemon()) {
                continue;
            }
            var status_1 = t.getStatus();
            if (status_1 !== enums_1.ThreadStatus.NEW &&
                status_1 !== enums_1.ThreadStatus.TERMINATED) {
                return true;
            }
        }
        return false;
    };
    ThreadPool.prototype.threadTerminated = function (thread) {
        var idx = this.threads.indexOf(thread);
        assert(idx >= 0);
        // Remove the specified thread from the threadpool.
        this.threads.splice(idx, 1);
        if (!this.anyNonDaemonicThreads()) {
            this.emptyCallback();
        }
    };
    /**
     * Called when a thread's status changes.
     */
    ThreadPool.prototype.statusChange = function (thread, oldStatus, newStatus) {
        var wasRunnable = isRunnable(oldStatus), nowRunnable = isRunnable(newStatus);
        if (oldStatus === enums_1.ThreadStatus.NEW || oldStatus === enums_1.ThreadStatus.TERMINATED) {
            if (this.threads.indexOf(thread) === -1) {
                this.threads.push(thread);
            }
        }
        // Inform scheduling algorithm if thread changes from runnable => unrunnable, or unrunnable => runnable.
        if (wasRunnable !== nowRunnable) {
            if (wasRunnable) {
                this.scheduler.unscheduleThread(thread);
            }
            else {
                this.scheduler.scheduleThread(thread);
            }
        }
        if (newStatus === enums_1.ThreadStatus.TERMINATED) {
            this.threadTerminated(thread);
        }
    };
    /**
     * Called when a thread's priority changes.
     */
    ThreadPool.prototype.priorityChange = function (thread) {
        this.scheduler.priorityChange(thread);
    };
    /**
     * Called when a thread's quantum is over.
     */
    ThreadPool.prototype.quantumOver = function (thread) {
        this.scheduler.quantumOver(thread);
    };
    return ThreadPool;
})();
exports["default"] = ThreadPool;
