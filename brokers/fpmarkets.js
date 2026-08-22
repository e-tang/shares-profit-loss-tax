/**
 * @file fpmarkets.js
 * 
 * Copyright (c) 2025 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const Broker = require('./base');

const models = require('../lib/models');
const utils = require('../lib/utils');

class FPMarkets extends Broker {
    constructor(options) {
        super(options);

        this.name = "FP Markets";
        this.quote_count_needed = false;
        this.from_closed_positions = false;
    }

    /**
     * Detect the legacy share-transaction export or the newer cTrader
     * closed-position export before parsing its rows.
     */
    load_content(trades, content, options) {
        const header = content
            .split(/\r?\n/, 1)[0]
            .replace(/^\uFEFF/, '')
            .replace(/"/g, '');

        if (header.startsWith('ID,Open Time,Close Time,Account Code,Buy or Sell,Currency,Stock,Volume,Open Price,Close Price,Commission,Swaps,Profit')) {
            this.from_closed_positions = true;
        }
        else if (header.startsWith('ID,Date,Time,Account Code,Buy or Sell,Currency,Exchange,Stock,Volume,Price,Value')) {
            this.from_closed_positions = false;
        }
        else {
            throw new Error('Unknown FP Markets format');
        }

        return super.load_content(trades, content, options);
    }

    parse_date_time(value) {
        const match = String(value).trim().match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i
        );
        if (!match) {
            throw new Error(`Invalid FP Markets date/time: ${value}`);
        }

        let hour = Number(match[4] || 0);
        const meridiem = (match[7] || '').toUpperCase();
        if (meridiem === 'AM' && hour === 12) {
            hour = 0;
        }
        else if (meridiem === 'PM' && hour < 12) {
            hour += 12;
        }

        return new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1]),
            hour,
            Number(match[5] || 0),
            Number(match[6] || 0)
        );
    }

    line_to_transaction(fields, index) {
        if (this.from_closed_positions) {
            return this.line_to_closed_position(fields, index);
        }
        return this.line_to_legacy_transaction(fields, index);
    }

    /**
     * Parse the legacy FP Markets share-transaction export.
     */
    line_to_legacy_transaction(fields, index) {
        // ID
        // Date
        // Time
        // Account Code
        // Buy or Sell
        // Currency
        // Exchange
        // Stock
        // Volume
        // Price
        // Value
        let transaction = new models.Transaction();
        transaction.id = index;
        transaction.uuid = fields[0];
        transaction.date = this.parse_date_time(`${fields[1]} ${fields[2]}`);

        // ignore account code
        // fields[3]

        transaction.type = fields[4].toLowerCase();

        transaction.currency = fields[5];

        transaction.exchange = fields[6].toUpperCase();

        transaction.symbol = fields[7];

        transaction.quantity = parseFloat(fields[8]);

        // in cents
        transaction.price = parseFloat(fields[9]) / 100;

        // total is the trade value as commission is calculated separately
        transaction.total = transaction.value = parseFloat(fields[10]);

        this.adjust_transaction_common(transaction);

        return transaction;
    }

    /**
     * Parse an FP Markets cTrader row. Each row is already a complete closed
     * position, so its reported P/L must not be paired with unrelated rows.
     */
    line_to_closed_position(fields, index) {
        const transaction = new models.Transaction();
        transaction.id = index;
        transaction.uuid = fields[0];
        transaction.date_open = this.parse_date_time(fields[1]);
        transaction.date_close = this.parse_date_time(fields[2]);
        transaction.date = transaction.date_close;
        transaction.type = fields[4].trim().toLowerCase();
        transaction.currency = fields[5].trim().toUpperCase();
        transaction.exchange = 'CFD';
        transaction.symbol = fields[6].trim();
        transaction.quantity = parseFloat(fields[7]);
        transaction.open_price = parseFloat(fields[8]);
        transaction.close_price = parseFloat(fields[9]);
        transaction.price = transaction.close_price;
        transaction.commission = parseFloat(fields[10]);
        transaction.swaps = parseFloat(fields[11]);
        transaction.gross_profit = parseFloat(fields[12]);
        transaction.net_profit = transaction.gross_profit + transaction.commission + transaction.swaps;
        transaction.is_closed_position = true;

        if (!['buy', 'sell'].includes(transaction.type)) {
            throw new Error(`Unknown FP Markets transaction type: ${fields[4]}`);
        }

        const numbers = [
            transaction.quantity,
            transaction.open_price,
            transaction.close_price,
            transaction.commission,
            transaction.swaps,
            transaction.gross_profit,
            transaction.net_profit
        ];
        if (numbers.some(value => !Number.isFinite(value))) {
            throw new Error(`Invalid numeric value in FP Markets cTrader record ${transaction.uuid}`);
        }

        return transaction;
    }

    update_holding(portfolio, symbol, trades, app_data) {
        const legacyTransactions = trades.filter(transaction => !transaction.is_closed_position);
        const closedPositions = trades.filter(transaction => transaction.is_closed_position);

        if (legacyTransactions.length > 0) {
            super.update_holding(portfolio, symbol, legacyTransactions, app_data);
        }

        if (closedPositions.length === 0) {
            return;
        }

        let holding = portfolio.holdings.get(symbol);
        if (!holding) {
            holding = new models.Holding();
            holding.symbol = symbol;
            portfolio.holdings.set(symbol, holding);
        }

        for (const transaction of closedPositions) {
            const financialYear = utils.get_financial_year(transaction.date_close);
            const profitsYear = this.get_holding_profits_year(holding, financialYear);
            const profit = new models.Profit();

            profit.year_init = transaction.date_open;
            profit.year_close = transaction.date_close;
            profit.quantity = transaction.quantity;
            profit.cost = 0;
            profit.cost_price = transaction.open_price;
            profit.close_price = transaction.close_price;
            profit.profit = transaction.net_profit;
            profit.gross_profit = transaction.gross_profit;
            profit.commission = transaction.commission;
            profit.swaps = transaction.swaps;
            profit.discount_eligible = false;
            profit.transaction_open = transaction;
            profit.transaction_close = transaction;
            profit.trade_type = transaction.type;
            profit.total_trades = 1;
            profitsYear.push(profit);

            holding.profit += transaction.net_profit;
            holding.date_close = transaction.date_close;
            holding.transaction_close = transaction;

            let tradeValue = holding.trade_values.get(financialYear);
            if (!tradeValue) {
                tradeValue = new models.TradeValue();
                tradeValue.year = financialYear;
                holding.trade_values.set(financialYear, tradeValue);
            }
            // cTrader does not report an account-currency transaction value.
            // Keep turnover at zero instead of presenting price * lots as AUD.
            tradeValue.transactions.push(transaction);
        }
    }

    calculate_financial_year_profit(portfolio, year, options) {
        const financialYear = super.calculate_financial_year_profit(portfolio, year, options);
        let closedPositions = 0;
        let grossProfit = 0;
        let commission = 0;
        let swaps = 0;

        for (const holding of portfolio.holdings.values()) {
            const profitsYear = holding.profits.get(year) || [];
            for (const profit of profitsYear) {
                if (profit.transaction_close && profit.transaction_close.is_closed_position) {
                    closedPositions++;
                    grossProfit += profit.gross_profit;
                    commission += profit.commission;
                    swaps += profit.swaps;
                }
            }
        }

        if (closedPositions > 0) {
            financialYear.closed_positions = closedPositions;
            financialYear.gross_profit = grossProfit;
            financialYear.total_commission = commission;
            financialYear.total_swaps = swaps;
        }

        return financialYear;
    }
}

module.exports = FPMarkets;
