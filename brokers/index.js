/**
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 * 
 */

const CommSec = require('./commsec');
const Any = require('./any');

const commsec = new CommSec();

module.exports = {
    commsec: commsec,
    default: commsec,
    fpmarkets: new (require('./fpmarkets'))(),

    get_broker: function (name, options) {
        let broker;
        try {
            if (name == null)
                return new Any(options);

            let broker = this[name];
            if (broker == null) {
                console.error("Unknown broker: " + name);
            }
        }
        catch (e) {
            console.error("Error: " + e.message);
            return null;
        }
        return broker;
    }
}