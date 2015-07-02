#!/usr/bin/env node

var Liftoff = require('liftoff');
var interpret = require('interpret');
var v8flags = require('v8flags');
var completion = require('../lib/completion');


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
