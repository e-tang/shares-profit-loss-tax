/**
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const models = require("../lib/models");
const utils = require("../lib/utils");

function Broker () {
    this.name = "general";
    this.shortsell_allowed = false;
    this.missing_trades = new Map();
}

Broker.prototype.load = function (files, offset) {
    throw new Error("Not implemented");
}

Broker.prototype.calculate_financial_year_profit = function (portfolio, year) {
    let financial_year = new models.FinancialYear();
    financial_year.year = year;
    let total_profit = 0;
    let total_profit_gain = 0;
    let total_profit_loss = 0;
    let total_profit_trades = 0;    // round trip count that makes profit
    let total_loss_trades = 0;      // round trip count that makes loss
    let total_discount = 0;
    let total_trades = 0;
    let total_cost = 0;
    let total_buy = 0;
    let total_sell = 0;
    let trade_profit_max = new models.Trade();
    let trade_loss_max = new models.Trade();

    portfolio.holdings.forEach(function (holding) {
        let profits_year = holding.profits.get(year); // the list of profits for the year

        if (profits_year) {
            profits_year.forEach(function (profit) {
                total_profit += profit.profit;
                total_discount += profit.profit_for_discount;
                // total_trades += profit.transactions.length;
                if (profit.profit > 0) {
                    total_profit_gain += profit.profit;
                    total_profit_trades++;

                    if (profit.profit > trade_profit_max.profit) {
                        trade_profit_max.symbol = holding.symbol;
                        trade_profit_max.quantity = profit.quantity;
                        trade_profit_max.cost_price = profit.cost_price;
                        trade_profit_max.close_price = profit.close_price;
                        trade_profit_max.profit = profit.profit;
                    }
                } else {
                    total_profit_loss += profit.profit;
                    total_loss_trades++;

                    if (profit.profit < trade_loss_max.profit) {
                        trade_loss_max.symbol = holding.symbol;
                        trade_loss_max.quantity = profit.quantity;
                        trade_loss_max.cost_price = profit.cost_price;
                        trade_loss_max.close_price = profit.close_price;
                        trade_loss_max.profit = profit.profit;
                    }
                }

                total_cost += profit.cost;
            });
        }

        let trade_value = holding.trade_values.get(year);
        if (trade_value) {
            total_buy += trade_value.buy;
            total_sell += trade_value.sell;
            total_trades += trade_value.transactions.length;
        }
    });
    financial_year.profit = total_profit;
    financial_year.profit_discount = total_discount;
    financial_year.total_trades = total_trades;
    financial_year.total_cost = total_cost;
    financial_year.total_buy = total_buy;
    financial_year.total_sell = total_sell;
    financial_year.total_profit_gain = total_profit_gain;
    financial_year.total_profit_loss = total_profit_loss;
    financial_year.total_profit_trades = total_profit_trades;
    financial_year.total_loss_trades = total_loss_trades;
    financial_year.trade_profit_max = trade_profit_max;
    financial_year.trade_loss_max = trade_loss_max;
    return financial_year;
}

Broker.prototype.get_holding_profits_year = function (holding, financial_year) {
    // now decide which financial year the transaction belongs to
    // for any given year, the financial year is from 1 July of previous year to 30 June of current year
    // e.g. for 2018, the financial year is from 1 July 2018 to 30 June 2019
    let profits_year = holding.profits.get(financial_year);
    if (profits_year == null) {
        profits_year = [];
        holding.profits.set(financial_year, profits_year);
    }
    return profits_year;
}

Broker.prototype.calculate_profit = function (holding, transaction, transactions, financial_year) {

    let profit = new models.Profit();

    /**
     * maybe there are a few ways to calculate the average price
     * 1. change the average price
     * 2. keep the average price
     */
    // let left_cost = holding.cost - transaction.total;
    // holding.average_price = left_cost / holding.quantity;

    let cost = holding.quantity == transaction.quantity ? holding.cost : holding.average_price * transaction.quantity;
    let profit_num = transaction.total - cost;

    profit.quantity = transaction.quantity;
    profit.cost = cost;
    profit.cost_price = holding.average_price;
    profit.close_price = transaction.price;
    profit.profit_price = profit.close_price - profit.cost_price; // profit per share
    profit.profit = profit_num;

    profit.transactions.push(transaction);

    // now we need to decide whether there is discount for the capital gain
    let acquired_quantity = 0;

    let last_transaction = null;
    transactions.pop(); // remove the last transaction, which is the current transaction

    while((last_transaction = transactions.pop()) != null) {
        profit.transactions.unshift(last_transaction);

        acquired_quantity += last_transaction.quantity;

        // now check if the asset hold more than 12 months
        // if so, then there is discount for the capital gain
        // worry about the discount only if there is profit
        if (profit_num > 0) {
            let year = last_transaction.date.getFullYear();
            let close_year = transaction.date.getFullYear();
            if (year != close_year) {
                let month = last_transaction.date.getMonth();
                let close_month = transaction.date.getMonth();
                if (month <= close_month) {
                    let day = last_transaction.date.getDate();
                    let close_day = transaction.date.getDate();

                    if (day < close_day) {
                        // the asset is hold more than 12 months
                        profit.discount_eligible = true;
                        profit.discount_quantity += last_transaction.quantity;
                    }
                }
            }
        }

        if (acquired_quantity >= transaction.quantity) {
            profit.year_init = last_transaction.date;
            profit.year_close = transaction.date;

            let year1 = utils.get_financial_year(last_transaction.date);
            let year2 = utils.get_financial_year(transaction.date);
            if (year1 != year2) {
                console.log("Close trade that spans over 2 financial years");
                console.log("Symbol: " + transaction.symbol);
                console.log("Trade 1: " + last_transaction.date.toISOString() + " " + last_transaction.type + " " + last_transaction.quantity);
                console.log("Trade 2: " + transaction.date.toISOString() + " " + transaction.type + " " + transaction.quantity);
            }

            if (acquired_quantity > transaction.quantity) {
                // the last transaction is not fully used
                // so we need to put it back to the stack
                let adjusted_transaction = last_transaction.copy();
                adjusted_transaction.quantity = acquired_quantity - transaction.quantity;
                transactions.push(adjusted_transaction);
            }
            break;
        }

    }

    let profits_year = this.get_holding_profits_year(holding, financial_year);
    profits_year.push(profit);

    holding.profit += profit_num;

    if (holding.average_close == 0)
        holding.average_close = transaction.price;
    else
        holding.average_close = (holding.average_close + transaction.price) / 2;

    // return profit;
}

