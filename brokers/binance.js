/**
 * Binance transaction-history adapter.
 *
 * The export is an asset ledger rather than an order/trade report.  This
 * adapter reconstructs only complete round trips quoted in USDT.  Funding,
 * withdrawals and internal transfers are deliberately ignored.  Inventory
 * whose acquisition cannot be valued in USDT is tracked as unknown and any
 * later proceeds attributable to it are excluded.
 */

const Broker = require('./base');
const models = require('../lib/models');
const utils = require('../lib/utils');

const HEADER = 'User ID,Time,Account,Operation,Coin,Change,Remark';
const EPSILON = 1e-12;

function parseCsvLine(line) {
    const fields = [];
    let field = '';
    let quoted = false;

    for (let index = 0; index < line.length; index++) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                field += '"';
                index++;
            }
            else {
                quoted = !quoted;
            }
        }
        else if (character === ',' && !quoted) {
            fields.push(field);
            field = '';
        }
        else {
            field += character;
        }
    }
    fields.push(field);
    return fields;
}

class Binance extends Broker {
    constructor(options) {
        super(options);
        this.name = 'Binance';
        this.quote_currency = 'USDT';
        this._ledgerRows = [];
        this.stats = this.newStats();
    }

    newStats() {
        return {
            source_records: 0,
            complete_pairs: 0,
            ignored_funding_records: 0,
            ignored_cross_crypto_conversions: 0,
            unmatched_disposal_quantity: new Map(),
            quote_currency: this.quote_currency,
        };
    }

