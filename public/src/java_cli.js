var option_parser_1 = require('./option_parser');
var JVM = require('./jvm');
var util = require('./util');
var logging = require('./logging');
var parser = new option_parser_1.OptionParser({
    default: {
        classpath: {
            type: 3 /* NORMAL_VALUE_SYNTAX */,
            alias: 'cp',
            optDesc: ' <class search path of directories and zip/jar files>',
            desc: 'A : separated list of directories, JAR archives, and ZIP archives to search for class files.'
        },
        D: {
            type: 4 /* MAP_SYNTAX */,
            optDesc: '<name>=<value>',
            desc: 'set a system property'
        },
        jar: {
            type: 3 /* NORMAL_VALUE_SYNTAX */,
            stopParsing: true
        },
        help: { alias: '?', desc: 'print this help message' },
        X: { desc: 'print help on non-standard options' },
        enableassertions: {
            type: 2 /* COLON_VALUE_OR_FLAG_SYNTAX */,
            optDesc: '[:<packagename>...|:<classname>]',
            alias: 'ea',
            desc: 'enable assertions with specified granularity'
        },
        disableassertions: {
            type: 2 /* COLON_VALUE_OR_FLAG_SYNTAX */,
            optDesc: '[:<packagename>...|:<classname>]',
            alias: 'da',
            desc: 'disable assertions with specified granularity'
        },
        enablesystemassertions: { alias: 'esa', desc: 'enable system assertions' },
        disablesystemassertions: { alias: 'dsa', desc: 'disable system assertions ' }
    },
    X: {
        log: {
            desc: 'log level, [0-10]|vtrace|trace|debug|error',
            type: 3 /* NORMAL_VALUE_SYNTAX */
        },
        'vtrace-methods': {
            type: 3 /* NORMAL_VALUE_SYNTAX */,
            optDesc: ' <java/lang/Object/getHashCode()I:...>',
            desc: 'specify particular methods to vtrace separated by colons'
        },
        'list-class-cache': {
            desc: 'list all of the bootstrap loaded classes after execution'
        },
        'dump-compiled-code': {
            type: 3 /* NORMAL_VALUE_SYNTAX */,
            optDesc: ' <directory>',
            desc: 'location to dump compiled object definitions'
        },
        // TODO: Use -Djava.library.path
        'native-classpath': {
            type: 3 /* NORMAL_VALUE_SYNTAX */,
            optDesc: ' <class search path of directories>',
            desc: 'A : separated list of directories to search for native mathods in JS files.'
        },
        'bootclasspath/a': {
            type: 1 /* COLON_VALUE_SYNTAX */,
            optDesc: ':<directories and zip/jar files separated by :>',
            desc: 'append to end of bootstrap class path'
        },
        'bootclasspath/p': {
            type: 1 /* COLON_VALUE_SYNTAX */,
            optDesc: ':<directories and zip/jar files separated by :>',
            desc: 'prepend in front of bootstrap class path'
        },
        'bootclasspath': {
            type: 1 /* COLON_VALUE_SYNTAX */,
            optDesc: ':<directories and zip/jar files separated by :>',
            desc: 'set search path for bootstrap classes and resources'
        }
    }
});
/**
 * Consumes a `java` command line string. Constructs a JVM, launches the command, and
 * returns the JVM object. Throws an exception if parsing fails.
 *
 * Returns `null` if no JVM needed to be constructed (e.g. -h flag).
 *
 * @param args Arguments to the 'java' command.
 * @param opts Default options.
 * @param doneCb Called when JVM execution finishes. Passes a
 *   number to the callback indicating the exit value.
 * @param [jvmStarted] Called with the JVM object once we have invoked it.
 */
