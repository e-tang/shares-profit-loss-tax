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
CommSec.prototype.load = function (files, offset, options) {
    console.log("Loading CommSec data...");
    if (!options && typeof offset == 'object') {
        options = offset;
        offset = 0;
    }

    offset = offset || 0;
    options = options || {};

    let trades = {
        symbols: new Map(),
        first: null,
        last: null,
        years: new Set()
    }

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
            let start = false;

            for (let j = 0; j < lines.length; j++) {
                let line = lines[j];

                if (!start) {
                    if (line.startsWith("Code,")) 
                        start = true;
                    continue;
                }

                if (line.trim().length == 0) {
                    break;
                }
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
                let tokens = fields[2].split('/');
                transaction.date = new Date(tokens[2], tokens[1] - 1, tokens[0]);
                // transaction.date = new Date();

                // buy, sell
                transaction.type = fields[3].toLowerCase;
                transaction.quantity = parseInt(fields[4]);
                transaction.price = parseFloat(fields[5]);
                transaction.value = parseFloat(fields[6]);
                transaction.fee = parseFloat(fields[7]);
                transaction.gst = parseFloat(fields[8]);
                transaction.note = fields[9];
                transaction.total = parseFloat(fields[10]);

                if (trades.first == null || trades.first > transaction.date) {
                    trades.first = transaction.date;
                }
                if (trades.last == null || trades.last < transaction.date) {
                    trades.last = transaction.date;
                }

                let year = transaction.date.getFullYear();
                trades.years.add(year);
                
                let transactions = null;
                if (trades.symbols.has(transaction.symbol)) {
                    transactions = trades.symbols.get(transaction.symbol);
                }
                else {
                    transactions = [];
                    trades.symbols.set(transaction.symbol, transactions);
                }

                transactions.push(transaction);
            }
        }
        catch (err) {
            console.log(err);
        }
    }

    return trades;
}

util.inherits(CommSec, Broker);

module.exports = CommSec;