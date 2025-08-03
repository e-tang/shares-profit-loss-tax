/**
 * Unit tests for the models module
 */

const models = require('../lib/models');

describe('Transaction model', () => {
    test('should create a new transaction with default values', () => {
        const transaction = new models.Transaction();
        
        expect(transaction.id).toBe(0);
        expect(transaction.uuid).toBe('');
        expect(transaction.date).toBeInstanceOf(Date);
        expect(transaction.type).toBe('');
        expect(transaction.description).toBe('');
        expect(transaction.category).toBe('');
        expect(transaction.symbol).toBeUndefined();
        expect(transaction.company).toBeUndefined();
        expect(transaction.quantity).toBe(0);
        expect(transaction.price).toBe(0);
        expect(transaction.value).toBe(0);
        expect(transaction.total).toBe(0);
        expect(transaction.fee).toBe(0);
        expect(transaction.gst).toBe(0);
        expect(transaction.currency).toBe('AUD');
        expect(transaction.exchange).toBe('ASX');
        expect(transaction.note).toBe('');
        expect(transaction.count).toBe(1);
    });

    test('copy() should create an exact copy of the transaction', () => {
        const transaction = new models.Transaction();
        transaction.id = 123;
        transaction.date = new Date('2023-01-01');
        transaction.type = 'buy';
        transaction.description = 'Test description';
        transaction.category = 'Test category';
        transaction.symbol = 'CBA';
        transaction.company = 'Commonwealth Bank';
        transaction.quantity = 100;
        transaction.price = 85.5;
        transaction.value = 8550;
        transaction.total = 8569.95;
        transaction.fee = 19.95;
        transaction.gst = 2.00;
        transaction.note = 'Test note';
        
        const copy = transaction.copy();
        
        expect(copy).not.toBe(transaction); // Should be a new object
        expect(copy.id).toBe(transaction.id);
        expect(copy.date).toEqual(transaction.date);
        expect(copy.type).toBe(transaction.type);
        expect(copy.description).toBe(transaction.description);
        expect(copy.category).toBe(transaction.category);
        expect(copy.symbol).toBe(transaction.symbol);
        expect(copy.company).toBe(transaction.company);
        expect(copy.quantity).toBe(transaction.quantity);
        expect(copy.price).toBe(transaction.price);
        expect(copy.value).toBe(transaction.value);
        expect(copy.total).toBe(transaction.total);
        expect(copy.fee).toBe(transaction.fee);
        expect(copy.gst).toBe(transaction.gst);
        expect(copy.note).toBe(transaction.note);
    });
});

describe('Trades model', () => {
    test('should create a new trades object with default values', () => {
        const trades = new models.Trades();
        
        expect(trades.symbols).toBeInstanceOf(Map);
        expect(trades.symbols.size).toBe(0);
        expect(trades.periods).toBeInstanceOf(Set);
        expect(trades.periods.size).toBe(0);
        expect(trades.first).toBeNull();
        expect(trades.last).toBeNull();
    });
});

describe('Portfolio model', () => {
    test('should create a new portfolio with default values', () => {
        const portfolio = new models.Portfolio();
        
        expect(portfolio.holdings).toBeInstanceOf(Map);
        expect(portfolio.holdings.size).toBe(0);
        expect(portfolio.value).toBe(0);
        expect(portfolio.cost).toBe(0);
        expect(portfolio.profit).toBe(0);
        expect(portfolio.profits).toBeInstanceOf(Map);
        expect(portfolio.profits.size).toBe(0);
        expect(portfolio.history_years).toBeInstanceOf(Set);
        expect(portfolio.history_years.size).toBe(0);
    });
});

describe('Holding model', () => {
    test('should create a new holding with default values', () => {
        const holding = new models.Holding();
        
        expect(holding.symbol).toBeUndefined();
        expect(holding.company).toBeUndefined();
        expect(holding.quantity).toBe(0);
        expect(holding.average_price).toBe(0);
        expect(holding.average_close).toBe(0);
        expect(holding.value).toBe(0);
        expect(holding.cost).toBe(0);
        expect(holding.profit).toBe(0);
        expect(holding.profits).toBeInstanceOf(Map);
        expect(holding.profit_percent).toBe(0);
        expect(holding.note).toBe('');
        expect(holding.date_init).toBeNull();
        expect(holding.date_close).toBeNull();
        expect(holding.transaction_init).toBeNull();
        expect(holding.transaction_close).toBeNull();
        expect(holding.trade_values).toBeInstanceOf(Map);
        expect(holding.records).toEqual([]);
        expect(holding.last_cos).toBeNull();
    });
});

describe('Trade model', () => {
    test('should create a new trade with default values', () => {
        const trade = new models.Trade();
        
        expect(trade.symbol).toBeUndefined();
        expect(trade.cost_price).toBe(0);
        expect(trade.close_price).toBe(0);
        expect(trade.quantity).toBe(0);
        expect(trade.profit).toBe(0);
        expect(trade.type).toBe('');
    });

    test('toString() should return a formatted string representation', () => {
        const trade = new models.Trade();
        trade.symbol = 'CBA';
        trade.quantity = 100;
        trade.type = 'buy';
        trade.cost_price = 85.5;
        trade.close_price = 90.25;
        trade.profit = 475;
        
        const result = trade.toString();
        
        expect(result).toBe('CBA (100, buy): open@85.5, close@90.25, profit: 475.00');
    });

    test('toString() should return empty string if symbol is undefined', () => {
        const trade = new models.Trade();
        trade.quantity = 100;
        trade.type = 'buy';
        
        expect(trade.toString()).toBe('');
    });
});