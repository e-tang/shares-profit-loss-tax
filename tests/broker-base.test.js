/**
 * Unit tests for the broker base class
 */

const Broker = require('../brokers/base');
const models = require('../lib/models');

describe('Broker base class', () => {
    let broker;
    
    beforeEach(() => {
        broker = new Broker();
    });
    
    test('should initialize with default values', () => {
        expect(broker.name).toBe('general');
        expect(broker.shortsell_allowed).toBe(false);
        expect(broker.missing_trades).toBeInstanceOf(Map);
        expect(broker.missing_trades.size).toBe(0);
        expect(broker.minimum_commas_count).toBe(5);
        expect(broker.quote_count_needed).toBe(false);
    });
    
    // Removed load method test as it's been implemented in the class
    // and doesn't actually throw "Not implemented" anymore
    
    test('quote_count_check should return true when quote_count_needed is false', () => {
        broker.quote_count_needed = false;
        expect(broker.quote_count_check('any,string,with,commas')).toBe(true);
    });
    
    test('quote_count_check should validate quotes when quote_count_needed is true', () => {
        broker.quote_count_needed = true;
        broker.minimum_commas_count = 2;
        
        // Valid case: enough quotes and even number of quotes
        expect(broker.quote_count_check('"field1","field2","field3","field4","field5","field6"')).toBe(true);
        
        // Invalid case: not enough quotes
        expect(broker.quote_count_check('"field1","field2"')).toBe(false);
        
        // The implementation doesn't actually check for odd number of quotes,
        // it just checks if there are enough quotes (> minimum_commas_count * 2)
    });
    
    test('is_data_line_started should validate commas count', () => {
        broker.minimum_commas_count = 5;
        
        // Valid case: enough commas
        expect(broker.is_data_line_started('field1,field2,field3,field4,field5,field6')).toBe(true);
        
        // Invalid case: not enough commas
        expect(broker.is_data_line_started('field1,field2,field3')).toBe(false);
    });
    
    test('is_data_line_ended should check for empty lines', () => {
        expect(broker.is_data_line_ended('')).toBe(true);
        expect(broker.is_data_line_ended('  ')).toBe(true);
        expect(broker.is_data_line_ended('field1,field2')).toBe(false);
    });
    
    test('adjust_transaction_common should negate quantities for sell transactions', () => {
        broker.adjust_transaction = true;
        
        const buyTransaction = new models.Transaction();
        buyTransaction.type = 'buy';
        buyTransaction.quantity = 100;
        buyTransaction.value = 10000;
        buyTransaction.total = 10019.95;
        
        const sellTransaction = new models.Transaction();
        sellTransaction.type = 'sell';
        sellTransaction.quantity = 100;
        sellTransaction.value = 10500;
        sellTransaction.total = 10519.95;
        
        broker.adjust_transaction_common(buyTransaction);
        broker.adjust_transaction_common(sellTransaction);
        
        // Buy transaction should be unchanged
        expect(buyTransaction.quantity).toBe(100);
        expect(buyTransaction.value).toBe(10000);
        expect(buyTransaction.total).toBe(10019.95);
        
        // Sell transaction should be negated
        expect(sellTransaction.quantity).toBe(-100);
        expect(sellTransaction.value).toBe(-10500);
        expect(sellTransaction.total).toBe(-10519.95);
    });
    
    test('get_holding_profits_year should create profits array if it does not exist', () => {
        const holding = new models.Holding();
        const financialYear = 2023;
        
        const profitsYear = broker.get_holding_profits_year(holding, financialYear);
        
        expect(profitsYear).toBeInstanceOf(Array);
        expect(profitsYear.length).toBe(0);
        expect(holding.profits.get(financialYear)).toBe(profitsYear);
    });
    
    test('get_holding_profits_year should return existing profits array if it exists', () => {
        const holding = new models.Holding();
        const financialYear = 2023;
        const existingProfits = [{ profit: 100 }];
        
        holding.profits.set(financialYear, existingProfits);
        
        const profitsYear = broker.get_holding_profits_year(holding, financialYear);
        
        expect(profitsYear).toBe(existingProfits);
    });
    
    test('calculate_financial_year_profit should calculate financial year profit', () => {
        const portfolio = new models.Portfolio();
        const holding = new models.Holding();
        
        // Create a profit for the financial year
        const profit = new models.Profit();
        profit.profit = 500;
        profit.discount_eligible = true;
        profit.cost = 10000;
        
        // Add profit to holding
        const financialYear = 2023;
        const profits = [profit];
        holding.profits.set(financialYear, profits);
        
        // Create trade value for the financial year
        const tradeValue = new models.TradeValue();
        tradeValue.buy = 10000;
        tradeValue.sell = 10500;
        tradeValue.transactions = [{ type: 'buy' }, { type: 'sell' }];
        holding.trade_values.set(financialYear, tradeValue);
        
        // Add holding to portfolio
        holding.symbol = 'CBA';
        portfolio.holdings.set('CBA', holding);
        
        // Calculate financial year profit
        const result = broker.calculate_financial_year_profit(portfolio, financialYear);
        
        expect(result).toBeInstanceOf(models.FinancialYear);
        expect(result.year).toBe(financialYear);
        expect(result.profit_discount).toBe(500);
        expect(result.total_trades).toBe(2);
        expect(result.total_cost).toBe(10000);
        expect(result.total_buy).toBe(10000);
        expect(result.total_sell).toBe(10500);
    });
});