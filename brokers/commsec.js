const Broker = require('./base');

const util = require('util');
const fs = require('fs');
const { off } = require('process');

const models = require('../lib/models');

function CommSec() {
    Broker.call(this);

    this.name = "CommSec";
}

/**
 * Load the broker's data from the CSV file.
 */
CommSec.prototype.load = function (files, offset) {
    console.log("Loading CommSec data...");
    offset = offset || 6;
    let transactions = [];

    if (!Array.isArray(files)) {
        files = [files];
    }

    let count = 0;
    for (let i = 0; i < files.length; i++) {
        try {
            let content = fs.readFileSync(files[i], 'utf8');
            let lines = content.split('\n');
            for (let s = 0; s < offset; s++) {
                lines.shift();
            }

            for (let j = 0; j < lines.length; j++) {
                let line = lines[j];
                let fields = line.split(',');

                // Code
                // Company
                // Date
                // Type
                // Quantity
                // Unit Price ($)
                // Trade Value ($)
                // Brokerage+GST ($)
                // GST ($)
                // Contract Note
                // Total Value ($)

                let transaction = new models.Transaction();
                transaction.id = ++count;
                transaction.symbol = fields[0];
                transaction.company = fields[1];
                transaction.date = new Date(fields[2]);
                transaction.type = fields[3];
                transaction.quantity = parseInt(fields[4]);
                transaction.price = parseFloat(fields[5]);
                transaction.value = parseFloat(fields[6]);
                transaction.fee = parseFloat(fields[7]);
                transaction.gst = parseFloat(fields[8]);
                transaction.note = fields[9];
                transaction.total = parseFloat(fields[10]);
            }
        }
        catch (err) {
            console.log(err);
        }
    }

    return transactions;
}

util.inherits(CommSec, Broker);

module.exports = CommSec;