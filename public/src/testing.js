"use strict";
var JVM = require('./jvm');
var util = require('./util');
var difflib = require('./difflib');
var path = require('path');
var fs = require('fs');
function makeTestingError(msg, origErr, fatal) {
    var err = new Error(msg);
    err.originalError = origErr;
    err.fatal = fatal;
    return err;
}
/**
 * Captures stdout/stderr.
 * @todo Do this the proper Node way once BFS is more compliant.
 */
var OutputCapturer = (function () {
    function OutputCapturer() {
        this._stdoutWrite = process.stdout.write;
        this._stderrWrite = process.stderr.write;
        this._data = "";
        this._isCapturing = false;
    }
    OutputCapturer.prototype.debugWrite = function (str) {
        this._stdoutWrite.apply(process.stdout, [str, 'utf8']);
    };
    /**
     * Begin capturing output.
     */
    OutputCapturer.prototype.start = function (clear) {
        var _this = this;
        if (this._isCapturing) {
            throw new Error("Already capturing.");
        }
        this._isCapturing = true;
        if (clear) {
            this._data = "";
        }
        process.stderr.write = process.stdout.write = function (data, arg2, arg3) {
            if (typeof (data) !== 'string') {
                // Buffer.
                data = data.toString();
            }
            _this._data += data;
            return true;
        };
    };
    /**
     * Stop capturing output.
     */
    OutputCapturer.prototype.stop = function () {
        if (!this._isCapturing) {
            // May be called twice when there's a catastrophic error.
            return;
        }
        this._isCapturing = false;
        process.stderr.write = this._stderrWrite;
        process.stdout.write = this._stdoutWrite;
    };
    /**
     * Retrieve the captured output.
     * @param clear Clear the captured output.
     */
    OutputCapturer.prototype.getOutput = function (clear) {
        var data = this._data;
        if (clear) {
            this._data = "";
        }
        return data;
    };
    return OutputCapturer;
})();
/**
 * Represents a single unit test, where we compare Doppio's output to the native
 * JVM.
 */
var DoppioTest = (function () {
    function DoppioTest(opts, cls) {
        /**
         * The output capturer for this test.
         */
        this.outputCapturer = new OutputCapturer();
        this.opts = opts;
        if (cls.indexOf('.') !== -1) {
            // Convert foo.bar.Baz => foo/bar/Baz
            cls = util.descriptor2typestr(util.int_classname(cls));
        }
        this.cls = cls;
        this.outFile = path.resolve(opts.doppioHomePath, cls) + ".runout";
    }
    /**
     * Constructs a new JVM for the test.
     */
    DoppioTest.prototype.constructJVM = function (cb) {
        new JVM(util.merge(JVM.getDefaultOptions(this.opts.doppioHomePath), this.opts, {
            classpath: [this.opts.doppioHomePath],
            enableAssertions: true,
            enableSystemAssertions: true
        }), cb);
    };
    /**
     * Runs the unit test.
     */
    DoppioTest.prototype.run = function (registerGlobalErrorTrap, cb) {
        var _this = this;
        var outputCapturer = this.outputCapturer, _jvm = null, terminated = false, jvmConstructHasFinished = false, hasFinished = false;
        registerGlobalErrorTrap(function (err) {
            if (_jvm) {
                try {
                    _jvm.halt(1);
                }
                catch (e) {
                    err.message += "\n\nAdditionally, test runner received the following error while trying to halt the JVM: " + e + (e.stack ? "\n\n" + e.stack : '') + "\n\nOriginal error's stack trace:";
                }
            }
            outputCapturer.stop();
            cb(makeTestingError("Uncaught error. Aborting further tests.\n\t" + err + (err.stack ? "\n\n" + err.stack : ""), err, true));
        });
        this.constructJVM(function (err, jvm) {
            _jvm = jvm;
            if (terminated) {
                // Already handled.
                return;
            }
            if (jvmConstructHasFinished) {
                return cb(makeTestingError("constructJVM returned twice. Aborting further tests.", null, true));
            }
            jvmConstructHasFinished = true;
            if (err) {
                cb(makeTestingError("Could not construct JVM:\n" + err, err));
            }
            else {
                outputCapturer.start(true);
                jvm.runClass(_this.cls, [], function (status) {
                    if (terminated) {
                        // Already handled.
                        return;
                    }
                    outputCapturer.stop();
                    if (hasFinished) {
                        return cb(makeTestingError("JVM triggered completion callback twice. Aborting further tests.", null, true));
                    }
                    hasFinished = true;
                    var actual = outputCapturer.getOutput(true);
                    fs.readFile(_this.outFile, { encoding: 'utf8' }, function (err, expected) {
                        if (err) {
                            cb(makeTestingError("Could not read runout file:\n" + err, err));
                        }
                        else {
                            var diffText = diff(actual, expected), errMsg = null;
                            if (diffText !== null) {
                                errMsg = "Output does not match native JVM.";
                            }
                            cb(errMsg ? makeTestingError(errMsg) : null, actual, expected, diffText);
                        }
                    });
                });
            }
        });
    };
    return DoppioTest;
})();
exports.DoppioTest = DoppioTest;
/**
 * Locate all of Doppio's test classes, and pass them to the callback.
 */
