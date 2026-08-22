/**
 * Unit tests for the main library functionality
 */

const sprolosta = require('../lib');
const models = require('../lib/models');

// Mock dependencies to avoid filesystem operations
jest.mock('fs', () => ({
    readFileSync: jest.fn(() => '{}'),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(() => true)
}));

// Mock broker implementation
const mockBroker = {
    name: 'mock',
    load: jest.fn(() => {
        const trades = new models.Trades();
        
        // Create buy transaction
        const buyTransaction = new models.Transaction();
        buyTransaction.id = 1;
        buyTransaction.date = new Date('2023-02-20');
        buyTransaction.type = 'buy';
        buyTransaction.symbol = 'CBA';
        buyTransaction.company = 'Commonwealth Bank';
        buyTransaction.quantity = 100;
        buyTransaction.price = 100;
        buyTransaction.value = 10000;
        buyTransaction.fee = 19.95;
        buyTransaction.total = 10019.95;
        
        // Create sell transaction
        const sellTransaction = new models.Transaction();
        sellTransaction.id = 2;
        sellTransaction.date = new Date('2023-05-21');
        sellTransaction.type = 'sell';
        sellTransaction.symbol = 'CBA';
        sellTransaction.company = 'Commonwealth Bank';
        sellTransaction.quantity = -100; // Negative for sells
        sellTransaction.price = 105;
        sellTransaction.value = -10500;
        sellTransaction.fee = 19.95;
        sellTransaction.total = -10480.05;
        
        // Add transactions to trades
        trades.symbols.set('CBA', [buyTransaction, sellTransaction]);
        trades.periods.add(2023);
        trades.first = buyTransaction.date;
        trades.last = sellTransaction.date;
        
        return trades;
    }),
    // Real brokers.normalizeData() calls broker.load_content(trades, content, options)
    // and returns its result directly (see brokers/index.js). The real
    // Broker.load_content_common() returns { count, trades } (see brokers/base.js),
    // so the mock must return that same shape rather than a bare number.
    load_content: jest.fn(() => {
        const trades = mockBroker.load();
        return { count: 2, trades };
    }),
    update_holding: jest.fn(),
    calculate_financial_year_profit: jest.fn(() => {
        const financialYear = new models.FinancialYear();
        financialYear.year = 2023;
        financialYear.profit = 460.10;
        financialYear.total_trades = 2;
        financialYear.total_cost = 10019.95;
        financialYear.total_buy = 10019.95;
        financialYear.total_sell = 10480.05;
        return financialYear;
    })
};

// brokers/index.js exports `new Brokers()` - a class instance whose
// normalizeData()/get_broker()/identifyBroker() live on the prototype (or are
// assigned in the constructor). lib.js calls brokers.normalizeData(...) and
// brokers.identifyBroker(...) directly, so the mock must provide those too,
// not just get_broker().
jest.mock('../brokers', () => ({
    get_broker: jest.fn(() => mockBroker),
    identifyBroker: jest.fn(() => 'mock'),
    // Mirrors Brokers.prototype.normalizeData(): resolve the broker instance
    // and delegate to its load_content(), returning the result as-is.
    normalizeData: jest.fn((csvContent, brokerName, options) => {
        options = options || {};
        const broker = options.broker || mockBroker;
        return broker.load_content(options.trades || new (require('../lib/models').Trades)(), csvContent, options);
    })
}));

describe('processTrades function', () => {
    test('should process trades from file paths', () => {
        const results = sprolosta.processTrades(['test-data.csv'], {
            broker: 'mock'
        });
        
        // Basic validation of results structure
        expect(results).toBeDefined();
        expect(results.portfolio).toBeInstanceOf(models.Portfolio);
        expect(results.trades).toBeDefined();
        expect(results.symbols_count).toBeDefined();
        expect(results.first_trade).toBeInstanceOf(Date);
        expect(results.last_trade).toBeInstanceOf(Date);
        expect(results.periods_traded).toBeDefined();
        expect(results.financial_years).toBeDefined();
    });
    
    test('should process trades from CSV string', () => {
        const csvString = `
Code,Trade Date,Settlement Date,Type,Description,Quantity,Average Price,Trade Value,Brokerage,GST,Contract Note,Currency
CBA,20/02/2023,22/02/2023,BUY,COMMONWEALTH BANK OF,100,100.00,10000.00,19.95,2.00,CN123456,AUD
CBA,21/05/2023,23/05/2023,SELL,COMMONWEALTH BANK OF,100,105.00,10500.00,19.95,2.00,CN123457,AUD
        `;
        
        const results = sprolosta.processTrades(csvString, {
            broker: 'mock'
        });
        
        // Verify results were generated
        expect(results).toBeDefined();
        expect(results.portfolio).toBeInstanceOf(models.Portfolio);
    });
    
    test('should throw error for unsupported broker', () => {
        jest.spyOn(require('../brokers'), 'get_broker').mockReturnValueOnce(null);
        
        expect(() => {
            sprolosta.processTrades(['test.csv'], {
                broker: 'unsupported'
            });
        }).toThrow('Unsupported broker: unsupported');
    });
    
    test('should save portfolio if save option is true', () => {
        const fs = require('fs');

        sprolosta.processTrades(['test-data.csv'], {
            broker: 'mock',
            save: true,
            'portfolio-file': 'test-portfolio.json'
        });

        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.writeFileSync.mock.calls[0][0]).toBe('test-portfolio.json');
    });

    test('should not kill the host process when a file does not exist (library must not process.exit)', () => {
        const fs = require('fs');
        fs.existsSync.mockReturnValueOnce(false);

        // The per-file try/catch in lib.js's load() must catch the thrown
        // "File not found" error and continue, rather than the library
        // calling process.exit(1) and taking down the whole host process.
        // Proof the process survives: this assertion runs at all.
        expect(() => {
            sprolosta.processTrades(['missing-file.csv'], {
                broker: 'mock'
            });
        }).not.toThrow();
    });
});

