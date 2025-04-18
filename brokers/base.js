/**
 * Copyright (c) 2023 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const models = require("../lib/models");
const utils = require("../lib/utils");

const fs = require("fs");

function Broker () {
    this.name = "general";
    this.shortsell_allowed = false;
    this.missing_trades = new Map();
    this.minimum_commas_count = 5; // 6 columns at least
    this.quote_count_needed = false;
}

Broker.prototype.load = function (files, offset) {
    throw new Error("Not implemented");
}

Broker.prototype.calculate_financial_year_profit = function (portfolio, year, options) {
    options = options || {};
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
            let sub_discount = 0;
            let sub_profit = 0;
            let sub_profit_gain = 0;
            let sub_profit_loss = 0;
            let sub_profit_trades = 0;
            let sub_loss_trades = 0;
            let sub_trades = 0;
            let sub_cost = 0;

            profits_year.forEach(function (profit) {
                if (profit.discount_eligible)
                    sub_discount += profit.profit;
                else
                    sub_profit += profit.profit;
                // sub_trades += profit.transactions.length;
                if (profit.profit > 0) {
                    sub_profit_gain += profit.profit;
                    sub_profit_trades++;

                    if (profit.profit > trade_profit_max.profit) {
                        trade_profit_max.symbol = holding.symbol;
                        trade_profit_max.quantity = profit.quantity;
                        trade_profit_max.cost_price = profit.cost_price;
                        trade_profit_max.close_price = profit.close_price;
                        trade_profit_max.profit = profit.profit;
                        trade_profit_max.type = profit.trade_type;
                    }
                } else {
                    sub_profit_loss += profit.profit;
                    sub_loss_trades++;

                    if (profit.profit < trade_loss_max.profit) {
                        trade_loss_max.symbol = holding.symbol;
                        trade_loss_max.quantity = profit.quantity;
                        trade_loss_max.cost_price = profit.cost_price;
                        trade_loss_max.close_price = profit.close_price;
                        trade_loss_max.profit = profit.profit;
                        trade_loss_max.type = profit.trade_type;
                    }
                }

                sub_cost += profit.cost;
            });

            total_profit += sub_profit;
            total_profit_gain += sub_profit_gain;
            total_profit_loss += sub_profit_loss;
            total_profit_trades += sub_profit_trades;
            total_loss_trades += sub_loss_trades;
            total_discount += sub_discount;
            total_trades += sub_trades;
            total_cost += sub_cost;

            if (options.details) {
                console.log("Year" + year +" details for " + holding.symbol + ":");
                console.log("Profit: " + sub_profit);
                console.log("Profit gain: " + sub_profit_gain);
                console.log("Profit loss: " + sub_profit_loss);
                console.log("Profit trades: " + sub_profit_trades);
                console.log("Loss trades: " + sub_loss_trades);
                console.log("Discount: " + sub_discount);
                console.log("Trades: " + sub_trades);
                console.log("Cost: " + sub_cost);
            }    
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

Broker.prototype.calculate_profit = function (holding, transaction, financial_year) {
    let profits_year = this.get_holding_profits_year(holding, financial_year);

    let transactions = holding.records;
    // transactions.pop(); // remove the last transaction, which is the current transaction
    let last_transaction = transactions.pop();
    // now we need to decide whether there is discount for the capital gain
    let acquired_quantity_abs = 0;
    let acquired_quantity = 0;
    let quantity_target = Math.abs(transaction.quantity);
    let quantity_balance = quantity_target;
    // let quantity_surplus = 0;

    let profit_all = 0;
    let cost_all = 0;
    // let fee_absorbed = false;

    while(last_transaction) {
        if (last_transaction.type == transaction.type) {
            console.error("The last transaction is the same type as the current transaction");
            console.error("Last transaction: " + JSON.stringify(last_transaction));
            console.error("Current transaction: " + JSON.stringify(transaction));
            process.exit(1);
        }
        
        acquired_quantity += (last_transaction.quantity);
        let quantity_last = Math.abs(last_transaction.quantity);
        let profit_quantity = 0;
        let cost = 0;
        if ((acquired_quantity_abs = Math.abs(acquired_quantity)) <= quantity_target) {
            profit_quantity = quantity_last;
            quantity_balance = quantity_target - acquired_quantity_abs;
            // there are a couple of ways to calculate the cost
            // using the average price
            // using the last transaction total
            // cost = last_transaction.total;
        }
        else {
            profit_quantity = quantity_balance;
            quantity_balance = 0;
        }
        // fees are absorbed in the average price
        cost = /* (quantity_last <= profit_quantity ? last_transaction.value : */ ((holding.average_price * profit_quantity))/*  + last_transaction.fee */;
        cost_all += cost;

        let profit = new models.Profit();

        /**
         * maybe there are a few ways to calculate the average price
         * 1. change the average price
         * 2. keep the average price
         */
        // let left_cost = holding.cost - transaction.total;
        // holding.average_price = left_cost / holding.quantity;
    
        // let cost = holding.quantity == quantity_target ? holding.cost : holding.average_price * transaction.quantity;
        let current_total = null;
        if (transaction.total)
            current_total = transaction.total;
        else
            current_total = transaction.price * profit_quantity; // transaction.value;
        // the reason for this complication is that the price unit of the instructment price could be different from the total value
        let profit_num = last_transaction.quantity > 0 ? (current_total - cost) : (cost - current_total);
        // if (fee_absorbed == false) {
        //     // if there are multiple transactions, then only the last transaction will absorb the fee
        //     profit_num -= transaction.fee;
        //     fee_absorbed = true;
        // }

        profit_all += profit_num;
    
        profit.quantity = profit_quantity;
        profit.cost = cost;
        profit.cost_price = holding.average_price;
        profit.close_price = transaction.price;
        profit.profit_price = profit.close_price - profit.cost_price; // profit per share
        profit.profit = profit_num;
        profit.transaction_open = last_transaction;
        profit.transaction_close = transaction;
        profit.trade_type = last_transaction.type;
    
        // profit.transactions.unshift(last_transaction);
        profits_year.push(profit);

        // now check if the asset hold more than 12 months
        // if so, then there is discount for the capital gain
        // worry about the discount only if there is profit
        if (profit_num > 0) {
            let year = last_transaction.date.getFullYear();
            let close_year = transaction.date.getFullYear();
            if (year != close_year) {
                if (close_year - year > 1) {
                    profit.discount_eligible = true;
                }
                else {
                    let month = last_transaction.date.getMonth();
                    let close_month = transaction.date.getMonth();
                    if (month <= close_month) {

                        if ((close_month - month) > 1) {
                            profit.discount_eligible = true;
                        }
                        else {
                            let day = last_transaction.date.getDate();
                            let close_day = transaction.date.getDate();

                            if (day <= close_day) {
                                // the asset is hold more than 12 months
                                profit.discount_eligible = true;
                                // profit.discount_quantity += last_transaction.quantity;
                            }
                        }
                    }
                }
            }
        }

        if (acquired_quantity_abs >= quantity_target) {
            profit.year_init = last_transaction.date;
            profit.year_close = transaction.date;

            let year1 = utils.get_financial_year(last_transaction.date);
            let year2 = utils.get_financial_year(transaction.date);
            if (year1 != year2) {
                console.debug("Close trade that spans over 2 financial years");
                console.debug("Symbol: " + transaction.symbol);
                console.debug("Trade 1: " + last_transaction.date.toISOString() + " " + last_transaction.type + " " + last_transaction.quantity);
                console.debug("Trade 2: " + transaction.date.toISOString() + " " + transaction.type + " " + quantity_target);
            }

            // if (acquired_quantity_abs > quantity_target) {
            //     // the last transaction is not fully used
            //     // so we need to put it back to the stack
            //     let adjusted_transaction = last_transaction.copy();
            //     adjusted_transaction.quantity = acquired_quantity - quantity_target;
            //     transactions.push(adjusted_transaction);
            // }
            break;
        }

        last_transaction = transactions.pop();
    }

    if (acquired_quantity_abs < quantity_target) {
        // we didn't acquire enough quantity so this becomes opening a new position in the opposition direction 
        // there is surplus, need to put it back to the transactions / holding
        let quantity_surplus = transaction.quantity + acquired_quantity;
        // holding.quantity += quantity_surplus;
        // holding.cost += transaction.total - ;
        // holding.average_price = transaction.price; // holding.cost / holding.quantity;
        transaction.quantity = quantity_surplus;
        transaction.value = transaction.price * quantity_surplus;
        transaction.total = transaction.value + transaction.fee;
        transactions.push(transaction);
    }
    else if (acquired_quantity_abs > quantity_target) {
        // position partially closed
        if (!last_transaction) {
            console.error("No last transaction");
            process.exit(1);
        }
        // keep the average price
        // holding.average_price = last_transaction.price;

        last_transaction.quantity = acquired_quantity + transaction.quantity;
        // last_transaction.fee = 0; // it is already included in the profit
        last_transaction.value = last_transaction.price * last_transaction.quantity;
        last_transaction.total = holding.average_price * last_transaction.quantity;
        transactions.push(last_transaction);
    }
    else {
        // position fully closed
    }
    holding.average_close = holding.average_close == 0 ? transaction.price : (holding.average_close + transaction.price) / 2;
    holding.profit += (profit_all /* - transaction.fee */);
    return profit_all;
}

