const fs = require('fs');
const path = require('path');

const sprolosta = require('../lib');
const brokers = require('../brokers');
const FPMarkets = require('../brokers/fpmarkets');
const models = require('../lib/models');

describe('FP Markets broker', () => {
    const fixture = path.join(__dirname, 'test-data', 'mock-fpmarkets-ctrader.csv');

    test('identifies quoted cTrader and legacy headers', () => {
        const cTraderContent = fs.readFileSync(fixture, 'utf8');
        const legacyHeader = '\uFEFF"ID","Date","Time","Account Code","Buy or Sell","Currency","Exchange","Stock","Volume","Price","Value"';

        expect(brokers.identifyBroker(cTraderContent)).toBe('fpmarkets');
        expect(brokers.identifyBroker(legacyHeader)).toBe('fpmarkets');
    });

    test('parses cTrader closed positions with decimal volume and net profit', () => {
        const broker = new FPMarkets();
        const result = broker.load_content(
            new models.Trades(),
            fs.readFileSync(fixture, 'utf8'),
            { index: 0, offset: 0 }
        );
        const transaction = result.trades.symbols.get('AUS200')[0];

        expect(result.count).toBe(4);
        expect(transaction.is_closed_position).toBe(true);
        expect(transaction.quantity).toBe(2.5);
        expect(transaction.type).toBe('sell');
        expect(transaction.date_open.getHours()).toBe(9);
        expect(transaction.date_close.getHours()).toBe(12);
        expect(transaction.gross_profit).toBe(-50);
        expect(transaction.commission).toBe(-5);
        expect(transaction.swaps).toBe(2);
        expect(transaction.net_profit).toBe(-53);
    });

    test('calculates cTrader financial-year P/L from closed-position fields', () => {
        const results = sprolosta.processTrades([fixture], {
            broker: 'fpmarkets',
            save: false,
            year: 2025
        });
        const financialYear = results.financial_years['2025-2026'];

        expect(financialYear.profit).toBe(59);
        expect(financialYear.profit_discount).toBe(0);
        expect(financialYear.total_profit_gain).toBe(112);
        expect(financialYear.total_profit_loss).toBe(-53);
        expect(financialYear.total_profit_trades).toBe(2);
        expect(financialYear.total_loss_trades).toBe(1);
        expect(financialYear.total_trades).toBe(4);
        expect(financialYear.closed_positions).toBe(4);
        expect(financialYear.gross_profit).toBe(71);
        expect(financialYear.total_commission).toBe(-13);
        expect(financialYear.total_swaps).toBe(1);
        expect(results.holdings).toEqual([]);
        expect(Object.keys(results.financial_years)).toEqual(['2025-2026']);
    });

    test('keeps the legacy share-transaction format working', () => {
        const content = [
            '"ID","Date","Time","Account Code","Buy or Sell","Currency","Exchange","Stock","Volume","Price","Value"',
            '"OLD1","09/06/2022","1:15:55 PM","TEST","Buy","AUD","ASX","AKE","10","1132","113.2"'
        ].join('\n');
        const broker = new FPMarkets();
        const result = broker.load_content(new models.Trades(), content, { index: 0, offset: 0 });
        const transaction = result.trades.symbols.get('AKE')[0];

        expect(transaction.is_closed_position).toBe(false);
        expect(transaction.date.getHours()).toBe(13);
        expect(transaction.quantity).toBe(10);
        expect(transaction.price).toBe(11.32);
        expect(transaction.total).toBe(113.2);
    });
});
