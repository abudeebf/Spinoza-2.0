var enums_1 = require('./enums');
var assert = require('./assert');
/**
 * Manages parked threads and their callbacks.
 */
var Parker = (function () {
    function Parker() {
        this._parkCounts = {};
        this._parkCallbacks = {};
    }
    Parker.prototype.park = function (thread, cb) {
        var ref = thread.getRef();
        assert(!this._parkCallbacks[ref] && thread.getStatus() !== enums_1.ThreadStatus.PARKED, "Thread " + ref + " is doubly parked? Should be impossible.");
        this._parkCallbacks[ref] = cb;
        this._mutateParkCount(thread, 1);
        // It's possible the thread was instantly unparked due to a previously
        // unbalancing park.
        if (this.isParked(thread)) {
            thread.setStatus(enums_1.ThreadStatus.PARKED);
        }
    };
    Parker.prototype.unpark = function (thread) {
        this._mutateParkCount(thread, -1);
    };
    Parker.prototype.completelyUnpark = function (thread) {
        var ref = thread.getRef(), count = this._parkCounts[ref];
        if (count) {
            this._mutateParkCount(thread, -count);
        }
    };
    Parker.prototype._mutateParkCount = function (thread, delta) {
        var ref = thread.getRef(), cb;
        // Initialize park count.
        if (!this._parkCounts[ref]) {
            this._parkCounts[ref] = 0;
        }
        if (0 === (this._parkCounts[ref] += delta)) {
            assert(!!this._parkCallbacks[ref], "Balancing unpark for thread " + ref + " with no callback? Should be impossible.");
            cb = this._parkCallbacks[ref];
            // Cleanup.
            delete this._parkCounts[ref];
            delete this._parkCallbacks[ref];
            // Avoid situations where a terminated thread's timeout wakes up
            // and tries to revive its thread.
            if (thread.getStatus() === enums_1.ThreadStatus.PARKED) {
                thread.setStatus(enums_1.ThreadStatus.ASYNC_WAITING);
                cb();
            }
        }
    };
    Parker.prototype.isParked = function (thread) {
        return !!this._parkCounts[thread.getRef()];
    };
    return Parker;
})();
module.exports = Parker;
