/**
 * Copyright (c) 2024 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const Params = require('node-programmer/params');
const brokers = require('./brokers');
const models = require('./lib/models');

const fs = require('fs');

/*
 consolidation or split data
 at the moment we are assuming the consolidation or split only happens once
 */
let app_data = require('./data');

var params = new Params({
    "broker": null,
    "save": true,
    "portfolio-file": "portfolio.json",
    "year": -1,
    "details": false,
    "symbol": null,
    "ignore": [],
    "col-symbol": null,
    "col-date": null,
    "col-quantity": null,
    "col-price": null,
    "col-type": null,
    "col-total": null,
    "col-commission": null,
    "col-fees": null,
    "col-tax": null,
    "col-exchange": null,
    "col-currency": null,
    "adjust-transaction": true,
});

var opts = params.getOpts();
// var optCount = params.geOptCount();
var input = opts['---'];
var trades;

let broker = brokers.get_broker(opts.broker, opts);

if (!broker) {
    if (opts.broker) {
        console.error("Unsupported broker: " + opts.broker);
    }
    console.log("Usage: node index.js --broker <broker> [--save] [--portfolio-file <file>] [--year <year>] [--details] [--symbol <symbol>] [--ignore <symbol>] [--col-symbol <index>] [--col-date <index>] [--col-quantity <index>] [--col-price <index>] [--col-type <index>] <input>");

    process.exit(1);
}
trades = broker.load(input);

function transaction_sort(a, b) {
    if (a.date < b.date)
        return -1;
    else if (a.date > b.date)
        return 1;
    else
        return 0;
}

let portfolio = new models.Portfolio();

let symbols_to_ignore = new Set(opts.ignore);

let symbols_array = null;
if (opts.symbol && opts.symbol.length > 0) {
    symbols_array = [];
    let symbols = opts.symbol.split(',');
    symbols.forEach(function (symbol) {
        let transactions = trades.symbols.get(symbol);
        if (transactions) {
            symbols_array.push([symbol, transactions]);
        }
    });
}
else {
    symbols_array = Array.from(trades.symbols);
}
symbols_array.forEach(function ([symbol, transactions]) {
    if (symbols_to_ignore.has(symbol))
        return;
    
    transactions.sort(transaction_sort);

    broker.update_holding(portfolio, symbol, transactions, app_data);
});

console.log("Total symbols traded: " + /* trades.symbols.size */symbols_array.length);
console.log("First trade: " + trades.first);
console.log("Last trade: " + trades.last);
console.log("Years traded: " + trades.years.size);

let years_array = opts.year > -1 ? [opts.year] : Array.from(trades.years);

years_array.sort();
years_array.unshift(years_array[0] - 1);

// console.log("==============================");
// console.log("Current portfolio:");
// portfolio.holdings.forEach(function (holding) {
//     if (holding.quantity > 0) {
//         console.log((holding.company || "") + "(" + holding.symbol + "): " + holding.quantity + " @ " + holding.average_price);
//     }
// });
console.log("==============================");
years_array.forEach(function (year) {
    let financial_year_pl = broker.calculate_financial_year_profit(
        portfolio, 
        year,
        {
            details: opts.details
        }
        );

    if (financial_year_pl.total_trades == 0) {
        return;
    }

    let financial_year_str = year + "-" + (year + 1);

    console.log("==============================");
    console.log("Computing profit / loss for financial year: " + financial_year_str);

    // console.log("Should be profit / loss: " + (financial_year_pl.total_buy - financial_year_pl.total_sell));
    console.log("Total profit / loss: " + financial_year_pl.profit);
    console.log("Total cost: " + financial_year_pl.total_cost);
    console.log("Total profit eligible for discount: " + financial_year_pl.profit_discount);
    console.log("Total buy (inc. brokerage): " + financial_year_pl.total_buy);
    console.log("Total sell (inc. brokerage): " + financial_year_pl.total_sell);
    console.log("Total trades: " + financial_year_pl.total_trades);
    console.log();
    console.log("Cumulative profit: " + financial_year_pl.total_profit_gain);
    console.log("Cumulative loss: " + financial_year_pl.total_profit_loss);
    console.log();
    console.log("Total winning trades: " + financial_year_pl.total_profit_trades);
    console.log("Total losing trades: " + financial_year_pl.total_loss_trades);
    console.log();
    console.log("Biggest winning trade: " + financial_year_pl.trade_profit_max.toString());
    console.log("Biggest losing trade: " + financial_year_pl.trade_loss_max.toString());
    console.log();
    // console.log("At the end of the financial year portfolio (" + financial_year_str + "):");

    console.log("==============================");
});


// Now show the current portfolio
console.log();
console.log("==============================");
let remaining_cost = 0;
portfolio.holdings.forEach(function (holding) {
    if (holding.quantity > 0) {
        let cost = holding.average_price * holding.quantity;
        console.log((holding.symbol || "") + ": " /* "(" + holding.company + "): " */ + holding.quantity + "@" + holding.average_price) + ", cost: " + cost;
        remaining_cost += cost;
    }
});
console.log("Portfolio cost: " + remaining_cost);
console.log("");

console.log("Saving portfolio to file: " + opts['portfolio-file']);
if (opts.save) {
    fs.writeFileSync(opts['portfolio-file'], JSON.stringify(portfolio, null, 4));
}
// console.log("Total buy and sell offset: " + (financial_year_pl.total_buy + financial_year_pl.total_sell));