    parseDateTime(value) {
        const match = String(value).trim().match(
            /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
        );
        if (!match) {
            throw new Error(`Invalid Binance date/time: ${value}`);
        }
        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6])
        );
    }

    load_content(trades, content, options = {}) {
        const lines = content.split(/\r?\n/);
        const header = (lines.shift() || '').replace(/^\uFEFF/, '').replace(/"/g, '');
        if (header !== HEADER) {
            throw new Error('Unknown Binance transaction-history format');
        }

        const sourceIndex = this._ledgerRows.length;
        let count = 0;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            if (!line.trim()) {
                continue;
            }

            const fields = parseCsvLine(line);
            if (fields.length !== 7) {
                throw new Error(`Invalid Binance record on line ${lineIndex + 2}`);
            }

            const change = Number(fields[5]);
            if (!Number.isFinite(change)) {
                throw new Error(`Invalid Binance change on line ${lineIndex + 2}`);
            }

            this._ledgerRows.push({
                source_index: sourceIndex + count,
                user_id: fields[0],
                date: this.parseDateTime(fields[1]),
                account: fields[2].trim(),
                operation: fields[3].trim(),
                coin: fields[4].trim().toUpperCase(),
                change,
                remark: fields[6].trim(),
            });
            count++;
        }

        this.rebuildTrades(trades);
        return { count, trades };
    }

    rebuildTrades(trades) {
        trades.symbols = new Map();
        trades.periods = new Set();
        trades.first = null;
        trades.last = null;
        this.stats = this.newStats();
        this.stats.source_records = this._ledgerRows.length;

        const rows = [...this._ledgerRows].sort((left, right) => {
            const dateDifference = left.date - right.date;
            return dateDifference || left.source_index - right.source_index;
        });
        const events = this.buildEvents(rows);
        const lots = new Map();
        let transactionId = 0;

        const addLot = (coin, quantity, cost, date, known = true) => {
            if (quantity <= EPSILON) {
                return;
            }
            if (!lots.has(coin)) {
                lots.set(coin, []);
            }
            lots.get(coin).push({ quantity, cost, date, known });
        };

        const dispose = (coin, quantity, proceeds, date, sourceCount, recordPair = true) => {
            let quantityLeft = quantity;
            let knownQuantity = 0;
            let knownCost = 0;
            let openingDate = null;
            const queue = lots.get(coin) || [];

            while (quantityLeft > EPSILON && queue.length > 0) {
                const lot = queue[0];
                const matched = Math.min(quantityLeft, lot.quantity);
                if (lot.known) {
                    knownQuantity += matched;
                    knownCost += lot.cost * matched / lot.quantity;
                    if (!openingDate || lot.date < openingDate) {
                        openingDate = lot.date;
                    }
                }
                lot.cost -= lot.cost * matched / lot.quantity;
                lot.quantity -= matched;
                quantityLeft -= matched;
                if (lot.quantity <= EPSILON) {
                    queue.shift();
                }
            }

            if (quantityLeft > EPSILON) {
                const previous = this.stats.unmatched_disposal_quantity.get(coin) || 0;
                this.stats.unmatched_disposal_quantity.set(coin, previous + quantityLeft);
            }

            if (!recordPair || knownQuantity <= EPSILON) {
                return;
            }

            const knownProceeds = proceeds * knownQuantity / quantity;
            const transaction = new models.Transaction();
            transaction.id = ++transactionId;
            transaction.uuid = `binance-${date.getTime()}-${transactionId}`;
            transaction.date_open = openingDate;
            transaction.date_close = date;
            transaction.date = date;
            transaction.type = 'sell';
            transaction.currency = this.quote_currency;
            transaction.exchange = 'BINANCE';
            transaction.symbol = `${coin}/${this.quote_currency}`;
            transaction.quantity = knownQuantity;
            transaction.open_price = knownCost / knownQuantity;
            transaction.close_price = knownProceeds / knownQuantity;
            transaction.price = transaction.close_price;
            transaction.gross_profit = knownProceeds - knownCost;
            transaction.net_profit = transaction.gross_profit;
            transaction.commission = 0;
            transaction.swaps = 0;
            transaction.cost = knownCost;
            transaction.proceeds = knownProceeds;
            transaction.source_count = sourceCount;
            transaction.is_binance_closed_pair = true;

            if (!trades.symbols.has(transaction.symbol)) {
                trades.symbols.set(transaction.symbol, []);
            }
            trades.symbols.get(transaction.symbol).push(transaction);
            trades.periods.add(utils.get_financial_year(date));
            trades.first = !trades.first || openingDate < trades.first ? openingDate : trades.first;
            trades.last = !trades.last || date > trades.last ? date : trades.last;
            this.stats.complete_pairs++;
        };

        for (const event of events) {
            if (event.type === 'buy') {
                addLot(event.coin, event.quantity, event.quoteAmount, event.date, true);
            }
            else if (event.type === 'sell') {
                dispose(event.coin, event.quantity, event.quoteAmount, event.date, event.sourceCount);
            }
            else if (event.type === 'cross') {
                // A cross-crypto conversion has no quote-currency valuation in
                // this export. Remove any source inventory and mark the received
                // inventory unknown so it cannot create artificial USDT profit.
                dispose(event.fromCoin, event.fromQuantity, 0, event.date, event.sourceCount, false);
                addLot(event.toCoin, event.toQuantity, 0, event.date, false);
                this.stats.ignored_cross_crypto_conversions++;
            }
            else {
                this.stats.ignored_funding_records += event.sourceCount;
            }
        }
    }

    buildEvents(rows) {
        const events = [];
        const grouped = new Map();
        const converts = [];
        const fundingOperations = new Set([
            'Deposit',
            'Withdraw',
            'Transfer Between Spot and Funding',
            'Transfer Funds to Funding Wallet',
            'Transfer Funds to Spot',
        ]);

        for (const row of rows) {
            if (row.operation === 'Binance Convert') {
                converts.push(row);
                continue;
            }
            if (fundingOperations.has(row.operation)) {
                events.push({ type: 'ignored', date: row.date, sourceCount: 1 });
                continue;
            }
            if (!grouped.has(row.date.getTime())) {
                grouped.set(row.date.getTime(), []);
            }
            grouped.get(row.date.getTime()).push(row);
        }

        for (const group of grouped.values()) {
            const date = group[0].date;
            const buys = group.filter(row => row.operation === 'Transaction Buy');
            const sells = group.filter(row => row.operation === 'Transaction Sold');
            const spends = group.filter(row => row.operation === 'Transaction Spend');
            const revenues = group.filter(row => row.operation === 'Transaction Revenue');
            const fees = group.filter(row => row.operation === 'Transaction Fee');

            if (buys.length > 0 && spends.length > 0) {
                const coin = buys[0].coin;
                if (buys.some(row => row.coin !== coin) || spends.some(row => row.coin !== this.quote_currency)) {
                    throw new Error(`Unsupported Binance buy group at ${date.toISOString()}`);
                }
                if (fees.some(row => row.coin !== coin && row.coin !== this.quote_currency)) {
                    throw new Error(`Unsupported Binance fee currency at ${date.toISOString()}`);
                }
                const assetFee = fees.filter(row => row.coin === coin).reduce((sum, row) => sum + row.change, 0);
                const quoteFee = fees.filter(row => row.coin === this.quote_currency).reduce((sum, row) => sum + row.change, 0);
                events.push({
                    type: 'buy',
                    coin,
                    quantity: buys.reduce((sum, row) => sum + row.change, 0) + assetFee,
                    quoteAmount: -spends.reduce((sum, row) => sum + row.change, 0) - quoteFee,
                    date,
                    sourceCount: group.length,
                });
            }
            else if (sells.length > 0 && revenues.length > 0) {
                const coin = sells[0].coin;
                if (sells.some(row => row.coin !== coin) || revenues.some(row => row.coin !== this.quote_currency)) {
                    throw new Error(`Unsupported Binance sell group at ${date.toISOString()}`);
                }
                if (fees.some(row => row.coin !== coin && row.coin !== this.quote_currency)) {
                    throw new Error(`Unsupported Binance fee currency at ${date.toISOString()}`);
                }
                const assetFee = fees.filter(row => row.coin === coin).reduce((sum, row) => sum + row.change, 0);
                const quoteFee = fees.filter(row => row.coin === this.quote_currency).reduce((sum, row) => sum + row.change, 0);
                events.push({
                    type: 'sell',
                    coin,
                    quantity: -sells.reduce((sum, row) => sum + row.change, 0) - assetFee,
                    quoteAmount: revenues.reduce((sum, row) => sum + row.change, 0) + quoteFee,
                    date,
                    sourceCount: group.length,
                });
            }
            else if (group.length > 0) {
                throw new Error(`Unsupported Binance transaction group at ${date.toISOString()}`);
            }
        }

        for (let index = 0; index < converts.length; index += 2) {
            const first = converts[index];
            const second = converts[index + 1];
            if (!second || Math.abs(second.date - first.date) > 1000 || Math.sign(first.change) === Math.sign(second.change)) {
                throw new Error(`Unpaired Binance Convert record at ${first.date.toISOString()}`);
            }
            const outgoing = first.change < 0 ? first : second;
            const incoming = first.change > 0 ? first : second;
            const date = first.date > second.date ? first.date : second.date;

            if (outgoing.coin === this.quote_currency) {
                events.push({ type: 'buy', coin: incoming.coin, quantity: incoming.change, quoteAmount: -outgoing.change, date, sourceCount: 2 });
            }
            else if (incoming.coin === this.quote_currency) {
                events.push({ type: 'sell', coin: outgoing.coin, quantity: -outgoing.change, quoteAmount: incoming.change, date, sourceCount: 2 });
            }
            else {
                events.push({
                    type: 'cross',
                    fromCoin: outgoing.coin,
                    fromQuantity: -outgoing.change,
                    toCoin: incoming.coin,
                    toQuantity: incoming.change,
                    date,
                    sourceCount: 2,
                });
            }
        }

        return events.sort((left, right) => left.date - right.date);
    }

    update_holding(portfolio, symbol, transactions) {
        let holding = portfolio.holdings.get(symbol);
        if (!holding) {
            holding = new models.Holding();
            holding.symbol = symbol;
            portfolio.holdings.set(symbol, holding);
        }

        for (const transaction of transactions) {
            const financialYear = utils.get_financial_year(transaction.date_close);
            const profitsYear = this.get_holding_profits_year(holding, financialYear);
            const profit = new models.Profit();
            profit.year_init = transaction.date_open;
            profit.year_close = transaction.date_close;
            profit.quantity = transaction.quantity;
            profit.cost = transaction.cost;
            profit.cost_price = transaction.open_price;
            profit.close_price = transaction.close_price;
            profit.profit = transaction.net_profit;
            profit.gross_profit = transaction.gross_profit;
            profit.discount_eligible = false;
            profit.transaction_open = transaction;
            profit.transaction_close = transaction;
            profit.trade_type = 'buy';
            profit.total_trades = transaction.source_count;
            profitsYear.push(profit);
            holding.profit += transaction.net_profit;

            let tradeValue = holding.trade_values.get(financialYear);
            if (!tradeValue) {
                tradeValue = new models.TradeValue();
                tradeValue.year = financialYear;
                holding.trade_values.set(financialYear, tradeValue);
            }
            tradeValue.buy += transaction.cost;
            tradeValue.sell -= transaction.proceeds;
            tradeValue.transactions.push(transaction);
        }
    }

    calculate_financial_year_profit(portfolio, year, options) {
        const financialYear = super.calculate_financial_year_profit(portfolio, year, options);
        const pairs = [];
        for (const holding of portfolio.holdings.values()) {
            for (const profit of holding.profits.get(year) || []) {
                if (profit.transaction_close && profit.transaction_close.is_binance_closed_pair) {
                    pairs.push(profit);
                }
            }
        }
        if (pairs.length > 0) {
            financialYear.complete_pairs = pairs.length;
            financialYear.quote_currency = this.quote_currency;
            financialYear.source_records = this.stats.source_records;
            financialYear.ignored_funding_records = this.stats.ignored_funding_records;
            financialYear.ignored_cross_crypto_conversions = this.stats.ignored_cross_crypto_conversions;
            financialYear.unmatched_disposal_quantity = Object.fromEntries(this.stats.unmatched_disposal_quantity);
        }
        return financialYear;
    }
}

module.exports = Binance;
