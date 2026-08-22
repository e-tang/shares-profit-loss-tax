const Broker = require('./base');
const FPMarkets = require('./fpmarkets');
const models = require('../lib/models');

const HEADER = 'ID,Order ID,Symbol,Opening direction,Opening time,Closing time,Entry price,Closing price,Closing Quantity,Closing volume,Net AUD,Label';

class Pepperstone extends FPMarkets {
    constructor(options) {
        super(options);
        this.name = 'Pepperstone';
        this.from_closed_positions = true;
    }

    load_content(trades, content, options) {
        const header = content.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, '').replace(/"/g, '');
        if (!header.startsWith(HEADER)) throw new Error('Unknown Pepperstone format');
        return Broker.prototype.load_content.call(this, trades, content, options);
    }

    line_to_transaction(fields, index) {
        const transaction = new models.Transaction();
        transaction.id = index;
        transaction.uuid = fields[0];
        transaction.order_id = fields[1];
        transaction.symbol = fields[2].trim();
        transaction.type = fields[3].trim().toLowerCase();
        transaction.date_open = this.parse_date_time(fields[4]);
        transaction.date_close = this.parse_date_time(fields[5]);
        transaction.date = transaction.date_close;
        transaction.open_price = parseFloat(fields[6]);
        transaction.close_price = parseFloat(fields[7]);
        transaction.price = transaction.close_price;
        transaction.quantity = parseFloat(fields[8]);
        transaction.volume = parseFloat(fields[9]);
        transaction.gross_profit = parseFloat(fields[10]);
        transaction.net_profit = transaction.gross_profit;
        transaction.commission = 0;
        transaction.swaps = 0;
        transaction.currency = 'AUD';
        transaction.exchange = 'CFD';
        transaction.note = fields[11] || '';
        transaction.is_closed_position = true;

        if (!['buy', 'sell'].includes(transaction.type)) {
            throw new Error(`Unknown Pepperstone direction: ${fields[3]}`);
        }
        const numbers = [transaction.quantity, transaction.volume, transaction.open_price,
            transaction.close_price, transaction.net_profit];
        if (numbers.some(value => !Number.isFinite(value))) {
            throw new Error(`Invalid numeric value in Pepperstone record ${transaction.uuid}`);
        }
        return transaction;
    }

    calculate_financial_year_profit(portfolio, year, options) {
        const financialYear = super.calculate_financial_year_profit(portfolio, year, options);
        if (financialYear.closed_positions) {
            financialYear.reporting_currency = 'AUD';
            financialYear.broker_reported_net = true;
        }
        return financialYear;
    }
}

module.exports = Pepperstone;
