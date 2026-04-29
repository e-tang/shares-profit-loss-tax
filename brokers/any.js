/**
 * @file any.js
 * 
 * Copyright (c) 2025 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const utils = require("../lib/utils");

const Broker = require('./base');
const models = require('../lib/models');

class Any extends Broker {
    constructor(options) {
        super(options);

        this.name = "Any";

        this.price_unit = 1; // default to 1 dollar, but some trading platforms use 0.01 as the price unit so 1 dollar displays as 100
        this.total_unit = 1; // default to 1 dollar

        /**
         * Since we don't know the format of the file, we will assume that the first line is the header.
         * And the columns of header index must be specified in the options.
         * for example:
         * col-symbol: 0,
         * col-date: 1,
         * col-quantity: 2,
         * col-price: 3,
         * col-type: 4, assuming the type is either buy or sell, B or S
         */
        this.columns = {
            symbol: null,
            date: null,
            quantity: null,
            price: null,
            type: null,
            total: null,
            commission: null,
            fees: null,
            tax: null,
            exchange: null,
            currency: null,
        };
        if (!options) {
            throw new Error("Options must be provided with column mappings.");
        }

        this.columns.symbol = options['col-symbol'];
        this.columns.date = options['col-date'];
        this.columns.quantity = options['col-quantity'];
        this.columns.price = options['col-price'];
        this.columns.type = options['col-type'];
        this.columns.total = options['col-total'];
        this.columns.commission = options['col-commission'];
        this.columns.fees = options['col-fees'];
        this.columns.tax = options['col-tax'];
        this.columns.exchange = options['col-exchange'];
        this.columns.currency = options['col-currency'];

        if (options['price-unit'] != null && options['price-unit'] !== undefined)
            this.price_unit = Number(options['price-unit']);

        if (options['total-unit'] != null && options['total-unit'] !== undefined)
            this.total_unit = Number(options['total-unit']);

        const missingColumns = [];
        if (this.columns.symbol == null) missingColumns.push("col-symbol");
        if (this.columns.date == null) missingColumns.push("col-date");
        if (this.columns.quantity == null) missingColumns.push("col-quantity");
        if (this.columns.price == null) missingColumns.push("col-price");
        if (this.columns.type == null) missingColumns.push("col-type");

        // the following are not mandatory
        // if (this.columns.total == null) missingColumns.push("col-total");
        // if (this.columns.commission == null) missingColumns.push("col-commission");
        // if (this.columns.fees == null) missingColumns.push("col-fees");
        // if (this.columns.tax == null) missingColumns.push("col-tax");
        // if (this.columns.exchange == null) missingColumns.push("col-exchange");
        // if (this.columns.currency == null) missingColumns.push("col-currency");

        if (missingColumns.length > 0) {
            throw new Error(`Missing column mappings: ${missingColumns.join(", ")}`);
        }
    }

// just use the base class implementation
// Any.prototype.quote_count_check = function (line) {
//     return true;
// }

// implement the line_to_transaction function
    line_to_transaction(fields, index) {
    let transaction = new models.Transaction();

    transaction.symbol = fields[this.columns.symbol].trim();
    transaction.date = utils.parse_date(fields[this.columns.date].trim());
    transaction.quantity = parseFloat(fields[this.columns.quantity]);
    transaction.price = parseFloat(fields[this.columns.price]) * this.price_unit;
    transaction.type = fields[this.columns.type].trim();
    // add condition to check if the quantity is negative
    if (fields[this.columns.total] != null &&
        fields[this.columns.total] !== undefined
    )
    transaction.total = parseFloat(fields[this.columns.total]);
    if (fields[this.columns.commission] !== null &&
        fields[this.columns.commission] !== undefined
    )
    transaction.commission = parseFloat(fields[this.columns.commission]);
    if (fields[this.columns.fees] !== null &&
        fields[this.columns.fees] !== undefined
    )
    transaction.fees = parseFloat(fields[this.columns.fees]);
    if (fields[this.columns.tax] !== null &&
        fields[this.columns.tax] !== undefined
    )
    transaction.tax = parseFloat(fields[this.columns.tax]);
    if (fields[this.columns.exchange] !== null &&
        fields[this.columns.exchange] !== undefined)
    transaction.exchange = fields[this.columns.exchange].trim().toUpperCase();
    if (fields[this.columns.currency] !== null &&
        fields[this.columns.currency] !== undefined
    )
    transaction.currency = fields[this.columns.currency].trim().toUpperCase();

    if (transaction.type.toLowerCase() == 'b' || transaction.type.toLowerCase() == 'buy') {
        transaction.type = 'buy';
    }
    else if (transaction.type.toLowerCase() == 's' || transaction.type.toLowerCase() == 'sell') {
        transaction.type = 'sell';
    }
    else {
        throw new Error("Unknown transaction type: " + transaction.type);
    }

    this.adjust_transaction_common(transaction);

    return transaction;
    }
}

module.exports = Any;