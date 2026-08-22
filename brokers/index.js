/**
 * Copyright (c) 2025 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 * 
 */

const CommSec = require('./commsec');
const FPMarkets = require('./fpmarkets');
const Binance = require('./binance');
const SelfWealth = require('./selfwealth');
const Any = require('./any');

const models = require('../lib/models');

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
    const header = csvContent
        .split(/\r?\n/, 1)[0]
        .replace(/^\uFEFF/, '')
        .replace(/"/g, '');

    if (header.startsWith("Trade Date,Settlement Date,Action,Code,Company,Units,Average Price,Brokerage,Total Value")) {
        // exact-header sniff (see brokers/selfwealth.js) -- checked before the
        // more permissive checks below so a SelfWealth export is never
        // misclassified as another broker's file.
        return "selfwealth";
    } else if (header.startsWith("Code,Company,Date,Type,Quantity")) {
        return "commsec";
    } else if (header.startsWith("Date,Reference,Details")) {
        return "commsec"; // alternative commsec format
    } else if (header.startsWith("ID,Date,Time,Account Code,Buy or Sell,Currency,Exchange,Stock,Volume,Price,Value")) {
        return "fpmarkets";
    } else if (header.startsWith("ID,Open Time,Close Time,Account Code,Buy or Sell,Currency,Stock,Volume,Open Price,Close Price,Commission,Swaps,Profit")) {
        return "fpmarkets";
    } else if (header.startsWith("User ID,Time,Account,Operation,Coin,Change,Remark")) {
        return "binance";
    }
    return null;
};

class Brokers {
    constructor() {
        this.commsec = new CommSec();
        this.fpmarkets = new FPMarkets();
        this.binance = new Binance();
        this.selfwealth = new SelfWealth();
        this.normalizeCommSecData = normalizeCommSecData;
        this.normalizeFPMarketsData = normalizeFPMarketsData;
        this.normalizeGenericData = normalizeGenericData;
        this.identifyBroker = identifyBroker;
        this.default = this.commsec;
    }

    normalizeData(csvContent, brokerName, options) {
        options = options || {};
        let lowercaseBroker = brokerName.toLowerCase();
        let identifiedBroker = brokerName;

        if (!brokerName || lowercaseBroker  === 'any') {
            identifiedBroker = this.identifyBroker(csvContent);
            if (!identifiedBroker && lowercaseBroker !== 'any') {
                throw new Error("Could not identify broker from CSV content. Please specify broker name.");
            }
        }

        // Get broker instance
        const broker = options.broker || this.get_broker(identifiedBroker, options);
        if (!broker) {
            throw new Error(`Unsupported broker: ${identifiedBroker || 'any (auto-detected)'}`);
        }

        // Create empty trades container
        let existing_trades = options.trades || new models.Trades();

        // Use broker-specific content loading
        const result = broker.load_content(
            existing_trades,
            csvContent,
            {
                index: 0,
                offset: 0,
                ...options
            }
        );
        return result;
    }

    get_broker(name, options) {
        try {
            if (!name || name.toLowerCase() === 'any') {
                // make sure all the columns are here
                // col-symbol
                // col-date
                // col-quantity
                // col-price
                // col-type
                return new Any(options);
            }

            // Binance keeps ledger rows while multiple part files are loaded,
            // so each calculation needs a fresh adapter instance.
            if (name.toLowerCase() === 'binance') {
                return new Binance(options);
            }

            const brokerInstance = this[name.toLowerCase()]; // Ensure lowercase access
            if (!brokerInstance) {
                console.error("Unknown broker: " + name);
                return null;
            }
            return brokerInstance;
        } catch (e) {
            console.error("Error: " + e.message);
        }
        return null;
    };

}

module.exports = new Brokers();
