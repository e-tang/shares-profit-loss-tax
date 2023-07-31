const Params = require('node-programmer/params');
const brokers = require('./brokers');

var params = new Params({
    "broker": "default",
});

var opts = params.getOpts();
var optCount = params.geOptCount();

let broker = brokers[opts.broker];



