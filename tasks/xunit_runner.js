/*
 * grunt-xunit-runner
 * https://github.com/reharik/grunt_xunit_runner
 *
 * Copyright (c) 2014 Raif Harik
 * Licensed under the MIT license.
 */


'use strict';

module.exports = function (grunt) {
    var exec = require('child_process').exec;
    var util = require('util');
    var async = require('async');
    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('xunit_runner', 'Grunt task for running multiple xunit dlls with all the options that xunit console provides', function () {

        var asyncCallback = this.async();
        var output = [];
        var done = this.async();
        var assemblies = [];
        var testResult = {
            total: 0,
            failed: 0,
            skipped: 0,
            time: 0
        };
        var options = this.options({
            stdout: true,
            stderr: true,
            xUnit: "xunit.console.exe",
            silent:'true',
            teamcity:'false',
            trait:'',
            notrait:'',
            noshadow:'',
            xml:'',
            html:'',
            nunit:''
        });

        grunt.verbose.writeln('Using Options: ' + JSON.stringify(options, null, 4).cyan);

        this.files.forEach(function (f) {
            var src = f.src.filter(function (filepath) {
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else {
                    return true;
                }
            }).map(function (filepath) {
                    // add all the individual xunit calls to an array which will be called synchronously below
                    assemblies.push(function (cb) {
                        build(filepath, options, cb, output);
                    });
                    // final call to end synchronous calls
                    assemblies.push(function (cb) {
                        cb();
                    });
                });
        });

        // calls all the assemblies synchonously then expresses the output
        async.series(assemblies, function (err, callback) {
            asyncCallback();
            output.forEach(function (outputObj) {
                testResult.total += outputObj.total;
                testResult.failed += outputObj.failed;
                testResult.skipped += outputObj.skipped;
                testResult.time += outputObj.time;
            });

            grunt.log.writeln('-----------------------------Final-----------------------------------');
            var text = testResult.total + ' total, ' + testResult.failed + ' failed , ' + testResult.skipped + ' skipped , ' + 'took ' + testResult.time + ' seconds';
            text = testResult.failed > 0 ? text.magenta : text.green;
            grunt.log.writeln(text);

        });
    });

    function build(src, options, cb, output) {
        var  data =[];
        var cmd = buildCmdLine(src, options);
        grunt.verbose.writeln('Using Command:' + cmd.cyan);

        var cp = exec(cmd, {}, function (err, stdout, stderr) {
            cb();
        });
        cp.stdout.on('data', function (chunk) {
            data.push(chunk);
        });
        cp.stdout.on('end',function(){
            processFinalLine(data, output);
            grunt.log.writeln(src.cyan);
        });

        if (options.stdout || grunt.option('verbose')) {
            cp.stdout.pipe(process.stdout);
        }
        if (options.stderr || grunt.option('verbose')) {
            cp.stderr.pipe(process.stderr);
        }
    }

    function processFinalLine(data, output) {
        var lastChunk = data.pop();
        var lastLineArray = lastChunk.match(/^[0-9]*\stotal.*$/m)||'';

        var line = lastLineArray[0];
        if(line && line.length>0){
            var parts = line.split(',');
            output.push({
                total: parseInt(parts[0].split(' ')[0], 10 ),
                failed: parseInt(parts[1].split(' ')[1], 10),
                skipped: parseInt(parts[2].split(' ')[1], 10),
                time: parseFloat(parts[3].split(' ')[2], 10)
            });
        }
    }

    function buildCmdLine(src, options) {
        var arg = options.silent==='true' ? '/silent  ': '';
        arg += options.teamcity==='true' ? '/teamcity ' : '';
        arg += options.trait.length>0 ? '/trait "' + options.trait+'"' : '';
        arg += options.notrait.length>0 ? '/notrait "' + options.notrait +'"': '';
        arg += options.noshadow.length>0 ? '/noshadow' + options.noShadow : '';
        arg += options.xml.length>0 ? '/xml '+ options.xml : '';
        arg += options.html.length>0 ? '/html '+ options.html : '';
        arg += options.nunit.length>0 ? '/nunit '+ options.nunit : '';

        return util.format("%s %s ", options.xUnit, src, arg);
    }
};
