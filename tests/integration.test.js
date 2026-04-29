/**
 * Integration tests for the sprolosta library
 */

const sprolosta = require('../lib');
const models = require('../lib/models');

// Create mock broker class to simulate CommSec
const mockCommSecBroker = {
    name: 'commsec',
    load: jest.fn(() => {
        const trades = new models.Trades();
        
        // Simulate CBA transactions
        const cba1 = new models.Transaction();
        cba1.id = 1;
        cba1.date = new Date('2023-02-15');
        cba1.type = 'buy';
        cba1.symbol = 'CBA';
        cba1.company = 'COMMONWEALTH BANK OF AUSTRALIA';
        cba1.quantity = 100;
        cba1.price = 100.00;
        cba1.value = 10000.00;
        cba1.fee = 19.95;
        cba1.total = 10019.95;
        
        const cba2 = new models.Transaction();
        cba2.id = 2;
        cba2.date = new Date('2023-05-15');
        cba2.type = 'sell';
        cba2.symbol = 'CBA';
        cba2.company = 'COMMONWEALTH BANK OF AUSTRALIA';
        cba2.quantity = -100; // Negative for sells
        cba2.price = 105.00;
        cba2.value = -10500.00;
        cba2.fee = 19.95;
        cba2.total = -10480.05;
        
        // Simulate NAB transactions
        const nab1 = new models.Transaction();
        nab1.id = 3;
        nab1.date = new Date('2023-02-20');
        nab1.type = 'buy';
        nab1.symbol = 'NAB';
        nab1.company = 'NATIONAL AUSTRALIA BANK LIMITED';
        nab1.quantity = 200;
        nab1.price = 30.50;
        nab1.value = 6100.00;
        nab1.fee = 19.95;
        nab1.total = 6119.95;
        
        const nab2 = new models.Transaction();
        nab2.id = 4;
        nab2.date = new Date('2023-06-25');
        nab2.type = 'sell';
        nab2.symbol = 'NAB';
        nab2.company = 'NATIONAL AUSTRALIA BANK LIMITED';
        nab2.quantity = -100; // Negative for sells
        nab2.price = 32.75;
        nab2.value = -3275.00;
        nab2.fee = 19.95;
        nab2.total = -3255.05;
        
        // Add transactions to trades
        trades.symbols.set('CBA', [cba1, cba2]);
        trades.symbols.set('NAB', [nab1, nab2]);
        trades.periods.add(2023);
        trades.first = cba1.date;
        trades.last = nab2.date;
        
        return trades;
    }),
    update_holding: jest.fn(),
    calculate_financial_year_profit: jest.fn(() => {
        const financialYear = new models.FinancialYear();
        financialYear.year = 2022;
        financialYear.profit = 735.10;
        financialYear.profit_discount = 0;
        financialYear.total_trades = 4;
        financialYear.total_cost = 16139.90;
        financialYear.total_buy = 16119.95;
        financialYear.total_sell = 13735.10;
        financialYear.total_profit_gain = 735.10;
        return financialYear;
    })
};

// Mock fs module
jest.mock('fs', () => ({
    readFileSync: jest.fn(() => '{}'),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(() => true)
}));

// Mock brokers module 
jest.mock('../brokers', () => ({
    get_broker: jest.fn((brokerName) => {
        if (brokerName === 'commsec') {
            return mockCommSecBroker;
        }
        return null;
    })
}));

describe('Integration tests', () => {
    test('should process CommSec pre-2023 format correctly', () => {
        const results = sprolosta.processTrades(['mock-commsec.csv'], {
            broker: 'commsec'
        });
        
        // Verify basic structure
        expect(results).toBeDefined();
        expect(results.symbols_count).toBe(2); // CBA and NAB
        expect(results.periods_traded).toBe(1); // 2023
        
        // Verify financial years
        expect(Object.keys(results.financial_years)).toContain('2022-2023');
        
        // Verify profit calculations for CBA
        const holdings = results.holdings.filter(h => h.symbol === 'CBA');
        if (holdings.length > 0) {
            // CBA should have been fully sold, so no remaining holdings
            expect(holdings.length).toBe(0);
        }
        
        // Verify profit calculations for NAB
        const nabHoldings = results.holdings.filter(h => h.symbol === 'NAB');
        if (nabHoldings.length > 0) {
            // NAB should have 100 shares remaining
            expect(nabHoldings[0].quantity).toBe(100);
            expect(nabHoldings[0].average_price).toBeCloseTo(30.5, 2);
        }
        
        // Verify financial year profit
        const fy = results.financial_years['2022-2023'];
        expect(fy.total_profit_gain).toBeGreaterThan(0);
        expect(fy.total_buy).toBe(16119.95); // 10019.95 + 6100.00
        expect(fy.total_sell).toBe(13735.10); // 10480.05 + 3255.05
    });
    
    test('should process CommSec post-2023 format correctly', () => {
        const results = sprolosta.processTrades(['mock-commsec-new.csv'], {
            broker: 'commsec'
        });
        
        // Verify basic structure
        expect(results).toBeDefined();
        expect(results.symbols_count).toBe(2); // CBA and NAB
        expect(results.periods_traded).toBe(1); // 2023
        
        // Verify financial years
        expect(Object.keys(results.financial_years)).toContain('2022-2023');
        
        // Verify profit calculations
        const fy = results.financial_years['2022-2023'];
        expect(fy.total_profit_gain).toBeGreaterThan(0);
    });
    
    test('should filter symbols correctly', () => {
        const results = sprolosta.processTrades(['mock-commsec.csv'], {
            broker: 'commsec',
            symbol: 'CBA'
        });
        
        // Should only process CBA transactions
        const holdingsSymbols = results.holdings.map(h => h.symbol);
        expect(holdingsSymbols).not.toContain('NAB');
    });
    
    test('should ignore symbols correctly', () => {
        const results = sprolosta.processTrades(['mock-commsec.csv'], {
            broker: 'commsec',
            ignore: ['CBA']
        });
        
        // Should ignore CBA transactions
        const nabHoldings = results.holdings.filter(h => h.symbol === 'NAB');
        expect(nabHoldings.length).toBe(1);
    });
    
    test('should calculate profits for specific financial year', () => {
        const results = sprolosta.processTrades(['mock-commsec.csv'], {
            broker: 'commsec',
            year: 2022
        });
        
        // Should have financial year 2022-2023
        expect(Object.keys(results.financial_years)).toContain('2022-2023');
    });
    
    test('should save portfolio to file if save option is true', () => {
        const fs = require('fs');
        
        sprolosta.processTrades(['mock-commsec.csv'], {
            broker: 'commsec',
            save: true,
            'portfolio-file': 'test-portfolio.json'
        });
        
        expect(fs.writeFileSync).toHaveBeenCalledWith('test-portfolio.json', expect.any(String));
    });
});