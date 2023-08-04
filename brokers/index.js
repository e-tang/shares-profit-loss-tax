/**
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 * 
 */

const CommSec = require('./commsec');

const commsec = new CommSec();

module.exports = {
    commsec: commsec,
    default: commsec,
    fpmarkets: require('./fpmarkets'),
}