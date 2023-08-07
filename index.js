/**
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const Params = require('node-programmer/params');
const brokers = require('./brokers');
const models = require('./lib/models');

var params = new Params({
    "broker": "default",
    "save": false,
    "portfolio-file": "portfolio.json",
    "year": -1,
    "details": false,
    "symbol": null,
});

var opts = params.getOpts();
// var optCount = params.geOptCount();

let broker = brokers[opts.broker];
var input = opts['---'];
let trades = broker.load(input);

function transaction_sort(a, b) {
    if (a.date < b.date)
        return -1;
    else if (a.date > b.date)
        return 1;
    else
        return 0;
}

let portfolio = new models.Portfolio();

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

    transactions.sort(transaction_sort);

    broker.update_holding(portfolio, symbol, transactions);
});

console.log("Total symbols traded: " + /* trades.symbols.size */symbols_array.length);
console.log("First trade: " + trades.first);
console.log("Last trade: " + trades.last);
console.log("Years traded: " + trades.years.size);

let years_array = opts.year > -1 ? [opts.year] : Array.from(trades.years);

years_array.sort();
years_array.unshift(years_array[0] - 1);

// Now show the current portfolio
console.log("==============================");
console.log("Current portfolio:");
portfolio.holdings.forEach(function (holding) {
    if (holding.quantity > 0) {
        console.log((holding.company || "") + "(" + holding.symbol + "): " + holding.quantity + " @ " + holding.average_price);
    }
});
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

    console.log("==============================");
    console.log("Computing profit / loss for financial year: " + year);

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
    console.log("==============================");
});


