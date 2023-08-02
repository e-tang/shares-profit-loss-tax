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

let symbols_array = Array.from(trades.symbols);
symbols_array.forEach(function ([symbol, transactions]) {
    // let transactions = trades.symbols.get(symbol);
    transactions.sort(transaction_sort);

    // need to merge transactions if they have the exact same date and time
    // this could happen when the transaction records are exported from CommSec
    // they only have date, not time
    let merged_transactions = [];
    let last_transaction = transactions[0];
    merged_transactions.push(last_transaction);

    for (let i = 1; i < transactions.length; i++) {
        
        let transaction = transactions[i];

        if (last_transaction.date.getTime() == transaction.date.getTime()) {

            function merge_transaction(new_transaction, transaction) {
                if (transaction.type == "buy") {
                    new_transaction.quantity += transaction.quantity;
                    new_transaction.price += transaction.price;
                    new_transaction.total += transaction.total;
                }
                else if (transaction.type == "sell") {
                    new_transaction.quantity -= transaction.quantity;
                    new_transaction.price -= transaction.price;
                    new_transaction.total -= transaction.total;
                }
                new_transaction.value += transaction.value;
                new_transaction.fee += transaction.fee;
                new_transaction.gst += transaction.gst;
            }

            if (last_transaction.type == "merged") {
                // merge_transaction(last_transaction, transaction);
                // not to worried, it has been merged already
                merged_transactions.push(transaction);
                last_transaction = transaction;
            }
            else {
                // remove the last_transaction
                merged_transactions.pop();

                let new_transaction = new models.Transaction();
                new_transaction.date = last_transaction.date;
                new_transaction.company = last_transaction.company;
                new_transaction.symbol = last_transaction.symbol;
                new_transaction.description = last_transaction.description;
                new_transaction.category = last_transaction.category;

                new_transaction.type = "merged";
                new_transaction.id = last_transaction.id;
                merge_transaction(new_transaction, last_transaction);
                merge_transaction(new_transaction, transaction);
                merge_transaction.count = last_transaction.count + transaction.count;

                last_transaction = new_transaction;

                merged_transactions.push(new_transaction);
            }

            if (last_transaction.quantity != 0) {
                last_transaction.total = Math.abs(last_transaction.total);
                last_transaction.value = Math.abs(last_transaction.value);

                //
                if (last_transaction.quantity > 0) {
                    // buy
                    last_transaction.type = "buy";
                }
                else {
                    // sell
                    last_transaction.type = "sell";
                }
                last_transaction.quantity = Math.abs(last_transaction.quantity);
            }

        }
        else {
            merged_transactions.push(transaction);
            last_transaction = transaction;
        }
    }

    broker.update_holding(portfolio, symbol, merged_transactions);
});

console.log("Total symbols traded: " + trades.symbols.size);
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
        console.log(holding.company + "(" + holding.symbol + "): " + holding.quantity + " @ " + holding.average_price);
    }
});
console.log("==============================");
years_array.forEach(function (year) {
    let financial_year_pl = broker.calculate_financial_year_profit(portfolio, year);

    if (financial_year_pl.total_trades == 0) {
        return;
    }

    console.log("==============================");
    console.log("Computing profit / loss for financial year: " + year);

    console.log("Total profit / loss: " + financial_year_pl.profit);
    console.log("Total cost: " + financial_year_pl.total_cost);
    console.log("Total profit eligible for discount: " + financial_year_pl.profit_discount);
    console.log("Total buy (inc. brokerage): " + financial_year_pl.total_buy);
    console.log("Total sell (inc. brokerage): " + financial_year_pl.total_sell);
    console.log("Total trades: " + financial_year_pl.total_trades);
    console.log();
    console.log("All profit: " + financial_year_pl.total_profit_gain);
    console.log("All loss: " + financial_year_pl.total_profit_loss);
    console.log();
    console.log("Total winning trades: " + financial_year_pl.total_profit_trades);
    console.log("Total losing trades: " + financial_year_pl.total_loss_trades);
    console.log();
    console.log("Biggest winning trade: " + financial_year_pl.trade_profit_max.toString());
    console.log("Biggest losing trade: " + financial_year_pl.trade_loss_max.toString());
    console.log("==============================");
});