Broker.prototype.update_holding = function (portfolio, symbol, trades) {
    if (!trades || trades.length == 0) {
        console.log("No trades to update");
        return;
    }

    let transactions = [];

    // Update portfolio
    let holding = null;
    // let symbol = trades[0].symbol;
    if (portfolio.holdings.has(symbol)) {
        holding = portfolio.holdings.get(symbol);
    }

    // let last_transaction = null;

    for (let i = 0; i < trades.length; i++)
    {
        let transaction = trades[i];

        if (!holding) {
            // new holding
            holding = new models.Holding();
            holding.symbol = symbol;
            holding.company = transaction.company;
            portfolio.holdings.set(symbol, holding);
        }

        let financial_year = utils.get_financial_year(transaction.date);

        let trade_value = holding.trade_values.get(financial_year);
        if (!trade_value) {
            trade_value = new models.TradeValue();
            trade_value.year = financial_year;
            holding.trade_values.set(financial_year, trade_value);
        }

        transactions.push(transaction);
        trade_value.transactions.push(transaction);

        if (transaction.type == "buy") {
            trade_value.buy += transaction.total;

            if (holding.quantity == 0) {
                holding.average_price = transaction.price; // holding.cost / holding.quantity;
                holding.cost = transaction.total;    
            }
            else if (holding.quantity > 0) {
                // increase the position
                holding.average_price = (holding.cost + transaction.total) / (holding.quantity + transaction.quantity);
                holding.cost += transaction.total;    
            }
            else {
                this.calculate_profit(holding, transaction, transactions, financial_year);
            }

            holding.quantity += transaction.quantity;                    
        }
        else if (transaction.type == "sell") {
            trade_value.sell += transaction.total;

            if (holding.quantity == 0) {
                // todo : handle this case
                // short selling, initialise a new position
                holding.average_price = transaction.price;
                holding.cost = transaction.total;    
            }
            else if ( holding.quantity > 0) {
                this.calculate_profit(holding, transaction, transactions, financial_year);
                holding.cost -= transaction.total;
            }
            else {
                // short selling, increase the position
                // the profit is the negative of the cost
                holding.average_price = (holding.cost + transaction.total) / Math.abs(holding.quantity - transaction.quantity);
                holding.cost += transaction.total;
            }

            holding.quantity -= transaction.quantity;

            // if (holding.quantity == 0) {
            //     holding.average_price = 0;
            //     holding.cost = 0;
            //     holding.average_close = 0;
            // }
        }
        else if (transaction.type == "merged") {
            // same date / same timeframe trades
            let profit = new models.Profit();
            profit.year_init = transaction.date;
            profit.year_close = transaction.date;
            profit.quantity = transaction.quantity;
            profit.cost = transaction.value;
            profit.profit = -transaction.total;
            profit.close_price = transaction.price;
            profit.transactions.push(transaction);

            holding.profit += profit.profit;
            let profits_year = this.get_holding_profits_year(holding, financial_year);
            profits_year.push(profit);
        }
        // else if (transaction.type == "dividends") {
        // }
        // else if (transaction.type == "deposit") {
        // }
        // else if (transaction.type == "withdraw") {
        // }
        else {
            console.error("Unknown transaction type: " + transaction.type);
            process.exit(1);
        }

        last_transaction = transaction;
    }
}

module.exports = Broker;