"use strict";
var gLong = require('./gLong');
var assert = require('./assert');
/**
 * A ByteStream, implemented using a NodeBuffer.
 */
var ByteStream = (function () {
    function ByteStream(buffer) {
        this.buffer = buffer;
        this._index = 0;
    }
    /**
     * Returns the current read index, and increments the index by the indicated
     * amount.
     */
    ByteStream.prototype.incIndex = function (inc) {
        var readIndex = this._index;
        this._index += inc;
        return readIndex;
    };
    ByteStream.prototype.rewind = function () {
        this._index = 0;
    };
    ByteStream.prototype.seek = function (idx) {
        assert(idx >= 0 && idx < this.buffer.length, "Invalid seek position.");
        this._index = idx;
    };
    ByteStream.prototype.pos = function () {
        return this._index;
    };
    ByteStream.prototype.skip = function (bytesCount) {
        this._index += bytesCount;
    };
    ByteStream.prototype.hasBytes = function () {
        return this._index < this.buffer.length;
    };
    ByteStream.prototype.getFloat = function () {
        return this.buffer.readFloatBE(this.incIndex(4));
    };
    ByteStream.prototype.getDouble = function () {
        return this.buffer.readDoubleBE(this.incIndex(8));
    };
    ByteStream.prototype.getUint = function (byteCount) {
        switch (byteCount) {
            case 1:
                return this.getUint8();
            case 2:
                return this.getUint16();
            case 4:
                return this.getUint32();
            default:
                throw new Error("Invalid byte count for getUint: " + byteCount);
        }
    };
    ByteStream.prototype.getInt = function (byteCount) {
        switch (byteCount) {
            case 1:
                return this.getInt8();
            case 2:
                return this.getInt16();
            case 4:
                return this.getInt32();
            default:
                throw new Error("Invalid byte count for getUint: " + byteCount);
        }
    };
    ByteStream.prototype.getUint8 = function () {
        return this.buffer.readUInt8(this.incIndex(1));
    };
    ByteStream.prototype.getUint16 = function () {
        return this.buffer.readUInt16BE(this.incIndex(2));
    };
    ByteStream.prototype.getUint32 = function () {
        return this.buffer.readUInt32BE(this.incIndex(4));
    };
    ByteStream.prototype.getInt8 = function () {
        return this.buffer.readInt8(this.incIndex(1));
    };
    ByteStream.prototype.getInt16 = function () {
        return this.buffer.readInt16BE(this.incIndex(2));
    };
    ByteStream.prototype.getInt32 = function () {
        return this.buffer.readInt32BE(this.incIndex(4));
    };
    ByteStream.prototype.getInt64 = function () {
        var high = this.getUint32();
        var low = this.getUint32();
        return gLong.fromBits(low, high);
    };
    ByteStream.prototype.read = function (bytesCount) {
        var rv = this.buffer.slice(this._index, this._index + bytesCount);
        this._index += bytesCount;
        return rv;
    };
    ByteStream.prototype.peek = function () {
        return this.buffer.readUInt8(this._index);
    };
    ByteStream.prototype.size = function () {
        return this.buffer.length - this._index;
    };
    ByteStream.prototype.slice = function (len) {
        var arr = new ByteStream(this.buffer.slice(this._index, this._index + len));
        this._index += len;
        return arr;
    };
    ByteStream.prototype.getBuffer = function () {
        return this.buffer;
    };
    return ByteStream;
})();
module.exports = ByteStream;
