/**
 * Copyright (c) 2025 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 * 
 */

const CommSec = require('./commsec');
const FPMarkets = require('./fpmarkets');
const Any = require('./any');
const Papa = require("papaparse");

const models = require('../lib/models');

const commsec = new CommSec();

const normalizeCommSecData = (csvData) => {
    return csvData.map(row => ({
        date: new Date(row['Date']),
        symbol: row['Code'],
        type: row['Type'].toLowerCase() === 'buy' ? 'buy' : 'sell',
        quantity: parseInt(row['Quantity']),
        price: parseFloat(row['Unit Price ($)']),
    }));
};

const normalizeFPMarketsData = (csvData) => {
    return csvData.map(row => ({
        date: new Date(row['Date']),
        symbol: row['Stock'],
        type: row['Buy or Sell'].toLowerCase() === 'buy' ? 'buy' : 'sell',
        quantity: parseInt(row['Volume']),
        price: parseFloat(row['Price']),
    }));
};

const normalizeGenericData = (csvData) => {
    return csvData.map(row => ({
        date: new Date(row['Date'] || row['Trade Date']),
        symbol: row['Symbol'] || row['Code'] || row['Stock'],
        type: (row['Type'] || row['Buy or Sell']).toLowerCase() === 'buy' ? 'buy' : 'sell',
        quantity: parseInt(row['Quantity'] || row['Volume']),
        price: parseFloat(row['Price'] || row['Unit Price ($)']),
    }));
};

const identifyBroker = (csvContent) => {
    if (csvContent.includes("Code,Company,Date,Type,Quantity")) {
        return "commsec";
    } else if (csvContent.includes("Date,Reference,Details,B/S,Quantity,Code,Price")) {
        return "commsec"; // alternative commsec format
    } else if (csvContent.includes("ID,Date,Time,Account Code,Buy or Sell,Currency,Exchange,Stock,Volume,Price,Value")) {
        return "fpmarkets";
    }
    return null;
};

function Brokers() {
    this.commsec = commsec;
    this.fpmarkets = new FPMarkets();
    this.normalizeCommSecData = normalizeCommSecData;
    this.normalizeFPMarketsData = normalizeFPMarketsData;
    this.normalizeGenericData = normalizeGenericData;
    this.identifyBroker = identifyBroker;

    this.normalizeData = function (csvContent, brokerName, options) {
        options = options || {};

        if (!brokerName) {
            brokerName = this.identifyBroker(csvContent);
            if (!brokerName) {
                throw new Error("Could not identify broker from CSV content. Please specify broker name.");
            }
        }

        // Get broker instance
        const broker = this.get_broker(brokerName, options);
        if (!broker) {
            throw new Error("Unsupported broker: " + brokerName);
        }

        // Create empty trades container
        let existing_trades = options.trades || new models.Trades();

        // Use broker-specific content loading
        return broker.load_content(
            existing_trades,
            csvContent,
            {
                index: 0,
                offset: 0,
                ...options
            }
        );
    };

    this.get_broker = function (name, options) {
        try {
            if (name == null)
                return new Any(options);

            const broker = this[name];
            if (broker == null) {
                console.error("Unknown broker: " + name);
                return null;
            }
            return broker;
        } catch (e) {
            console.error("Error: " + e.message);
            return null;
        }
    };

    this.default = commsec;
}

module.exports = new Brokers();