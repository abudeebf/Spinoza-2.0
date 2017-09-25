/**
 * A single class lock, used for load/initialization locks.
 */
var ClassLock = (function () {
    function ClassLock() {
        this.queue = [];
    }
    /**
     * Checks if the lock is taken. If so, it enqueues the callback. Otherwise,
     * it takes the lock and returns true.
     */
    ClassLock.prototype.tryLock = function (thread, cb) {
        // We're the owner if the queue was previously empty.
        return this.queue.push({ thread: thread, cb: cb }) === 1;
    };
    /**
     * Releases the lock on the class, and passes the object to all enqueued
     * callbacks.
     */
    ClassLock.prototype.unlock = function (cdata) {
        var i, num = this.queue.length;
        for (i = 0; i < num; i++) {
            this.queue[i].cb(cdata);
        }
        this.queue = [];
    };
    /**
     * Get the owner of this lock.
     */
    ClassLock.prototype.getOwner = function () {
        if (this.queue.length > 0) {
            return this.queue[0].thread;
        }
        return null;
    };
    return ClassLock;
})();
module.exports = ClassLock;
