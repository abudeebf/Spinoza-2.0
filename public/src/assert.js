/**
 * Checks the given assertion. Throws an error if it fails.
 */
function assert(assertion, msg, thread) {
    if (!assertion) {
        throw new Error("Assertion failed: " + msg + "\n" + (thread ? thread.getPrintableStackTrace() : ''));
    }
}
module.exports = assert;