Broker.prototype.update_holding = function (portfolio, symbol, trades, app_data) {
    if (!trades || trades.length == 0) {
        console.log("No trades to update");
        return;
    }

    // let transactions = [];

    // Update portfolio
    let holding = null;
    // let symbol = trades[0].symbol;
    if (portfolio.holdings.has(symbol)) {
        holding = portfolio.holdings.get(symbol);
    }

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

        trade_value.transactions.push(transaction);
        if (transaction.total) {
            if (transaction.type == "buy") {
                trade_value.buy += transaction.total;
            }
            else if (transaction.type == "sell") {
                trade_value.sell += transaction.total;
            }
            else {
                console.error("Unknown transaction type: " + transaction.type);
                process.exit(1);
            }
        }
        else {
            if (transaction.type == "buy") {
                trade_value.buy += transaction.price * transaction.quantity;
            }
            else if (transaction.type == "sell") {
                trade_value.sell += transaction.price * transaction.quantity;
            }
            else {
                console.error("Unknown transaction type: " + transaction.type);
                process.exit(1);
            }
        }
        // else if (transaction.type == "dividends") {
        // }
        // else if (transaction.type == "deposit") {
        // }
        // else if (transaction.type == "withdraw") {
        // }

        let quantity = transaction.quantity;
        let transaction_value = transaction.value;
        let transaction_cost = transaction.total;
        if (quantity != 0) {
            let cos_obj = app_data ? app_data.get_cos(symbol, transaction.date, holding.last_cos) : null;
            let cos = 1;
            if (cos_obj) {
                cos = cos_obj.cos;
                holding.last_cos = cos_obj.date;
                console.debug(`Instrument (${symbol}) consolidation or split before ${transaction.date.toISOString()}: ${cos}`);
            }

            if ((holding.quantity > 0 && quantity < 0) || 
                (holding.quantity < 0 && quantity > 0)) {
                // close the position fully or partially
                holding.quantity = holding.quantity * cos;
                holding.average_price /= cos;
                let profit = this.calculate_profit(holding, transaction, financial_year);
                // console.debug("Profit: " + profit);
            }
            else {
                // increasing the holding (long or short)
                // just update the position
                if (holding.quantity == 0) {
                    holding.average_price = transaction_cost / quantity; // holding.cost / holding.quantity;
                }
                else { 
                    // holding cost will be cumulated with the loss / profit, so we can't use it here 
                    // when the loss is realised and if the stock gets re-bought, the average price should reflect it
                    // holding.average_price = (holding.cost + transaction_cost) / (holding.quantity + quantity);

                    // since we have existing holding, we need to adjust the average price
                    // also if there is consolidation or split, the average price will be adjusted
                    // and the quantity will be adjusted accordingly too
                    let previous_cost = holding.average_price * holding.quantity;
                    holding.quantity = holding.quantity * cos;
                    holding.average_price = (previous_cost + transaction_cost) / (holding.quantity + quantity);
                    // console.debug("Average price now: " + holding.average_price)
                }
                if (holding.average_price < 0) {
                    console.error("Average price is negative: " + holding.average_price);
                    process.exit(1);
                }

                holding.records.push(transaction);
            }
            holding.quantity += quantity;

            if (holding.quantity == 0) 
            {
                // close the position
                // profit loss recorded, cost and value reset
                holding.cost = 0;
                holding.value = 0;
            }
            else {
                holding.cost += transaction_cost; // transaction.total;    
                holding.value += transaction_value; // transaction.value;
            }
        }
    }
}