function java(args, opts, doneCb, jvmStarted) {
    if (jvmStarted === void 0) { jvmStarted = function (jvm) { }; }
    var parsedArgs = parser.parse(args), standard = parsedArgs['default'], nonStandard = parsedArgs['X'], jvmState;
    // System properties.
    opts.properties = standard.mapOption('D');
    if (standard.flag('help', false)) {
        return printHelp(opts.launcherName, parser.help('default'), doneCb, 0);
    }
    else if (standard.flag('X', false)) {
        return printNonStandardHelp(opts.launcherName, parser.help('X'), doneCb, 0);
    }
    // GLOBAL CONFIGURATION
    var logOption = nonStandard.stringOption('log', 'ERROR');
    if (/^[0-9]+$/.test(logOption)) {
        logging.log_level = parseInt(logOption, 10);
    }
    else {
        var level = logging[logOption.toUpperCase()];
        if (level == null) {
            process.stderr.write("Unrecognized log level: " + logOption + ".");
            return printHelp(opts.launcherName, parser.help('default'), doneCb, 1);
        }
        logging.log_level = level;
    }
    if (nonStandard.flag('list-class-cache', false)) {
        // Redefine done_cb so we print the loaded class files on JVM exit.
        doneCb = (function (old_done_cb) {
            return function (result) {
                var fpaths = jvmState.getBootstrapClassLoader().getLoadedClassFiles();
                process.stdout.write(fpaths.join('\n') + '\n');
                old_done_cb(result);
            };
        })(doneCb);
    }
    if (standard.flag('enablesystemassertions', false)) {
        opts.enableSystemAssertions = true;
    }
    if (standard.flag('disablesystemassertions', false)) {
        opts.enableSystemAssertions = false;
    }
    if (standard.flag('enableassertions', false)) {
        opts.enableAssertions = true;
    }
    else if (standard.stringOption('enableassertions', null)) {
        opts.enableAssertions = standard.stringOption('enableassertions', null).split(':');
    }
    if (standard.stringOption('disableassertions', null)) {
        opts.disableAssertions = standard.stringOption('disableassertions', null).split(':');
    }
    // NOTE: Boolean form of -disableassertions is a NOP.
    // Bootstrap classpath items.
    var bscl = nonStandard.stringOption('bootclasspath', null);
    if (bscl !== null) {
        opts.bootstrapClasspath = bscl.split(':');
    }
    var bsClAppend = nonStandard.stringOption('bootclasspath/a', null);
    if (bsClAppend) {
        opts.bootstrapClasspath = opts.bootstrapClasspath.concat(bsClAppend.split(':'));
    }
    var bsClPrepend = nonStandard.stringOption('bootclasspath/p', null);
    if (bsClPrepend) {
        opts.bootstrapClasspath = bsClPrepend.split(':').concat(opts.bootstrapClasspath);
    }
    // User-supplied classpath items.
    if (!opts.classpath) {
        opts.classpath = [];
    }
    if (standard.stringOption('jar', null)) {
        opts.classpath.push(standard.stringOption('jar', null));
    }
    else if (standard.stringOption('classpath', null)) {
        opts.classpath = opts.classpath.concat(standard.stringOption('classpath', null).split(':'));
    }
    else {
        // DEFAULT: If no user-supplied classpath, add the current directory to
        // the class path.
        opts.classpath.push(process.cwd());
    }
    // User-supplied native classpath.
    var nativeClasspath = standard.stringOption('native-classpath', null);
    if (nativeClasspath) {
        opts.nativeClasspath = opts.nativeClasspath.concat(nativeClasspath.split(':'));
    }
    // Construct the JVM.
    jvmState = new JVM(opts, function (err) {
        if (err) {
            process.stderr.write("Error constructing JVM:\n");
            process.stderr.write(err.toString() + "\n");
            doneCb(1);
        }
        else {
            launchJvm(standard, opts, jvmState, doneCb, jvmStarted);
        }
    });
    var vtraceMethods = nonStandard.stringOption('vtrace-methods', null);
    if (vtraceMethods) {
        vtraceMethods.split(':').forEach(function (m) { return jvmState.vtraceMethod(m); });
    }
    var dumpCompiledCode = nonStandard.stringOption('dumpCompiledCode', null);
    if (dumpCompiledCode) {
        jvmState.dumpCompiledCode(dumpCompiledCode);
    }
}
/**
 * Consumes a fully-configured JVM, parsed arguments, and a callback.
 * Figures out from this how to launch the JVM (e.g. using a JAR file or a
 * particular class).
 */
