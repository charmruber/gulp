#!/usr/bin/env node

var Liftoff = require('liftoff');
var interpret = require('interpret');
var v8flags = require('v8flags');
var completion = require('../lib/completion');
var argv = require('minimist')(process.argv.slice(2));
var gutil = require('gulp-util');
var chalk = require('chalk');
var tildify = require('tildify');

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

cli.on('requireFail', function(name) {
    gutil.log(chalk.red('Failed to load external module'), chalk.magenta(name));
});

cli.on('respawn', function(flags, child) {
    var nodeFlags = chalk.magenta(flags.join(', '));
    var pid = chalk.magenta(child.pid);
    gutil.log('Node flags detected:', nodeFlags);
    gutil.log('Respawned to PID:', pid);
});

cli.launch({
    cwd: argv.cwd,
    configPath: argv.gulpfile,
    require: argv.require,
    completion: argv.completion,
}, handleArguments);

// The actual logic
function handleArguments(env) {
    if(versionFlag && tasks.length === 0) {
        gutil.log('CLI version', cliPackage.version);
        if(env.modulePackage && typeof env.modulePackage.version !== 'undefined') {
            gutil.log('Local version', env.modulePackage.version);
        }
        process.exit(0);
    }

    if(!env.modulePath) {
        gutil.log(
            chalk.red('Local gulp not found in'),
            chalk.magenta(tildify(env.cwd))
        );
        gutil.log(chalk.red('Try running: npm install gulp'));
        process.exit(1);
    }

    if(!env.configPath) {
        gutil.log(chalk.red('No gulpfile found'));
        process.exit(1);
    }

    // Check for semver difference between cli and local installation
    if(semver.gt(cliPackage.version, env.modulePackage.version)) {
        gutil.log(chalk.red('Warning: gulp version mismach:'));
        gutil.log(chalk.red('Global gulp is', cliPackage.version));
        gutil.log(chalk.red('Local gulp is', env.modulePackage.version));
    }

    // Chdir before Requiring gulpfile to make sure
    // we let them chdir as needed
    if(process.cwd() !== env.cwd) {
        process.chdir(env.cwd);
        gutil.log(
            'Working directory change to',
            chalk.magenta(tildify(env.cwd))
        );
    }

    // This is what actually loads up the gulpfile
    require(env.configPath);
    gutil.log('Using gulpfile', chalk.magenta(tildify(env.configPath)));

    var gulpInst = require(env.modulePath);
    logEvents(gulpInst);

    process.nextTick(function() {
        if(simpleTasksFlag) {
            return logTasksSimple(env, gulpInst);
        }
        if(tasksFlag) {
            return logTasks(env, gulpInst);
        }
        gulpInst.start.apply(gulpInst, toRun);
    });
}

// Wire up logging events
function logEvents(gulpInst) {

    // Total hack due to poor error management in orchectrator
    gulpInst.on('err', function() {
        failed = true;
    });

    gulpInst.on('task_start', function(e) {
        // so when 5 tasks start at once it only logs one time with all 5
        gutil.log('Starting', '\'' + chalk.cyan(e.task) + '\'...');
    });

    gulpInst.on('task_stop', function(e) {
        var time = prettyTime(e.hrDuration);
        gutil.log(
            'Finished', '\'' + chalk.cyan(e.task) + '\'',
            'after', chalk.magenta(time)
        );
    });

    gulpInst.on('task_err', function(e) {
        var msg = formatError(e);
        var time = prettyTime(e.hrDuration);
        gutil.log(
            '\'' + chalk.cyan(e.task) + '\'',
            chalk.red('errored after'),
            chalk.magenta(time)
        );
        gutil.log(msg);
    });

    gulpInst.on('task_not_found', function(err) {
        gutil.log(
            chalk.red('\'' + err.task + '\' is not in your gulpfile')
        );
        gutil.log('please check the documentation for proper gulpfile formatting');
        process.exit(1);
    });
}
