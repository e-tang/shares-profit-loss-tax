/**
 * Copyright (c) 2024 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const brokers = require('./brokers');
const models = require('./lib/models');
const utils = require('./lib/utils');
const fs = require('fs');
const app_data = require('./data');

const { normalizeData } = require('./brokers')

/**
 * Sort transactions by date
 * @param {Object} a First transaction
 * @param {Object} b Second transaction
 * @returns {number} Sort order
 */
function transaction_sort(a, b) {
    if (a.date < b.date)
        return -1;
    else if (a.date > b.date)
        return 1;
    else
        return 0;
}

/**
 * Process trades and calculate profits/losses
 * @param {string|Array} input CSV string or array of file paths
 * @param {Object} options Configuration options
 * @returns {Object} Result object with portfolio and profit/loss information
 */
function processTrades(input, options = {}) {
    const defaults = {
        broker: null,
        save: false,
        'portfolio-file': "portfolio.json",
        year: -1,
        details: false,
        symbol: null,
        ignore: [],
        'col-symbol': null,
        'col-date': null,
        'col-quantity': null,
        'col-price': null,
        'col-type': null,
        'col-total': null,
        'col-commission': null,
        'col-fees': null,
        'col-tax': null,
        'col-exchange': null,
        'col-currency': null,
        'adjust-transaction': true,
        'price-unit': 0.01,
    };

    // Merge default options with provided options
    const opts = { ...defaults, ...options };

    // Load trades
    let trades;
    
    // Handle string input (CSV content) or file paths
    if (typeof input === 'string' && (!Array.isArray(input) || input.includes('\n'))) {
        // Input is CSV content string
        trades = new models.Trades();
        // broker.load_content(trades, input, { index: 0, offset: 0 });
        trades = normalizeData(input, opts.broker, {index: 0, offset: 0, ...opts});
    } else {
        // Input is a file path or array of file paths
        // Get broker
        const broker = brokers.get_broker(opts.broker || null, opts);
        if (!broker) {
            throw new Error("Unsupported broker: " + opts.broker);
        }
        trades = broker.load(input);
    }

    return processTradesWithRecords(trades, broker, opts);
}

/**
 * Process trade records and calculate profits/losses
 * @param {Object} trades Trade records from broker
 * @param {Object} broker Broker instance
 * @param {Object} options Configuration options
 * @returns {Object} Result object with portfolio and profit/loss information
 */
function processTradesWithRecords(trades, broker, options = {}) {
    // Create portfolio
    const portfolio = new models.Portfolio();
    
    // Process symbols to ignore
    const symbols_to_ignore = new Set(options.ignore);
    
    // Filter symbols if specified
    let symbols_array = null;
    if (options.symbol && options.symbol.length > 0) {
        symbols_array = [];
        const symbols = typeof options.symbol === 'string' ? options.symbol.split(',') : options.symbol;
        symbols.forEach(function (symbol) {
            const transactions = trades.symbols.get(symbol);
            if (transactions) {
                symbols_array.push([symbol, transactions]);
            }
        });
    } else {
        symbols_array = Array.from(trades.symbols);
    }

    // Process each symbol's transactions
    symbols_array.forEach(function ([symbol, transactions]) {
        if (symbols_to_ignore.has(symbol))
            return;
        
        transactions.sort(transaction_sort);
        broker.update_holding(portfolio, symbol, transactions, app_data);
    });

    // Determine years to process
    const years_array = options.year > -1 ? [options.year] : Array.from(trades.years);
    years_array.sort();
    years_array.unshift(years_array[0] - 1);
    
    // Calculate financial year profits
    const results = {
        portfolio: portfolio,
        trades: trades,
        symbols_count: symbols_array.length,
        first_trade: trades.first,
        last_trade: trades.last,
        years_traded: trades.years.size,
        financial_years: {}
    };

    // Calculate for each financial year
    years_array.forEach(function (year) {
        const financial_year_pl = broker.calculate_financial_year_profit(
            portfolio,
            year,
            {
                details: options.details
            }
        );

        if (financial_year_pl.total_trades === 0) {
            return;
        }

        const financial_year_str = year + "-" + (year + 1);
        results.financial_years[financial_year_str] = financial_year_pl;
    });

    // Calculate holdings summary
    results.holdings = [];
    results.remaining_cost = 0;
    
    portfolio.holdings.forEach(function (holding) {
        if (holding.quantity > 0) {
            const cost = holding.average_price * holding.quantity;
            results.remaining_cost += cost;
            
            results.holdings.push({
                symbol: holding.symbol,
                quantity: holding.quantity,
                average_price: holding.average_price,
                cost: cost,
                profit: holding.profit
            });
        }
    });

    // Save portfolio if requested
    if (options.save && options['portfolio-file']) {
        fs.writeFileSync(options['portfolio-file'], JSON.stringify(portfolio, null, 4));
    }

    return results;
}

module.exports = {
    processTrades,
    processTradesWithRecords,
    models,
    utils,
    brokers
};