function launchJvm(standardOptions, opts, jvmState, doneCb, jvmStarted) {
    var mainArgs = standardOptions.unparsedArgs();
    if (standardOptions.stringOption('jar', null)) {
        jvmState.runJar(mainArgs, doneCb);
        jvmStarted(jvmState);
    }
    else if (mainArgs.length > 0) {
        var cname = mainArgs[0];
        if (cname.slice(-6) === '.class') {
            cname = cname.slice(0, -6);
        }
        if (cname.indexOf('.') !== -1) {
            // hack: convert java.foo.Bar to java/foo/Bar
            cname = util.descriptor2typestr(util.int_classname(cname));
        }
        jvmState.runClass(cname, mainArgs.slice(1), doneCb);
        jvmStarted(jvmState);
    }
    else {
        // No class specified, no jar specified!
        printHelp(opts.launcherName, parser.help('default'), doneCb, 0);
    }
}
function printHelp(launcherName, str, doneCb, rv) {
    process.stdout.write("Usage: " + launcherName + " [-options] class [args...]\n        (to execute a class)\nor  " + launcherName + " [-options] -jar jarfile [args...]\n        (to execute a jar file)\nwhere options include:\n" + str);
    doneCb(rv);
}
function printNonStandardHelp(launcherName, str, doneCb, rv) {
    process.stdout.write(str + "\n\nThe -X options are non-standard and subject to change without notice.\n");
    doneCb(rv);
}
module.exports = java;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YV9jbGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvamF2YV9jbGkudHMiXSwibmFtZXMiOlsiamF2YSIsImxhdW5jaEp2bSIsInByaW50SGVscCIsInByaW50Tm9uU3RhbmRhcmRIZWxwIl0sIm1hcHBpbmdzIjoiQUFBQSw4QkFBeUQsaUJBQWlCLENBQUMsQ0FBQTtBQUMzRSxJQUFPLEdBQUcsV0FBVyxPQUFPLENBQUMsQ0FBQztBQUM5QixJQUFPLElBQUksV0FBVyxRQUFRLENBQUMsQ0FBQztBQUNoQyxJQUFPLE9BQU8sV0FBVyxXQUFXLENBQUMsQ0FBQztBQUd0QyxJQUFJLE1BQU0sR0FBRyxJQUFJLDRCQUFZLENBQUM7SUFDNUIsT0FBTyxFQUFFO1FBQ1AsU0FBUyxFQUFFO1lBQ1QsSUFBSSxFQUFFLDJCQUE2QjtZQUNuQyxLQUFLLEVBQUUsSUFBSTtZQUNYLE9BQU8sRUFBRSx1REFBdUQ7WUFDaEUsSUFBSSxFQUFFLDhGQUE4RjtTQUNyRztRQUNELENBQUMsRUFBRTtZQUNELElBQUksRUFBRSxrQkFBb0I7WUFDMUIsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixJQUFJLEVBQUUsdUJBQXVCO1NBQzlCO1FBQ0QsR0FBRyxFQUFFO1lBQ0gsSUFBSSxFQUFFLDJCQUE2QjtZQUNuQyxXQUFXLEVBQUUsSUFBSTtTQUNsQjtRQUNELElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1FBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxvQ0FBb0MsRUFBRTtRQUNqRCxnQkFBZ0IsRUFBRTtZQUNoQixJQUFJLEVBQUUsa0NBQW9DO1lBQzFDLE9BQU8sRUFBRSxrQ0FBa0M7WUFDM0MsS0FBSyxFQUFFLElBQUk7WUFDWCxJQUFJLEVBQUUsOENBQThDO1NBQ3JEO1FBQ0QsaUJBQWlCLEVBQUU7WUFDakIsSUFBSSxFQUFFLGtDQUFvQztZQUMxQyxPQUFPLEVBQUUsa0NBQWtDO1lB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Q0FBQ0EsR0FBR0EsQ0FBQ0EsQ0FBQ0EsTUFBTUEsQ0FBQ0EsSUFBSUEsQ0FBQ0Esa0JBQWtCQSxDQUFDQSxDQUFDQTtJQUNuRkEsQ0FBQ0E7SUFFREEsaUNBQWlDQTtJQUNqQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDcEJBLElBQUlBLENBQUNBLFNBQVNBLEdBQUdBLEVBQUVBLENBQUNBO0lBQ3RCQSxDQUFDQTtJQUVEQSxFQUFFQSxDQUFDQSxDQUFDQSxRQUFRQSxDQUFDQSxZQUFZQSxDQUFDQSxLQUFLQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUN2Q0EsSUFBSUEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsWUFBWUEsQ0FBQ0EsS0FBS0EsRUFBRUEsSUFBSUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7SUFDMURBLENBQUNBO0lBQUNBLElBQUlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLFFBQVFBLENBQUNBLFlBQVlBLENBQUNBLFdBQVdBLEVBQUVBLElBQUlBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ3BEQSxJQUFJQSxDQUFDQSxTQUFTQSxHQUFHQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxNQUFNQSxDQUFDQSxRQUFRQSxDQUFDQSxZQUFZQSxDQUFDQSxXQUFXQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQSxLQUFLQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQSxDQUFDQTtJQUM5RkEsQ0FBQ0E7SUFBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7UUFDTkEsdUVBQXVFQTtRQUN2RUEsa0JBQWtCQTtRQUNsQkEsSUFBSUEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsR0FBR0EsRUFBRUEsQ0FBQ0EsQ0FBQ0E7SUFDckNBLENBQUNBO0lBRURBLGtDQUFrQ0E7SUFDbENBLElBQUlBLGVBQWVBLEdBQUdBLFFBQVFBLENBQUNBLFlBQVlBLENB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QTtJQUMxR0EsTUFBTUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0E7QUFDYkEsQ0FBQ0E7QUFFRCxpQkFBUyxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge09wdGlvblBhcnNlciwgUGFyc2VUeXBlLCBQcmVmaXhQYXJzZVJlc3VsdH0gZnJvbSAnLi9vcHRpb25fcGFyc2VyJztcbmltcG9ydCBKVk0gPSByZXF1aXJlKCcuL2p2bScpO1xuaW1wb3J0IHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbmltcG9ydCBsb2dnaW5nID0gcmVxdWlyZSgnLi9sb2dnaW5nJyk7XG5pbXBvcnQge0pWTUNMSU9wdGlvbnN9IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5cbmxldCBwYXJzZXIgPSBuZXcgT3B0aW9uUGFyc2VyKHtcbiAgZGVmYXVsdDoge1xuICAgIGNsYXNzcGF0aDoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLk5PUk1BTF9WQUxVRV9TWU5UQVgsXG4gICAgICBhbGlhczogJ2NwJyxcbiAgICAgIG9wdERlc2M6ICcgPGNsYXNzIHNlYXJjaCBwYXRoIG9mIGRpcmVjdG9yaWVzIGFuZCB6aXAvamFyIGZpbGVzPicsXG4gICAgICBkZXNjOiAnQSA6IHNlcGFyYXRlZCBsaXN0IG9mIGRpcmVjdG9yaWVzLCBKQVIgYXJjaGl2ZXMsIGFuZCBaSVAgYXJjaGl2ZXMgdG8gc2VhcmNoIGZvciBjbGFzcyBmaWxlcy4nLFxuICAgIH0sXG4gICAgRDoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLk1BUF9TWU5UQVgsXG4gICAgICBvcHREZXNjOiAnPG5hbWU+PTx2YWx1ZT4nLFxuICAgICAgZGVzYzogJ3NldCBhIHN5c3RlbSBwcm9wZXJ0eSdcbiAgICB9LFxuICAgIGphcjoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLk5PUk1BTF9WQUxVRV9TWU5UQVgsXG4gICAgICBzdG9wUGFyc2luZzogdHJ1ZVxuICAgIH0sXG4gICAgaGVscDogeyBhbGlhczogJz8nLCBkZXNjOiAncHJpbnQgdGhpcyBoZWxwIG1lc3NhZ2UnIH0sXG4gICAgWDogeyBkZXNjOiAncHJpbnQgaGVscCBvbiBub24tc3RhbmRhcmQgb3B0aW9ucycgfSxcbiAgICBlbmFibGVhc3NlcnRpb25zOiB7XG4gICAgICB0eXBlOiBQYXJzZVR5cGUuQ09MT05fVkFMVUVfT1JfRkxBR19TWU5UQVgsXG4gICAgICBvcHREZXNjOiAnWzo8cGFja2FnZW5hbWU+Li4ufDo8Y2xhc3NuYW1lPl0nLFxuICAgICAgYWxpYXM6ICdlYScsXG4gICAgICBkZXNjOiAnZW5hYmxlIGFzc2VydGlvbnMgd2l0aCBzcGVjaWZpZWQgZ3JhbnVsYXJpdHknXG4gICAgfSxcbiAgICBkaXNhYmxlYXNzZXJ0aW9uczoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLkNPTE9OX1ZBTFVFX09SX0ZMQUdfU1lOVEFYLFxuICAgICAgb3B0RGVzYzogJ1s6PHBhY2thZ2VuYW1lPi4uLnw6PGNsYXNzbmFtZT5dJyxcbiAgICAgIGFsaWFzOiAnZGEnLFxuICAgICAgZGVzYzogJ2Rpc2FibGUgYXNzZXJ0aW9ucyB3aXRoIHNwZWNpZmllZCBncmFudWxhcml0eSdcbiAgICB9LFxuICAgIGVuYWJsZXN5c3RlbWFzc2VydGlvbnM6IHsgYWxpYXM6ICdlc2EnLCBkZXNjOiAnZW5hYmxlIHN5c3RlbSBhc3NlcnRpb25zJyB9LFxuICAgIGRpc2FibGVzeXN0ZW1hc3NlcnRpb25zOiB7IGFsaWFzOiAnZHNhJywgZGVzYzogJ2Rpc2FibGUgc3lzdGVtIGFzc2VydGlvbnMgJ31cbiAgfSxcbiAgWDoge1xuICAgIGxvZzoge1xuICAgICAgZGVzYzogJ2xvZyBsZXZlbCwgWzAtMTBdfHZ0cmFjZXx0cmFjZXxkZWJ1Z3xlcnJvcicsXG4gICAgICB0eXBlOiBQYXJzZVR5cGUuTk9STUFMX1ZBTFVFX1NZTlRBWFxuICAgIH0sXG4gICAgJ3Z0cmFjZS1tZXRob2RzJzoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLk5PUk1BTF9WQUxVRV9TWU5UQVgsXG4gICAgICBvcHREZXNjOiAnIDxqYXZhL2xhbmcvT2JqZWN0L2dldEhhc2hDb2RlKClJOi4uLj4nLFxuICAgICAgZGVzYzogJ3NwZWNpZnkgcGFydGljdWxhciBtZXRob2RzIHRvIHZ0cmFjZSBzZXBhcmF0ZWQgYnkgY29sb25zJ1xuICAgIH0sXG4gICAgJ2xpc3QtY2xhc3MtY2FjaGUnOiB7XG4gICAgICBkZXNjOiAnbGlzdCBhbGwgb2YgdGhlIGJvb3RzdHJhcCBsb2FkZWQgY2xhc3NlcyBhZnRlciBleGVjdXRpb24nXG4gICAgfSxcbiAgICAnZHVtcC1jb21waWxlZC1jb2RlJzoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLk5PUk1BTF9WQUxVRV9TWU5UQVgsXG4gICAgICBvcHREZXNjOiAnIDxkaXJlY3Rvcnk+JyxcbiAgICAgIGRlc2M6ICdsb2NhdGlvbiB0byBkdW1wIGNvbXBpbGVkIG9iamVjdCBkZWZpbml0aW9ucydcbiAgICB9LFxuICAgIC8vIFRPRE86IFVzZSAtRGphdmEubGlicmFyeS5wYXRoXG4gICAgJ25hdGl2ZS1jbGFzc3BhdGgnOiB7XG4gICAgICB0eXBlOiBQYXJzZVR5cGUuTk9STUFMX1ZBTFVFX1NZTlRBWCxcbiAgICAgIG9wdERlc2M6ICcgPGNsYXNzIHNlYXJjaCBwYXRoIG9mIGRpcmVjdG9yaWVzPicsXG4gICAgICBkZXNjOiAnQSA6IHNlcGFyYXRlZCBsaXN0IG9mIGRpcmVjdG9yaWVzIHRvIHNlYXJjaCBmb3IgbmF0aXZlIG1hdGhvZHMgaW4gSlMgZmlsZXMuJ1xuICAgIH0sXG4gICAgJ2Jvb3RjbGFzc3BhdGgvYSc6IHtcbiAgICAgIHR5cGU6IFBhcnNlVHlwZS5DT0xPTl9WQUxVRV9TWU5UQVgsXG4gICAgICBvcHREZXNjOiAnOjxkaXJlY3RvcmllcyBhbmQgemlwL2phciBmaWxlcyBzZXBhcmF0ZWQgYnkgOj4nLFxuICAgICAgZGVzYzogJ2FwcGVuZCB0byBlbmQgb2YgYm9vdHN0cmFwIGNsYXNzIHBhdGgnXG4gICAgfSxcbiAgICAnYm9vdGNsYXNzcGF0aC9wJzoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLkNPTE9OX1ZBTFVFX1NZTlRBWCxcbiAgICAgIG9wdERlc2M6ICc6PGRpcmVjdG9yaWVzIGFuZCB6aXAvamFyIGZpbGVzIHNlcGFyYXRlZCBieSA6PicsXG4gICAgICBkZXNjOiAncHJlcGVuZCBpbiBmcm9udCBvZiBib290c3RyYXAgY2xhc3MgcGF0aCdcbiAgICB9LFxuICAgICdib290Y2xhc3NwYXRoJzoge1xuICAgICAgdHlwZTogUGFyc2VUeXBlLkNPTE9OX1ZBTFVFX1NZTlRBWCxcbiAgICAgIG9wdERlc2M6ICc6PGRpcmVjdG9yaWVzIGFuZCB6aXAvamFyIGZpbGVzIHNlcGFyYXRlZCBieSA6PicsXG4gICAgICBkZXNjOiAnc2V0IHNlYXJjaCBwYXRoIGZvciBib290c3RyYXAgY2xhc3NlcyBhbmQgcmVzb3VyY2VzJ1xuICAgIH1cbiAgfVxufSk7XG5cbi8qKlxuICogQ29uc3VtZXMgYSBgamF2YWAgY29tbWFuZCBsaW5lIHN0cmluZy4gQ29uc3RydWN0cyBhIEpWTSwgbGF1bmNoZXMgdGhlIGNvbW1hbmQsIGFuZFxuICogcmV0dXJucyB0aGUgSlZNIG9iamVjdC4gVGhyb3dzIGFuIGV4Y2VwdGlvbiBpZiBwYXJzaW5nIGZhaWxzLlxuICpcbiAqIFJldHVybnMgYG51bGxgIGlmIG5vIEpWTSBuZWVkZWQgdG8gYmUgY29uc3RydWN0ZWQgKGUuZy4gLWggZmxhZykuXG4gKlxuICogQHBhcmFtIGFyZ3MgQXJndW1lbnRzIHRvIHRoZSAnamF2YScgY29tbWFuZC5cbiAqIEBwYXJhbSBvcHRzIERlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSBkb25lQ2IgQ2FsbGVkIHdoZW4gSlZNIGV4ZWN1dGlvbiBmaW5pc2hlcy4gUGFzc2VzIGFcbiAqICAgbnVtYmVyIHRvIHRoZSBjYWxsYmFjayBpbmRpY2F0aW5nIHRoZSBleGl0IHZhbHVlLlxuICogQHBhcmFtIFtqdm1TdGFydGVkXSBDYWxsZWQgd2l0aCB0aGUgSlZNIG9iamVjdCBvbmNlIHdlIGhhdmUgaW52b2tlZCBpdC5cbiAqL1xuZnVuY3Rpb24gamF2YShhcmdzOiBzdHJpbmdbXSwgb3B0czogSlZNQ0xJT3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgIGRvbmVDYjogKHN0YXR1czogbnVtYmVyKSA9PiB2b2lkLFxuICAgICAgICAgICAgICAgICAgICAganZtU3RhcnRlZDogKGp2bTogSlZNKSA9PiB2b2lkID0gZnVuY3Rpb24oanZtOiBKVk0pOiB2b2lkIHt9KTogdm9pZCB7XG4gIGxldCBwYXJzZWRBcmdzID0gcGFyc2VyLnBhcnNlKGFyZ3MpLFxuICAgIHN0YW5kYXJkID0gcGFyc2VkQXJnc1snZGVmYXVsdCddLFxuICAgIG5vblN0YW5kYXJkID0gcGFyc2VkQXJnc1snWCddLFxuICAgIGp2bVN0YXRlOiBKVk07XG5cbiAgLy8gU3lzdGVtIHByb3BlcnRpZXMuXG4gIG9wdHMucHJvcGVydGllcyA9IHN0YW5kYXJkLm1hcE9wdGlvbignRCcpO1xuXG4gIGlmIChzdGFuZGFyZC5mbGFnKCdoZWxwJywgZmFsc2UpKSB7XG4gICAgcmV0dXJuIHByaW50SGVscChvcHRzLmxhdW5jaGVyTmFtZSwgcGFyc2VyLmhlbHAoJ2RlZmF1bHQnKSwgZG9uZUNiLCAwKTtcbiAgfSBlbHNlIGlmIChzdGFuZGFyZC5mbGFnKCdYJywgZmFsc2UpKSB7XG4gICAgcmV0dXJuIHByaW50Tm9uU3RhbmRhcmRIZWxwKG9wdHMubGF1bmNoZXJOYW1lLCBwYXJzZXIuaGVscCgnWCcpLCBkb25lQ2IsIDApO1xuICB9XG5cbiAgLy8gR0xPQkFMIENPTkZJR1VSQVRJT05cbiAgbGV0IGxvZ09wdGlvbiA9IG5vblN0YW5kYXJkLnN0cmluZ09wdGlvbignbG9nJywgJ0VSUk9SJyk7XG5cbiAgaWYgKC9eWzAtOV0rJC8udGVzdChsb2dPcHRpb24pKSB7XG4gICAgbG9nZ2luZy5sb2dfbGV2ZWwgPSBwYXJzZUludChsb2dPcHRpb24sIDEwKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgbGV2ZWwgPSAoPGFueT4gbG9nZ2luZylbbG9nT3B0aW9uLnRvVXBwZXJDYXNlKCldO1xuICAgIGlmIChsZXZlbCA9PSBudWxsKSB7XG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgVW5yZWNvZ25pemVkIGxvZyBsZXZlbDogJHtsb2dPcHRpb259LmApO1xuICAgICAgcmV0dXJuIHByaW50SGVscChvcHRzLmxhdW5jaGVyTmFtZSwgcGFyc2VyLmhlbHAoJ2RlZmF1bHQnKSwgZG9uZUNiLCAxKTtcbiAgICB9XG4gICAgbG9nZ2luZy5sb2dfbGV2ZWwgPSBsZXZlbDtcbiAgfVxuXG4gIGlmIChub25TdGFuZGFyZC5mbGFnKCdsaXN0LWNsYXNzLWNhY2hlJywgZmFsc2UpKSB7XG4gICAgLy8gUmVkZWZpbmUgZG9uZV9jYiBzbyB3ZSBwcmludCB0aGUgbG9hZGVkIGNsYXNzIGZpbGVzIG9uIEpWTSBleGl0LlxuICAgIGRvbmVDYiA9ICgob2xkX2RvbmVfY2I6IChhcmc6IG51bWJlcikgPT4gdm9pZCk6IChhcmc6IG51bWJlcikgPT4gdm9pZCA9PiB7XG4gICAgICByZXR1cm4gKHJlc3VsdDogbnVtYmVyKTogdm9pZCA9PiB7XG4gICAgICAgIGxldCBmcGF0aHMgPSBqdm1TdGF0ZS5nZXRCb290c3RyYXBDbGFzc0xvYWRlcigpLmdldExvYWRlZENsYXNzRmlsZXMoKTtcbiAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoZnBhdGhzLmpvaW4oJ1xcbicpICsgJ1xcbicpO1xuICAgICAgICBvbGRfZG9uZV9jYihyZXN1bHQpO1xuICAgICAgfTtcbiAgICB9KShkb25lQ2IpO1xuICB9XG5cbiAgaWYgKHN0YW5kYXJkLmZsYWcoJ2VuYWJsZXN5c3RlbWFzc2VydGlvbnMnLCBmYWxzZSkpIHtcbiAgICBvcHRzLmVuYWJsZVN5c3RlbUFzc2VydGlvbnMgPSB0cnVlO1xuICB9XG5cbiAgaWYgKHN0YW5kYXJkLmZsYWcoJ2Rpc2FibGVzeXN0ZW1hc3NlcnRpb25zJywgZmFsc2UpKSB7XG4gICAgb3B0cy5lbmFibGVTeXN0ZW1Bc3NlcnRpb25zID0gZmFsc2U7XG4gIH1cblxuICBpZiAoc3RhbmRhcmQuZmxhZygnZW5hYmxlYXNzZXJ0aW9ucycsIGZhbHNlKSkge1xuICAgIG9wdHMuZW5hYmxlQXNzZXJ0aW9ucyA9IHRydWU7XG4gIH0gZWxzZSBpZiAoc3RhbmRhcmQuc3RyaW5nT3B0aW9uKCdlbmFibGVhc3NlcnRpb25zJywgbnVsbCkpIHtcbiAgICBvcHRzLmVuYWJsZUFzc2VydGlvbnMgPSBzdGFuZGFyZC5zdHJpbmdPcHRpb24oJ2VuYWJsZWFzc2VydGlvbnMnLCBudWxsKS5zcGxpdCgnOicpO1xuICB9XG5cbiAgaWYgKHN0YW5kYXJkLnN0cmluZ09wdGlvbignZGlzYWJsZWFzc2VydGlvbnMnLCBudWxsKSkge1xuICAgIG9wdHMuZGlzYWJsZUFzc2VydGlvbnMgPSBzdGFuZGFyZC5zdHJpbmdPcHRpb24oJ2Rpc2FibGVhc3NlcnRpb25zJywgbnVsbCkuc3BsaXQoJzonKTtcbiAgfVxuICAvLyBOT1RFOiBCb29sZWFuIGZvcm0gb2YgLWRpc2FibGVhc3NlcnRpb25zIGlzIGEgTk9QLlxuXG4gIC8vIEJvb3RzdHJhcCBjbGFzc3BhdGggaXRlbXMuXG4gIGxldCBic2NsID0gbm9uU3RhbmRhcmQuc3RyaW5nT3B0aW9uKCdib290Y2xhc3NwYXRoJywgbnVsbCk7XG4gIGlmIChic2NsICE9PSBudWxsKSB7XG4gICAgb3B0cy5ib290c3RyYXBDbGFzc3BhdGggPSBic2NsLnNwbGl0KCc6Jyk7XG4gIH1cbiAgbGV0IGJzQ2xBcHBlbmQgPSBub25TdGFuZGFyZC5zdHJpbmdPcHRpb24oJ2Jvb3RjbGFzc3BhdGgvYScsIG51bGwpO1xuICBpZiAoYnNDbEFwcGVuZCkge1xuICAgIG9wdHMuYm9vdHN0cmFwQ2xhc3NwYXRoID0gb3B0cy5ib290c3RyYXBDbGFzc3BhdGguY29uY2F0KGJzQ2xBcHBlbmQuc3BsaXQoJzonKSk7XG4gIH1cbiAgbGV0IGJzQ2xQcmVwZW5kID0gbm9uU3RhbmRhcmQuc3RyaW5nT3B0aW9uKCdib290Y2xhc3NwYXRoL3AnLCBudWxsKTtcbiAgaWYgKGJzQ2xQcmVwZW5kKSB7XG4gICAgb3B0cy5ib290c3RyYXBDbGFzc3BhdGggPSBic0NsUHJlcGVuZC5zcGxpdCgnOicpLmNvbmNhdChvcHRzLmJvb3RzdHJhcENsYXNzcGF0aCk7XG4gIH1cblxuICAvLyBVc2VyLXN1cHBsaWVkIGNsYXNzcGF0aCBpdGVtcy5cbiAgaWYgKCFvcHRzLmNsYXNzcGF0aCkge1xuICAgIG9wdHMuY2xhc3NwYXRoID0gW107XG4gIH1cblxuICBpZiAoc3RhbmRhcmQuc3RyaW5nT3B0aW9uKCdqYXInLCBudWxsKSkge1xuICAgIG9wdHMuY2xhc3NwYXRoLnB1c2goc3RhbmRhcmQuc3RyaW5nT3B0aW9uKCdqYXInLCBudWxsKSk7XG4gIH0gZWxzZSBpZiAoc3RhbmRhcmQuc3RyaW5nT3B0aW9uKCdjbGFzc3BhdGgnLCBudWxsKSkge1xuICAgIG9wdHMuY2xhc3NwYXRoID0gb3B0cy5jbGFzc3BhdGguY29uY2F0KHN0YW5kYXJkLnN0cmluZ09wdGlvbignY2xhc3NwYXRoJywgbnVsbCkuc3BsaXQoJzonKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gREVGQVVMVDogSWYgbm8gdXNlci1zdXBwbGllZCBjbGFzc3BhdGgsIGFkZCB0aGUgY3VycmVudCBkaXJlY3RvcnkgdG9cbiAgICAvLyB0aGUgY2xhc3MgcGF0aC5cbiAgICBvcHRzLmNsYXNzcGF0aC5wdXNoKHByb2Nlc3MuY3dkKCkpO1xuICB9XG5cbiAgLy8gVXNlci1zdXBwbGllZCBuYXRpdmUgY2xhc3NwYXRoLlxuICBsZXQgbmF0aXZlQ2xhc3NwYXRoID0gc3RhbmRhcmQuc3RyaW5nT3B0aW9uKCduYXRpdmUtY2xhc3NwYXRoJywgbnVsbCk7XG4gIGlmIChuYXRpdmVDbGFzc3BhdGgpIHtcbiAgICBvcHRzLm5hdGl2ZUNsYXNzcGF0aCA9IG9wdHMubmF0aXZlQ2xhc3NwYXRoLmNvbmNhdChuYXRpdmVDbGFzc3BhdGguc3BsaXQoJzonKSk7XG4gIH1cblxuICAvLyBDb25zdHJ1Y3QgdGhlIEpWTS5cbiAganZtU3RhdGUgPSBuZXcgSlZNKG9wdHMsIChlcnI/OiBhbnkpOiB2b2lkID0+IHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcIkVycm9yIGNvbnN0cnVjdGluZyBKVk06XFxuXCIpO1xuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoZXJyLnRvU3RyaW5nKCkgKyBcIlxcblwiKTtcbiAgICAgIGRvbmVDYigxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGF1bmNoSnZtKHN0YW5kYXJkLCBvcHRzLCBqdm1TdGF0ZSwgZG9uZUNiLCBqdm1TdGFydGVkKTtcbiAgICB9XG4gIH0pO1xuXG4gIGxldCB2dHJhY2VNZXRob2RzID0gbm9uU3RhbmRhcmQuc3RyaW5nT3B0aW9uKCd2dHJhY2UtbWV0aG9kcycsIG51bGwpO1xuICBpZiAodnRyYWNlTWV0aG9kcykge1xuICAgIHZ0cmFjZU1ldGhvZHMuc3BsaXQoJzonKS5mb3JFYWNoKChtOiBzdHJpbmcpID0+IGp2bVN0YXRlLnZ0cmFjZU1ldGhvZChtKSk7XG4gIH1cblxuICBsZXQgZHVtcENvbXBpbGVkQ29kZSA9IG5vblN0YW5kYXJkLnN0cmluZ09wdGlvbignZHVtcENvbXBpbGVkQ29kZScsIG51bGwpO1xuICBpZiAoZHVtcENvbXBpbGVkQ29kZSkge1xuICAgIGp2bVN0YXRlLmR1bXBDb21waWxlZENvZGUoZHVtcENvbXBpbGVkQ29kZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb25zdW1lcyBhIGZ1bGx5LWNvbmZpZ3VyZWQgSlZNLCBwYXJzZWQgYXJndW1lbnRzLCBhbmQgYSBjYWxsYmFjay5cbiAqIEZpZ3VyZXMgb3V0IGZyb20gdGhpcyBob3cgdG8gbGF1bmNoIHRoZSBKVk0gKGUuZy4gdXNpbmcgYSBKQVIgZmlsZSBvciBhXG4gKiBwYXJ0aWN1bGFyIGNsYXNzKS5cbiAqL1xuZnVuY3Rpb24gbGF1bmNoSnZtKHN0YW5kYXJkT3B0aW9uczogUHJlZml4UGFyc2VSZXN1bHQsIG9wdHM6IEpWTUNMSU9wdGlvbnMsIGp2bVN0YXRlOiBKVk0sIGRvbmVDYjogKHN0YXR1czogbnVtYmVyKSA9PiB2b2lkLFxuICAgICAgICAgICAgICAgICAgICBqdm1TdGFydGVkOiAoanZtU3RhdGU6IEpWTSkgPT4gdm9pZCk6IHZvaWQge1xuICBsZXQgbWFpbkFyZ3MgPSBzdGFuZGFyZE9wdGlvbnMudW5wYXJzZWRBcmdzKCk7XG4gIGlmIChzdGFuZGFyZE9wdGlvbnMuc3RyaW5nT3B0aW9uKCdqYXInLCBudWxsKSkge1xuICAgIGp2bVN0YXRlLnJ1bkphcihtYWluQXJncywgZG9uZUNiKTtcbiAgICBqdm1TdGFydGVkKGp2bVN0YXRlKTtcbiAgfSBlbHNlIGlmIChtYWluQXJncy5sZW5ndGggPiAwKSB7XG4gICAgbGV0IGNuYW1lID0gbWFpbkFyZ3NbMF07XG4gICAgaWYgKGNuYW1lLnNsaWNlKC02KSA9PT0gJy5jbGFzcycpIHtcbiAgICAgIGNuYW1lID0gY25hbWUuc2xpY2UoMCwgLTYpO1xuICAgIH1cbiAgICBpZiAoY25hbWUuaW5kZXhPZignLicpICE9PSAtMSkge1xuICAgICAgLy8gaGFjazogY29udmVydCBqYXZhLmZvby5CYXIgdG8gamF2YS9mb28vQmFyXG4gICAgICBjbmFtZSA9IHV0aWwuZGVzY3JpcHRvcjJ0eXBlc3RyKHV0aWwuaW50X2NsYXNzbmFtZShjbmFtZSkpO1xuICAgIH1cbiAgICBqdm1TdGF0ZS5ydW5DbGFzcyhjbmFtZSwgbWFpbkFyZ3Muc2xpY2UoMSksIGRvbmVDYik7XG4gICAganZtU3RhcnRlZChqdm1TdGF0ZSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTm8gY2xhc3Mgc3BlY2lmaWVkLCBubyBqYXIgc3BlY2lmaWVkIVxuICAgIHByaW50SGVscChvcHRzLmxhdW5jaGVyTmFtZSwgcGFyc2VyLmhlbHAoJ2RlZmF1bHQnKSwgZG9uZUNiLCAwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmludEhlbHAobGF1bmNoZXJOYW1lOiBzdHJpbmcsIHN0cjogc3RyaW5nLCBkb25lQ2I6IChhcmc6IG51bWJlcikgPT4gdm9pZCwgcnY6IG51bWJlcik6IHZvaWQge1xuICBwcm9jZXNzLnN0ZG91dC53cml0ZShcbmBVc2FnZTogJHtsYXVuY2hlck5hbWV9IFstb3B0aW9uc10gY2xhc3MgW2FyZ3MuLi5dXG4gICAgICAgICh0byBleGVjdXRlIGEgY2xhc3MpXG5vciAgJHtsYXVuY2hlck5hbWV9IFstb3B0aW9uc10gLWphciBqYXJmaWxlIFthcmdzLi4uXVxuICAgICAgICAodG8gZXhlY3V0ZSBhIGphciBmaWxlKVxud2hlcmUgb3B0aW9ucyBpbmNsdWRlOlxcbiR7c3RyfWApO1xuICBkb25lQ2IocnYpO1xufVxuXG5mdW5jdGlvbiBwcmludE5vblN0YW5kYXJkSGVscChsYXVuY2hlck5hbWU6IHN0cmluZywgc3RyOiBzdHJpbmcsIGRvbmVDYjogKGFyZzogbnVtYmVyKSA9PiB2b2lkLCBydjogbnVtYmVyKTogdm9pZCB7XG4gIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGAke3N0cn1cXG5cXG5UaGUgLVggb3B0aW9ucyBhcmUgbm9uLXN0YW5kYXJkIGFuZCBzdWJqZWN0IHRvIGNoYW5nZSB3aXRob3V0IG5vdGljZS5cXG5gKTtcbiAgZG9uZUNiKHJ2KTtcbn1cblxuZXhwb3J0ID0gamF2YTtcbiJdfQ==