function findTestClasses(doppioDir, cb) {
    var testDir = path.resolve(doppioDir, path.join('classes', 'test'));
    fs.readdir(testDir, function (err, files) {
        if (err) {
            cb([]);
        }
        else {
            cb(files.filter(function (file) { return path.extname(file) === '.java'; })
                .map(function (file) { return path.join('classes', 'test', path.basename(file, '.java')); }));
        }
    });
}
/**
 * Retrieve all of the unit tests.
 */
function getTests(opts, cb) {
    var testClasses = opts.testClasses, tests;
    if (testClasses == null || testClasses.length === 0) {
        // If no test classes are specified, get ALL the tests!
        findTestClasses(opts.doppioHomePath, function (testClasses) {
            opts.testClasses = testClasses;
            getTests(opts, cb);
        });
    }
    else {
        cb(testClasses.map(function (testClass) {
            return new DoppioTest(opts, testClass);
        }));
    }
}
exports.getTests = getTests;
/**
 * Returns a formatted diff between doppioOut and nativeOut.
 * Returns NULL if the strings are identical.
 */
function diff(doppioOut, nativeOut) {
    // @todo Robust to Windows line breaks!
    var doppioLines = doppioOut.split(/\n/), jvmLines = nativeOut.split(/\n/), diff = difflib.text_diff(doppioLines, jvmLines, 2);
    if (diff.length > 0) {
        return 'Doppio | Java\n' + diff.join('\n');
    }
    return null;
}
exports.diff = diff;
/**
 * Run the specified tests.
 */
