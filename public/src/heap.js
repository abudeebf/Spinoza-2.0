// A power-of-two segregated freelist "heap",
// for explicit memory management into a buffer.
// by Emery Berger, www.cs.umass.edu/~emery
"use strict";
var Heap = (function () {
    // size = total amount of memory for the heap.
    function Heap(size) {
        this.size = size;
        // A map of size classes per chunk (see above).
        this._sizeMap = {};
        this._buffer = new Buffer(size);
        this._remaining = size; // the whole thing is available.
        this._offset = 0; // start of the buffer.
        // Initialize the freelists.
        this._freeLists = new Array(Heap._numSizeClasses);
        for (var i = 0; i < Heap._numSizeClasses; i++) {
            this._freeLists[i] = [];
        }
    }
    // Allocate size bytes, returning the "address".
    Heap.prototype.malloc = function (size) {
        // if size is less than a word, round it up to a word (4 bytes).
        if (size <= 4) {
            size = 4;
        }
        // if we are out of memory, throw an exception.
        if (this._remaining < size) {
            // TODO: could actually scan larger freelists to see if there's
            // free memory there.
            throw "out of memory";
        }
        // compute the size class.
        var addr;
        var cl;
        cl = Heap.size_to_class(size);
        addr = this._freeLists[cl].pop();
        // if there's no more memory, get some.
        if (addr === undefined) {
            addr = this.refill(cl);
        }
        return addr;
    };
    // Deallocate memory.
    Heap.prototype.free = function (addr) {
        // push this address onto the appropriate freelist.
        // first, mask the address.
        var masked = addr & ~(Heap._chunkSize - 1);
        // next, look up the class using the masked address.
        var cl = this._sizeMap[masked];
        // finally, push onto the appropriate free list.
        // TODO: for sanity, we could check to see if this was *really* freed
        // and drop it if not.
        this._freeLists[cl].push(addr);
    };
    // Store a word (32-bits) at this address.
    Heap.prototype.store_word = function (addr, value) {
        // TODO: add sanity checks?
        this._buffer.writeInt32LE(value, addr);
    };
    // Access a byte at this location.
    Heap.prototype.get_byte = function (addr) {
        // TODO: add sanity checks?
        return this._buffer.readUInt8(addr);
    };
    Heap.prototype.get_word = function (addr) {
        return this._buffer.readInt32LE(addr);
    };
    Heap.prototype.get_buffer = function (addr, len) {
        return this._buffer.slice(addr, addr + len);
    };
    Heap.prototype.get_signed_byte = function (addr) {
        return this._buffer.readInt8(addr);
    };
    Heap.prototype.set_byte = function (addr, value) {
        this._buffer.writeUInt8(value, addr);
    };
    Heap.prototype.set_signed_byte = function (addr, value) {
        this._buffer.writeInt8(value, addr);
    };
    /**
     * Copy len bytes from srcAddr to dstAddr.
     */
    Heap.prototype.memcpy = function (srcAddr, dstAddr, len) {
        this._buffer.copy(this._buffer, dstAddr, srcAddr, srcAddr + len);
    };
    // Get more memory for a particular size class.
    Heap.prototype.refill = function (cl) {
        // Get the largest size for this class.
        var sz = this.cl_to_size(cl);
        // Figure out how many objects we are going to "allocate".
        var count = Math.floor(Heap._chunkSize / sz);
        if (count < 1) {
            count = 1;
        }
        // Now store the size class *for the first object* only.
        // We will later look up this object via "pointer arithmetic".
        var addr = this._offset;
        this._sizeMap[addr] = cl;
        // Add each one to the freelist.
        for (var i = 0; i < count; i++) {
            this._remaining -= sz;
            addr = this._offset;
            this._freeLists[cl].push(addr);
            this._offset += sz;
        }
        return addr;
    };
    // Computes ceil(log2(num)).
    Heap.ilog2 = function (num) {
        var log2 = 0;
        var value = 1;
        while (value < num) {
            value <<= (1);
            log2++;
        }
        return (log2);
    };
    // power-of-two size classes (just a ref to ilog2).
    Heap.size_to_class = function (size) {
        return Heap.ilog2(size);
    };
    // see above: classes are just powers of two.
    Heap.prototype.cl_to_size = function (cl) {
        return (1 << cl);
    };
    // The total number of size classes.
    Heap._numSizeClasses = 64; // way more than we'll ever need.
    // How much to grab at one time.
    Heap._chunkSize = 4096; // should be a power of two.
    return Heap;
})();
module.exports = Heap;
