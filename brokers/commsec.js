/**
 * @file commsec.js
 * 
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const Broker = require('./base');

const util = require('util');
const fs = require('fs');

const utils = require('../lib/utils');

const models = require('../lib/models');

function CommSec() {
    Broker.call(this);

    this.name = "CommSec";

    /**
     * Before 2023 financial year, CommSec provided a nicely structured CSV file with detailed information.through the years.
     * Now they only provide a PDF file or a CSV file with less information.
     */
    this.before_2023 = false;
}

CommSec.prototype.quote_count_check = function (line) {
    if (!this.before_2023)
        return true;

    return Broker.prototype.quote_count_check.call(this, line);
}

CommSec.prototype.load_content = function (trades, content, options) {
    if (content.indexOf("Code,") >= 0 && content.indexOf("Transaction Summary") >= 0) {
        this.before_2023 = true;
    }
    else if (content.indexOf("Date,Reference") >= 0) {
        this.before_2023 = false;
    }
    else {
        let lines = content.split('\n');
        for (let i = 0; i < 3; i++) {
            console.log(lines[i]);
        }
        console.error("Above is the first 3 lines of the file. Cannot determine the format.")
        throw new Error("Unknown CommSec format");
    }
    return Broker.prototype.load_content.call(this, trades, content, options);
}

CommSec.prototype.line_to_transaction = function (fields, index) {
    if (this.before_2023) {
        return this.line_to_transaction_before_2023(fields, index);
    }
    return this.line_to_transaction_after_2023(fields, index);
}

CommSec.prototype.line_to_transaction_after_2023 = function (fields, index) {
    // Date
    // Reference
    // Details
    //          B/S
    //          Quantity
    //          Code
    //          Price
    // Debit($)
    // Credit($)
    // Balance($)
    let transaction = new models.Transaction();
    transaction.id = index;
    transaction.date = utils.to_date(fields[0]);
    let tokoens = fields[2].replace('@', ' ').split(/\s+/);
    let type = tokoens[0].toLowerCase();
    if (type == 'b')
        transaction.type = 'buy';
    else if (type == 's')
        transaction.type = 'sell';
    else
        return null;

    transaction.quantity = parseInt(tokoens[1]);
    transaction.symbol = tokoens[2].toUpperCase();
    transaction.price = parseFloat(tokoens[3]);

    transaction.value = transaction.quantity * transaction.price;
    if (transaction.type == 'sell')
        transaction.total = parseFloat(fields[4]);
    else
        transaction.total = parseFloat(fields[3]);

    if (transaction.type == 'sell') {
        transaction.quantity = -transaction.quantity;
        transaction.value = -transaction.value;
        transaction.total = -transaction.total;
    }
    return transaction;
}

CommSec.prototype.line_to_transaction_before_2023 = function (fields, index) {

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
    transaction.id = index;
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

    return transaction;
}

util.inherits(CommSec, Broker);

module.exports = CommSec;