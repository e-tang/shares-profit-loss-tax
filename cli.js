#!/usr/bin/env node

/**
 * Copyright (c) 2024 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const Params = require('node-programmer/params');
const sprolosta = require('./lib');

// Parse command line parameters
const params = new Params({
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
    "price-unit": 0.01,
});

const opts = params.getOpts();
const input = opts['---'];

// broker is no longer essential to be provided in the argumetn
if (!input || input.length === 0) {
    console.log("Usage: sprolosta --broker <broker> [--save] [--portfolio-file <file>] [--year <year>] [--details] [--symbol <symbol>] [--ignore <symbol>] [--col-symbol <index>] [--col-date <index>] [--col-quantity <index>] [--col-price <index>] [--col-type <index>] <input>");
    process.exit(1);
}

try {
    // Process trades using the library
    const results = sprolosta.processTrades(input, opts);
    
    // Display results
    console.log("Total symbols traded: " + results.symbols_count);
    console.log("First trade: " + results.first_trade);
    console.log("Last trade: " + results.last_trade);
    console.log("Years traded: " + results.years_traded);
    
    console.log("==============================");
    
    // Display financial year results
    Object.entries(results.financial_years).forEach(([yearStr, financial_year_pl]) => {
        console.log("==============================");
        console.log("Computing profit / loss for financial year: " + yearStr);
        
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
    });
    
    // Now show the P/L for each symbol
    console.log("");
    console.log("==============================");
    results.holdings.forEach(function (holding) {
        console.log((holding.symbol || "") + "> P/L:" + holding.profit.toFixed(2));
    });
    console.log("");
    
    // Now show the current portfolio
    console.log();
    console.log("==============================");
    results.holdings.forEach(function (holding) {
        console.log(holding.symbol + "> " + holding.quantity + "@" + holding.average_price.toFixed(3) + ", cost: " + holding.cost);
    });
    console.log("Portfolio cost: " + results.remaining_cost);
    console.log("");
    
    if (opts.save) {
        console.log("Saving portfolio to file: " + opts['portfolio-file']);
    }
    
} catch (error) {
    console.error("Error processing trades:", error.message);
    process.exit(1);
}