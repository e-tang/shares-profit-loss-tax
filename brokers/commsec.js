/**
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

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

    let trades = new models.Trades();

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
                fields = fields.map(function (field) {
                    try {
                        return JSON.parse(field.trim());
                    }
                    catch (e) {
                        // console.log("Error parsing field: " + field);
                        return field.trim();
                    }
                });

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
                transaction.type = fields[3].toLowerCase();

                // we need to convert the quantity to a positive number
                // for some brokers they use negative numbers for sell
                // but to unify the data we will use positive numbers
                transaction.quantity = parseInt(fields[4]);
                transaction.price = parseFloat(fields[5]);

                // value is the trade value
                // could be negative for sell
                transaction.value = parseFloat(fields[6]);
                transaction.fee = parseFloat(fields[7]);
                transaction.gst = parseFloat(fields[8]);
                transaction.note = fields[9];

                // the settlement amount
                // if it is a sell, it is a negative value with fee taken out
                // e.g. value = -999, fee = 10, total = -989
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