Broker.prototype.quote_count_check = function (line) {
    if (!this.quote_count_needed)
        return true;

    var quote_count = (line.match(/"/g) || []).length;
    /**
     * as we need 
     * symbol, date, type, quantity, price and total at least
     * so we need at least 6 commas
     */
    return quote_count > (this.minimum_commas_count * 2) && (quote_count % 2) == 0;
}

/**
 * When this happens the line is normally the header line
 * 
 * @param {*} line 
 * @returns 
 */
Broker.prototype.is_data_line_started = function (line, index) {
    var count = (line.match(/,/g) || []).length;

    if (count < this.minimum_commas_count) {
        return false;
    }

    return this.quote_count_check(line);
}

Broker.prototype.is_data_line_ended = function (line, index) {
    return line.trim().length == 0;
}

Broker.prototype.adjust_transaction_common = function (transaction) {
    // adjust the transaction
    if (this.adjust_transaction) {
        if (transaction.type == 'sell') {
            transaction.quantity = -transaction.quantity;
            transaction.value = -transaction.value;
            transaction.total = -transaction.total;
        }
    }
}

Broker.prototype.line_to_transaction = function (fields) {
    throw new Error("Func (line_to_transaction) is Not implemented");
}

Broker.prototype.load_content_common = function (trades, content, options) {
    let { index, offset } = options;
    let count = 0;

    let lines = content.split('\n');
    for (let s = 0; s < offset; s++) {
        lines.shift();
    }
    let start = false;

    for (let j = 0; j < lines.length; j++) {
        let line = lines[j];

        if (!start) {
            // for CommSec, the first data line starts with "Code,"
            // if (line.startsWith("Code,")) 
            if (this.is_data_line_started(line))
                start = true;
            continue;
        }

        if (this.is_data_line_ended(line)) {
            break;
        }
        let fields = line.split(',');
        fields = fields.map(function (field) {
            try {
                return JSON.parse(field.trim());
            }
            catch (e) {
                // console.log("Error parsing field: " + field);
                return field.trim();
            }
        });

        let transaction = this.line_to_transaction(fields, (++count) + index);
        if (!transaction) {
            // not all CVS lines are transactions
            // e.g. the transaction records downloaded from the CommSec website
            continue;
        }

        if (trades.first == null || trades.first > transaction.date) {
            trades.first = transaction.date;
        }
        if (trades.last == null || trades.last < transaction.date) {
            trades.last = transaction.date;
        }

        let year = transaction.date.getFullYear();
        trades.years.add(year);
        
        let transactions = null;
        if (trades.symbols.has(transaction.symbol)) {
            transactions = trades.symbols.get(transaction.symbol);
        }
        else {
            transactions = [];
            trades.symbols.set(transaction.symbol, transactions);
        }

        transactions.push(transaction);
    }
    return count;
}

Broker.prototype.load_content = function (trades, content, options) {
    return this.load_content_common(trades, content, options);
}

/**
 * Load the broker's data from the CSV file.
 */
Broker.prototype.load = function (files, offset, options) {
    console.log(`Loading ${this.name} data...`);
    if (!options && typeof offset == 'object') {
        options = offset;
        offset = 0;
    }

    offset = offset || 0;
    options = options || {};

    let trades = new models.Trades();

    if (!Array.isArray(files)) {
        files = [files];
    }
    let count = 0;
    for (let i = 0; i < files.length; i++) {
        try {
            if (!fs.existsSync(files[i])) {
                console.error("File not found: " + files[i]);
                process.exit(1);
            }
            console.log("Loading transactions file: " + files[i])
            let content = fs.readFileSync(files[i], 'utf8');
            count += this.load_content(trades, content, { index: count, offset: offset });
        }
        catch (err) {
            console.log(err);
        }
    }

    return trades;
}

module.exports = Broker;