function runTests(opts, quiet, continueAfterFailure, hideDiffs, registerGlobalErrorTrap, cb) {
    function print(str) {
        if (!quiet) {
            process.stdout.write(str);
        }
    }
    getTests(opts, function (tests) {
        util.asyncForEach(tests, function (test, nextTest) {
            var hasFinished = false;
            print("[" + test.cls + "]: Running... ");
            test.run(registerGlobalErrorTrap, function (err, actual, expected, diff) {
                if (err && !hideDiffs && diff) {
                    err.message += "\n" + diff;
                }
                if (err) {
                    print("fail.\n\t" + err.message + "\n");
                    if (err.originalError && err.originalError.stack) {
                        print(err.stack + "\n");
                    }
                    if (!continueAfterFailure || err['fatal']) {
                        err.message = "Failed " + test.cls + ": " + err.message;
                        nextTest(err);
                    }
                    else {
                        nextTest();
                    }
                }
                else {
                    print("pass.\n");
                    nextTest();
                }
            });
        }, cb);
    });
}
exports.runTests = runTests;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0aW5nLnRzIl0sIm5hbWVzIjpbIm1ha2VUZXN0aW5nRXJyb3IiLCJPdXRwdXRDYXB0dXJlciIsIk91dHB1dENhcHR1cmVyLmNvbnN0cnVjdG9yIiwiT3V0cHV0Q2FwdHVyZXIuZGVidWdXcml0ZSIsIk91dHB1dENhcHR1cmVyLnN0YXJ0IiwiT3V0cHV0Q2FwdHVyZXIuc3RvcCIsIk91dHB1dENhcHR1cmVyLmdldE91dHB1dCIsIkRvcHBpb1Rlc3QiLCJEb3BwaW9UZXN0LmNvbnN0cnVjdG9yIiwiRG9wcGlvVGVzdC5jb25zdHJ1Y3RKVk0iLCJEb3BwaW9UZXN0LnJ1biIsImZpbmRUZXN0Q2xhc3NlcyIsImdldFRlc3RzIiwiZGlmZiIsInJ1blRlc3RzIiwicnVuVGVzdHMucHJpbnQiXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQztBQUNiLElBQU8sR0FBRyxXQUFXLE9BQU8sQ0FBQyxDQUFDO0FBQzlCLElBQU8sSUFBSSxXQUFXLFFBQVEsQ0FBQyxDQUFDO0FBQ2hDLElBQU8sT0FBTyxXQUFXLFdBQVcsQ0FBQyxDQUFDO0FBQ3RDLElBQU8sSUFBSSxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzlCLElBQU8sRUFBRSxXQUFXLElBQUksQ0FBQyxDQUFDO0FBUzFCLDBCQUEwQixHQUFXLEVBQUUsT0FBYSxFQUFFLEtBQWU7SUFDbkVBLElBQUlBLEdBQUdBLEdBQWtCQSxJQUFJQSxLQUFLQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQTtJQUN4Q0EsR0FBR0EsQ0FBQ0EsYUFBYUEsR0FBR0EsT0FBT0EsQ0FBQ0E7SUFDNUJBLEdBQUdBLENBQUNBLEtBQUtBLEdBQUdBLEtBQUtBLENBQUNBO0lBQ2xCQSxNQUFNQSxDQUFDQSxHQUFHQSxDQUFDQTtBQUNiQSxDQUFDQTtBQUVEOzs7R0FHRztBQUNIO0lBQUFDO1FBQ1VDLGlCQUFZQSxHQUFHQSxPQUFPQSxDQUFDQSxNQUFN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QTt3QkFDbkRBLFFBQVFBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBO29CQUNoQkEsQ0FBQ0E7b0JBQUNBLElBQUlBLENBQUNBLENBQUNBO3dCQUNOQSxRQUFRQSxFQUFFQSxDQUFDQTtvQkFDYkEsQ0FBQ0E7Z0JBQ0hBLENBQUNBO2dCQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtvQkFDTkEsS0FBS0EsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0E7b0JBQ2pCQSxRQUFRQSxFQUFFQSxDQUFDQTtnQkFDYkEsQ0FBQ0E7WUFDSEEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDTEEsQ0FBQ0EsRUFBRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0E7SUFDVEEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7QUFDTEEsQ0FBQ0E7QUFuQ2UsZ0JBQVEsV0FtQ3ZCLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCBKVk0gPSByZXF1aXJlKCcuL2p2bScpO1xuaW1wb3J0IHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbmltcG9ydCBkaWZmbGliID0gcmVxdWlyZSgnLi9kaWZmbGliJyk7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmltcG9ydCBmcyA9IHJlcXVpcmUoJ2ZzJyk7XG5pbXBvcnQgaW50ZXJmYWNlcyA9IHJlcXVpcmUoJy4vaW50ZXJmYWNlcycpO1xuaW1wb3J0IGxvZ2dpbmcgPSByZXF1aXJlKCcuL2xvZ2dpbmcnKTtcblxuZXhwb3J0IGludGVyZmFjZSBUZXN0aW5nRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIG9yaWdpbmFsRXJyb3I/OiBhbnk7XG4gIGZhdGFsPzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gbWFrZVRlc3RpbmdFcnJvcihtc2c6IHN0cmluZywgb3JpZ0Vycj86IGFueSwgZmF0YWw/OiBib29sZWFuKTogVGVzdGluZ0Vycm9yIHtcbiAgdmFyIGVyciA9IDxUZXN0aW5nRXJyb3I+IG5ldyBFcnJvcihtc2cpO1xuICBlcnIub3JpZ2luYWxFcnJvciA9IG9yaWdFcnI7XG4gIGVyci5mYXRhbCA9IGZhdGFsO1xuICByZXR1cm4gZXJyO1xufVxuXG4vKipcbiAqIENhcHR1cmVzIHN0ZG91dC9zdGRlcnIuXG4gKiBAdG9kbyBEbyB0aGlzIHRoZSBwcm9wZXIgTm9kZSB3YXkgb25jZSBCRlMgaXMgbW9yZSBjb21wbGlhbnQuXG4gKi9cbmNsYXNzIE91dHB1dENhcHR1cmVyIHtcbiAgcHJpdmF0ZSBfc3Rkb3V0V3JpdGUgPSBwcm9jZXNzLnN0ZG91dC53cml0ZTtcbiAgcHJpdmF0ZSBfc3RkZXJyV3JpdGUgPSBwcm9jZXNzLnN0ZGVyci53cml0ZTtcbiAgcHJpdmF0ZSBfZGF0YTogc3RyaW5nID0gXCJcIjtcbiAgcHJpdmF0ZSBfaXNDYXB0dXJpbmcgPSBmYWxzZTtcblxuICBwcml2YXRlIGRlYnVnV3JpdGUoc3RyOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLl9zdGRvdXRXcml0ZS5hcHBseShwcm9jZXNzLnN0ZG91dCwgW3N0ciwgJ3V0ZjgnXSk7XG4gIH1cblxuICAvKipcbiAgICogQmVnaW4gY2FwdHVyaW5nIG91dHB1dC5cbiAgICovXG4gIHB1YmxpYyBzdGFydChjbGVhcj86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5faXNDYXB0dXJpbmcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQWxyZWFkeSBjYXB0dXJpbmcuYCk7XG4gICAgfVxuICAgIHRoaXMuX2lzQ2FwdHVyaW5nID0gdHJ1ZTtcbiAgICBpZiAoY2xlYXIpIHtcbiAgICAgIHRoaXMuX2RhdGEgPSBcIlwiO1xuICAgIH1cbiAgICBwcm9jZXNzLnN0ZGVyci53cml0ZSA9IHByb2Nlc3Muc3Rkb3V0LndyaXRlID0gKGRhdGE6IGFueSwgYXJnMj86IGFueSwgYXJnMz86IGFueSk6IGJvb2xlYW4gPT4ge1xuICAgICAgaWYgKHR5cGVvZihkYXRhKSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gQnVmZmVyLlxuICAgICAgICBkYXRhID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgfVxuICAgICAgdGhpcy5fZGF0YSArPSBkYXRhO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wIGNhcHR1cmluZyBvdXRwdXQuXG4gICAqL1xuICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2lzQ2FwdHVyaW5nKSB7XG4gICAgICAvLyBNYXkgYmUgY2FsbGVkIHR3aWNlIHdoZW4gdGhlcmUncyBhIGNhdGFzdHJvcGhpYyBlcnJvci5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5faXNDYXB0dXJpbmcgPSBmYWxzZTtcbiAgICBwcm9jZXNzLnN0ZGVyci53cml0ZSA9IHRoaXMuX3N0ZGVycldyaXRlO1xuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlID0gdGhpcy5fc3Rkb3V0V3JpdGU7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGNhcHR1cmVkIG91dHB1dC5cbiAgICogQHBhcmFtIGNsZWFyIENsZWFyIHRoZSBjYXB0dXJlZCBvdXRwdXQuXG4gICAqL1xuICBwdWJsaWMgZ2V0T3V0cHV0KGNsZWFyPzogYm9vbGVhbik6IHN0cmluZyB7XG4gICAgdmFyIGRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIGlmIChjbGVhcikge1xuICAgICAgdGhpcy5fZGF0YSA9IFwiXCI7XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xuICB9XG59XG5cbi8qKlxuICogRG9wcGlvIHRlc3Rpbmcgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZXN0T3B0aW9ucyBleHRlbmRzIGludGVyZmFjZXMuSlZNT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBDbGFzc2VzIHRvIHRlc3QuIEVhY2ggY2FuIGJlIGluIG9uZSBvZiB0aGUgZm9sbG93aW5nIGZvcm1zOlxuICAgKiAtIGZvby5iYXIuQmF6XG4gICAqIC0gZm9vL2Jhci9CYXpcbiAgICovXG4gIHRlc3RDbGFzc2VzPzogc3RyaW5nW107XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHNpbmdsZSB1bml0IHRlc3QsIHdoZXJlIHdlIGNvbXBhcmUgRG9wcGlvJ3Mgb3V0cHV0IHRvIHRoZSBuYXRpdmVcbiAqIEpWTS5cbiAqL1xuZXhwb3J0IGNsYXNzIERvcHBpb1Rlc3Qge1xuICAvKipcbiAgICogVGVzdCBydW5uZXIgb3B0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgb3B0czogVGVzdE9wdGlvbnM7XG4gIC8qKlxuICAgKiBUaGUgY2xhc3MgdG8gdGVzdC5cbiAgICovXG4gIHB1YmxpYyBjbHM6IHN0cmluZztcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIGZpbGUgcmVjb3JkaW5nIHRoZSBvdXRwdXQgZnJvbSB0aGUgbmF0aXZlIEpWTS5cbiAgICovXG4gIHByaXZhdGUgb3V0RmlsZTogc3RyaW5nO1xuICAvKipcbiAgICogVGhlIG91dHB1dCBjYXB0dXJlciBmb3IgdGhpcyB0ZXN0LlxuICAgKi9cbiAgcHJpdmF0ZSBvdXRwdXRDYXB0dXJlcjogT3V0cHV0Q2FwdHVyZXIgPSBuZXcgT3V0cHV0Q2FwdHVyZXIoKTtcblxuICBjb25zdHJ1Y3RvcihvcHRzOiBUZXN0T3B0aW9ucywgY2xzOiBzdHJpbmcpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzO1xuICAgIGlmIChjbHMuaW5kZXhPZignLicpICE9PSAtMSkge1xuICAgICAgLy8gQ29udmVydCBmb28uYmFyLkJheiA9PiBmb28vYmFyL0JhelxuICAgICAgY2xzID0gdXRpbC5kZXNjcmlwdG9yMnR5cGVzdHIodXRpbC5pbnRfY2xhc3NuYW1lKGNscykpO1xuICAgIH1cbiAgICB0aGlzLmNscyA9IGNscztcbiAgICB0aGlzLm91dEZpbGUgPSBwYXRoLnJlc29sdmUob3B0cy5kb3BwaW9Ib21lUGF0aCwgY2xzKSArIFwiLnJ1bm91dFwiO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBuZXcgSlZNIGZvciB0aGUgdGVzdC5cbiAgICovXG4gIHByaXZhdGUgY29uc3RydWN0SlZNKGNiOiAoZXJyOiBhbnksIGp2bT86IEpWTSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBKVk0oPGFueT4gdXRpbC5tZXJnZShKVk0uZ2V0RGVmYXVsdE9wdGlvbnModGhpcy5vcHRzLmRvcHBpb0hvbWVQYXRoKSwgdGhpcy5vcHRzLCB7XG4gICAgICBjbGFzc3BhdGg6IFt0aGlzLm9wdHMuZG9wcGlvSG9tZVBhdGhdLFxuICAgICAgZW5hYmxlQXNzZXJ0aW9uczogdHJ1ZSxcbiAgICAgIGVuYWJsZVN5c3RlbUFzc2VydGlvbnM6IHRydWVcbiAgICB9KSwgY2IpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJ1bnMgdGhlIHVuaXQgdGVzdC5cbiAgICovXG4gIHB1YmxpYyBydW4ocmVnaXN0ZXJHbG9iYWxFcnJvclRyYXA6IChjYjogKGVycjogRXJyb3IpID0+IHZvaWQpID0+IHZvaWQsIGNiOiAoZXJyOiBFcnJvciwgYWN0dWFsPzogc3RyaW5nLCBleHBlY3RlZD86IHN0cmluZywgZGlmZj86IHN0cmluZykgPT4gdm9pZCkge1xuICAgIHZhciBvdXRwdXRDYXB0dXJlciA9IHRoaXMub3V0cHV0Q2FwdHVyZXIsIF9qdm06IEpWTSA9IG51bGwsIHRlcm1pbmF0ZWQ6IGJvb2xlYW4gPSBmYWxzZSwganZtQ29uc3RydWN0SGFzRmluaXNoZWQ6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICAgIGhhc0ZpbmlzaGVkOiBib29sZWFuID0gZmFsc2U7XG4gICAgcmVnaXN0ZXJHbG9iYWxFcnJvclRyYXAoKGVycikgPT4ge1xuICAgICAgaWYgKF9qdm0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBfanZtLmhhbHQoMSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBlcnIubWVzc2FnZSArPSBgXFxuXFxuQWRkaXRpb25hbGx5LCB0ZXN0IHJ1bm5lciByZWNlaXZlZCB0aGUgZm9sbG93aW5nIGVycm9yIHdoaWxlIHRyeWluZyB0byBoYWx0IHRoZSBKVk06ICR7ZX0ke2Uuc3RhY2sgPyBgXFxuXFxuJHtlLnN0YWNrfWAgOiAnJ31cXG5cXG5PcmlnaW5hbCBlcnJvcidzIHN0YWNrIHRyYWNlOmA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG91dHB1dENhcHR1cmVyLnN0b3AoKTtcbiAgICAgIGNiKG1ha2VUZXN0aW5nRXJyb3IoYFVuY2F1Z2h0IGVycm9yLiBBYm9ydGluZyBmdXJ0aGVyIHRlc3RzLlxcblxcdCR7ZXJyfSR7ZXJyLnN0YWNrID8gYFxcblxcbiR7ZXJyLnN0YWNrfWAgOiBgYH1gLCBlcnIsIHRydWUpKTtcbiAgICB9KTtcblxuICAgIHRoaXMuY29uc3RydWN0SlZNKChlcnI6IGFueSwganZtPzogSlZNKSA9PiB7XG4gICAgICBfanZtID0ganZtO1xuICAgICAgaWYgKHRlcm1pbmF0ZWQpIHtcbiAgICAgICAgLy8gQWxyZWFkeSBoYW5kbGVkLlxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoanZtQ29uc3RydWN0SGFzRmluaXNoZWQpIHtcbiAgICAgICAgcmV0dXJuIGNiKG1ha2VUZXN0aW5nRXJyb3IoYGNvbnN0cnVjdEpWTSByZXR1cm5lZCB0d2ljZS4gQWJvcnRpbmcgZnVydGhlciB0ZXN0cy5gLCBudWxsLCB0cnVlKSk7XG4gICAgICB9XG4gICAgICBqdm1Db25zdHJ1Y3RIYXNGaW5pc2hlZCA9IHRydWU7XG5cbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2IobWFrZVRlc3RpbmdFcnJvcihgQ291bGQgbm90IGNvbnN0cnVjdCBKVk06XFxuJHtlcnJ9YCwgZXJyKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRDYXB0dXJlci5zdGFydCh0cnVlKTtcbiAgICAgICAganZtLnJ1bkNsYXNzKHRoaXMuY2xzLCBbXSwgKHN0YXR1czogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgaWYgKHRlcm1pbmF0ZWQpIHtcbiAgICAgICAgICAgIC8vIEFscmVhZHkgaGFuZGxlZC5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgb3V0cHV0Q2FwdHVyZXIuc3RvcCgpO1xuICAgICAgICAgIGlmKGhhc0ZpbmlzaGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gY2IobWFrZVRlc3RpbmdFcnJvcihgSlZNIHRyaWdnZXJlZCBjb21wbGV0aW9uIGNhbGxiYWNrIHR3aWNlLiBBYm9ydGluZyBmdXJ0aGVyIHRlc3RzLmAsIG51bGwsIHRydWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaGFzRmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgICAgdmFyIGFjdHVhbCA9IG91dHB1dENhcHR1cmVyLmdldE91dHB1dCh0cnVlKTtcbiAgICAgICAgICBmcy5yZWFkRmlsZSh0aGlzLm91dEZpbGUsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9LCAoZXJyOiBhbnksIGV4cGVjdGVkPzogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGNiKG1ha2VUZXN0aW5nRXJyb3IoYENvdWxkIG5vdCByZWFkIHJ1bm91dCBmaWxlOlxcbiR7ZXJyfWAsIGVycikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFyIGRpZmZUZXh0ID0gZGlmZihhY3R1YWwsIGV4cGVjdGVkKSwgZXJyTXNnOiBzdHJpbmcgPSBudWxsO1xuICAgICAgICAgICAgICBpZiAoZGlmZlRleHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlcnJNc2cgPSBgT3V0cHV0IGRvZXMgbm90IG1hdGNoIG5hdGl2ZSBKVk0uYDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYihlcnJNc2cgPyBtYWtlVGVzdGluZ0Vycm9yKGVyck1zZykgOiBudWxsLCBhY3R1YWwsIGV4cGVjdGVkLCBkaWZmVGV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogTG9jYXRlIGFsbCBvZiBEb3BwaW8ncyB0ZXN0IGNsYXNzZXMsIGFuZCBwYXNzIHRoZW0gdG8gdGhlIGNhbGxiYWNrLlxuICovXG5mdW5jdGlvbiBmaW5kVGVzdENsYXNzZXMoZG9wcGlvRGlyOiBzdHJpbmcsIGNiOiAoZmlsZXM6IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gIHZhciB0ZXN0RGlyID0gcGF0aC5yZXNvbHZlKGRvcHBpb0RpciwgcGF0aC5qb2luKCdjbGFzc2VzJywgJ3Rlc3QnKSk7XG4gIGZzLnJlYWRkaXIodGVzdERpciwgKGVyciwgZmlsZXMpID0+IHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBjYihbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKGZpbGVzLmZpbHRlcigoZmlsZSkgPT4gcGF0aC5leHRuYW1lKGZpbGUpID09PSAnLmphdmEnKVxuICAgICAgICAgICAgICAubWFwKChmaWxlKSA9PiBwYXRoLmpvaW4oJ2NsYXNzZXMnLCd0ZXN0JywgcGF0aC5iYXNlbmFtZShmaWxlLCAnLmphdmEnKSkpKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKipcbiAqIFJldHJpZXZlIGFsbCBvZiB0aGUgdW5pdCB0ZXN0cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRlc3RzKG9wdHM6IFRlc3RPcHRpb25zLCBjYjogKHRlc3RzOiBEb3BwaW9UZXN0W10pID0+IHZvaWQpOiB2b2lkIHtcbiAgdmFyIHRlc3RDbGFzc2VzID0gb3B0cy50ZXN0Q2xhc3NlcyxcbiAgICB0ZXN0czogRG9wcGlvVGVzdFtdO1xuICBpZiAodGVzdENsYXNzZXMgPT0gbnVsbCB8fCB0ZXN0Q2xhc3Nlcy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBJZiBubyB0ZXN0IGNsYXNzZXMgYXJlIHNwZWNpZmllZCwgZ2V0IEFMTCB0aGUgdGVzdHMhXG4gICAgZmluZFRlc3RDbGFzc2VzKG9wdHMuZG9wcGlvSG9tZVBhdGgsICh0ZXN0Q2xhc3NlcykgPT4ge1xuICAgICAgb3B0cy50ZXN0Q2xhc3NlcyA9IHRlc3RDbGFzc2VzO1xuICAgICAgZ2V0VGVzdHMob3B0cywgY2IpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNiKHRlc3RDbGFzc2VzLm1hcCgodGVzdENsYXNzOiBzdHJpbmcpOiBEb3BwaW9UZXN0ID0+IHtcbiAgICAgIHJldHVybiBuZXcgRG9wcGlvVGVzdChvcHRzLCB0ZXN0Q2xhc3MpO1xuICAgIH0pKTtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgYSBmb3JtYXR0ZWQgZGlmZiBiZXR3ZWVuIGRvcHBpb091dCBhbmQgbmF0aXZlT3V0LlxuICogUmV0dXJucyBOVUxMIGlmIHRoZSBzdHJpbmdzIGFyZSBpZGVudGljYWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaWZmKGRvcHBpb091dDogc3RyaW5nLCBuYXRpdmVPdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIEB0b2RvIFJvYnVzdCB0byBXaW5kb3dzIGxpbmUgYnJlYWtzIVxuICB2YXIgZG9wcGlvTGluZXMgPSBkb3BwaW9PdXQuc3BsaXQoL1xcbi8pLFxuICAgIGp2bUxpbmVzID0gbmF0aXZlT3V0LnNwbGl0KC9cXG4vKSxcbiAgICBkaWZmOiBzdHJpbmdbXSA9IGRpZmZsaWIudGV4dF9kaWZmKGRvcHBpb0xpbmVzLCBqdm1MaW5lcywgMik7XG4gIGlmIChkaWZmLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gJ0RvcHBpbyB8IEphdmFcXG4nICsgZGlmZi5qb2luKCdcXG4nKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBSdW4gdGhlIHNwZWNpZmllZCB0ZXN0cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJ1blRlc3RzKG9wdHM6IFRlc3RPcHRpb25zLCBxdWlldDogYm9vbGVhbiwgY29udGludWVBZnRlckZhaWx1cmU6IGJvb2xlYW4sIGhpZGVEaWZmczogYm9vbGVhbixcbiAgcmVnaXN0ZXJHbG9iYWxFcnJvclRyYXA6IChjYjogKGVycjogRXJyb3IpID0+IHZvaWQpID0+IHZvaWQsIGNiOiAoZXJyPzogVGVzdGluZ0Vycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gIGZ1bmN0aW9uIHByaW50KHN0cjogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFxdWlldCkge1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoc3RyKTtcbiAgICB9XG4gIH1cblxuICBnZXRUZXN0cyhvcHRzLCAodGVzdHMpID0+IHtcbiAgICB1dGlsLmFzeW5jRm9yRWFjaCh0ZXN0cywgKHRlc3Q6IERvcHBpb1Rlc3QsIG5leHRUZXN0OiAoZXJyPzogYW55KSA9PiB2b2lkKSA9PiB7XG4gICAgICB2YXIgaGFzRmluaXNoZWQgPSBmYWxzZTtcbiAgICAgIHByaW50KGBbJHt0ZXN0LmNsc31dOiBSdW5uaW5nLi4uIGApO1xuICAgICAgdGVzdC5ydW4ocmVnaXN0ZXJHbG9iYWxFcnJvclRyYXAsIChlcnI6IFRlc3RpbmdFcnJvciwgYWN0dWFsPzogc3RyaW5nLCBleHBlY3RlZD86IHN0cmluZywgZGlmZj86IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoZXJyICYmICFoaWRlRGlmZnMgJiYgZGlmZikge1xuICAgICAgICAgIGVyci5tZXNzYWdlICs9IGBcXG4ke2RpZmZ9YFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHByaW50KGBmYWlsLlxcblxcdCR7ZXJyLm1lc3NhZ2V9XFxuYCk7XG4gICAgICAgICAgaWYgKGVyci5vcmlnaW5hbEVycm9yICYmIGVyci5vcmlnaW5hbEVycm9yLnN0YWNrKSB7XG4gICAgICAgICAgICBwcmludChgJHtlcnIuc3RhY2t9XFxuYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghY29udGludWVBZnRlckZhaWx1cmUgfHwgKDxUZXN0aW5nRXJyb3I+IGVycilbJ2ZhdGFsJ10pIHtcbiAgICAgICAgICAgIGVyci5tZXNzYWdlID0gYEZhaWxlZCAke3Rlc3QuY2xzfTogJHtlcnIubWVzc2FnZX1gO1xuICAgICAgICAgICAgbmV4dFRlc3QoZXJyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV4dFRlc3QoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJpbnQoYHBhc3MuXFxuYCk7XG4gICAgICAgICAgbmV4dFRlc3QoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSwgY2IpO1xuICB9KTtcbn1cbiJdfQ==