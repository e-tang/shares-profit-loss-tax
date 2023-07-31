const CommSec = require('./commsec');

const commsec = new CommSec();

module.exports = {
    commsec: commsec,
    default: commsec
}