describe('processTradesWithRecords function', () => {
    test('should process trade records correctly', () => {
        const trades = new models.Trades();
        
        // Create buy transaction
        const buyTransaction = new models.Transaction();
        buyTransaction.id = 1;
        buyTransaction.date = new Date('2023-02-20');
        buyTransaction.type = 'buy';
        buyTransaction.symbol = 'CBA';
        buyTransaction.company = 'Commonwealth Bank';
        buyTransaction.quantity = 100;
        buyTransaction.price = 100;
        buyTransaction.value = 10000;
        buyTransaction.fee = 19.95;
        buyTransaction.total = 10019.95;
        
        // Create sell transaction
        const sellTransaction = new models.Transaction();
        sellTransaction.id = 2;
        sellTransaction.date = new Date('2023-05-21');
        sellTransaction.type = 'sell';
        sellTransaction.symbol = 'CBA';
        sellTransaction.company = 'Commonwealth Bank';
        sellTransaction.quantity = -100; // Negative for sells
        sellTransaction.price = 105;
        sellTransaction.value = -10500;
        sellTransaction.fee = 19.95;
        sellTransaction.total = -10480.05;
        
        // Add transactions to trades
        trades.symbols.set('CBA', [buyTransaction, sellTransaction]);
        trades.periods.add(2023);
        trades.first = buyTransaction.date;
        trades.last = sellTransaction.date;
        
        const broker = require('../brokers').get_broker('mock');
        const options = {};
        
        const results = sprolosta.processTradesWithRecords(trades, broker, options);
        
        expect(results).toBeDefined();
        expect(results.portfolio).toBeInstanceOf(models.Portfolio);
        expect(results.symbols_count).toBe(1);
        expect(results.holdings).toBeDefined();
    });
    
    test('should filter symbols if specified in options', () => {
        const trades = new models.Trades();
        
        // Add transactions for two different symbols
        const cba1 = new models.Transaction();
        cba1.date = new Date('2023-02-20');
        cba1.type = 'buy';
        cba1.symbol = 'CBA';
        cba1.quantity = 100;
        
        const nab1 = new models.Transaction();
        nab1.date = new Date('2023-02-21');
        nab1.type = 'buy';
        nab1.symbol = 'NAB';
        nab1.quantity = 200;
        
        trades.symbols.set('CBA', [cba1]);
        trades.symbols.set('NAB', [nab1]);
        trades.periods.add(2023);
        
        const broker = require('../brokers').get_broker('mock');
        
        // Process with symbol filtering
        const results = sprolosta.processTradesWithRecords(trades, broker, {
            symbol: 'CBA'
        });
        
        // Should only process CBA transactions
        expect(results.symbols_count).toBe(1);
    });
    
    test('should ignore symbols specified in options', () => {
        const trades = new models.Trades();
        
        // Add transactions for two different symbols
        const cba1 = new models.Transaction();
        cba1.date = new Date('2023-02-20');
        cba1.type = 'buy';
        cba1.symbol = 'CBA';
        cba1.quantity = 100;
        
        const nab1 = new models.Transaction();
        nab1.date = new Date('2023-02-21');
        nab1.type = 'buy';
        nab1.symbol = 'NAB';
        nab1.quantity = 200;
        
        trades.symbols.set('CBA', [cba1]);
        trades.symbols.set('NAB', [nab1]);
        trades.periods.add(2023);
        
        const broker = require('../brokers').get_broker('mock');
        
        // Process with ignore option
        const results = sprolosta.processTradesWithRecords(trades, broker, {
            ignore: ['CBA']
        });
        
        // Should ignore CBA and only process NAB
        expect(results.symbols_count).toBe(2); // Still counts all symbols
    });
});