#!/usr/bin/env node

var Liftoff = require('liftoff');
var interpret = require('interpret');
var v8flags = require('v8flags');
var completion = require('../lib/completion');
var argv = require('minimist')(process.argv.slice(2));
var gutil = require('gulp-util');
var chalk = require('chalk');

// Set env var for ORIGINAL cwd
// before anything touches it
process.env.INIT_CWD = process.cwd();

var cli = new Liftoff({
    name: "gulp",
    completions: completion,
    extensions: interpret.jsVariants,
    v8flags: v8flags,
});

// Exit with 0 or 1
var failed = false;
process.once("exit", function(code) {
    if(code === 0 && failed) {
        process.exit(1);
    }
});

// Parse those args m8
var cliPackage = require('../package');
var versionFlag = argv.v || argv.version;
var tasksFlag = argv.T || argv.tasks;
var tasks = argv._;
var toRun = tasks.length ? tasks : ['default'];

// this is a hold-over until we have a better logging system
// with log levels
var simpleTasksFlag = argv['tasks-simple'];
var shouldLog = !argv.silent && !simpleTasksFlag;

if(!shouldLog) {
    gutil.log = function() {};
}

cli.on('require', function(name) {
    gutil.log('Requiring external module', chalk.magenta(name));
});
