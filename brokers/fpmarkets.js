/**
 * @file fpmarkets.js
 * 
 * Copyright (c) 2025 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const Broker = require('./base');

const models = require('../lib/models');

class FPMarkets extends Broker {
    constructor(options) {
        super(options);

        this.name = "FP Markets";
        this.quote_count_needed = true;
    }

    /**
     * Load the broker's data from the CSV file.
     */
    line_to_transaction(fields, index) {
    // ID
    // Date
    // Time
    // Account Code
    // Buy or Sell
    // Currency
    // Exchange
    // Stock
    // Volume
    // Price
    // Value
    let transaction = new models.Transaction();
    transaction.id = index;
    transaction.uuid = fields[0];
    let tokens = fields[1].split('/');
    transaction.date = new Date(tokens[2], tokens[1] - 1, tokens[0]);
    try {
        tokens = fields[2].split(/[:|\s+]/g);

        let hour = parseInt(tokens[0]);
        transaction.date.setHours(hour);
        transaction.date.setMinutes(tokens[1]);
        transaction.date.setSeconds(tokens[2]);
        if (tokens.length > 3) {
            let token = tokens[3].toLowerCase();
            if (token[0] >= '0' && token[0] <= '9') 
                transaction.date.setMilliseconds(tokens[3]);
            else if (token == 'pm') {
                if (hour < 12)
                    transaction.date.setHours(hour + 12);
            }
        }
    }
    catch (err) {
        console.debug("Error in parsing time: " + fields[3]);
        console.debug(err);
    }

    // ignore account code
    // fields[3]

    transaction.type = fields[4].toLowerCase();

    transaction.currency = fields[5];

    transaction.exchange = fields[6].toUpperCase();

    transaction.symbol = fields[7];

    transaction.quantity = parseInt(fields[8]);

    // in cents
    transaction.price = parseFloat(fields[9]) / 100;

    // total is the trade value as commission is calculated separately 
    transaction.total = transaction.value = parseFloat(fields[10]);

    this.adjust_transaction_common(transaction);

    return transaction;
    }
}

module.exports = FPMarkets;