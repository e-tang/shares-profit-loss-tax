/**
 * Unit tests for the CommSec broker
 */

const CommSec = require('../brokers/commsec');
const models = require('../lib/models');

describe('CommSec broker', () => {
    let broker;
    
    beforeEach(() => {
        broker = new CommSec();
    });
    
    test('should initialize with correct values', () => {
        expect(broker.name).toBe('CommSec');
        expect(broker.before_2023).toBe(false);
    });
    
    test('quote_count_check should return true when before_2023 is false', () => {
        broker.before_2023 = false;
        expect(broker.quote_count_check('any,line')).toBe(true);
    });
    
    test('load_content should detect before_2023 format correctly', () => {
        const trades = new models.Trades();
        
        // Mock implementation to avoid actual processing
        jest.spyOn(broker, 'load_content_common').mockReturnValue(0);
        
        // Test before 2023 format detection
        const before2023Content = 'Code,Company,Date,Type,Quantity,Unit Price ($),Trade Value ($)';
        broker.load_content(trades, before2023Content, { index: 0, offset: 0 });
        expect(broker.before_2023).toBe(true);
        
        // Test after 2023 format detection
        const after2023Content = 'Date,Reference,Details,Debit($),Credit($),Balance($)';
        broker.load_content(trades, after2023Content, { index: 0, offset: 0 });
        expect(broker.before_2023).toBe(false);
        
        // Test no data available
        const noDataContent = 'No data available for the specified period';
        expect(() => {
            broker.load_content(trades, noDataContent, { index: 0, offset: 0 });
        }).not.toThrow();
        
        // Test unknown format
        const unknownContent = 'This is not a valid CommSec format';
        expect(() => {
            broker.load_content(trades, unknownContent, { index: 0, offset: 0 });
        }).toThrow('Unknown CommSec format');
    });
    
    test('line_to_transaction should delegate to correct format handler', () => {
        // Mock implementations
        jest.spyOn(broker, 'line_to_transaction_before_2023').mockReturnValue({});
        jest.spyOn(broker, 'line_to_transaction_after_2023').mockReturnValue({});
        
        // Test before 2023 delegation
        broker.before_2023 = true;
        broker.line_to_transaction([], 1);
        expect(broker.line_to_transaction_before_2023).toHaveBeenCalledWith([], 1);
        expect(broker.line_to_transaction_after_2023).not.toHaveBeenCalled();
        
        // Test after 2023 delegation
        broker.line_to_transaction_before_2023.mockClear();
        broker.line_to_transaction_after_2023.mockClear();
        
        broker.before_2023 = false;
        broker.line_to_transaction([], 1);
        expect(broker.line_to_transaction_before_2023).not.toHaveBeenCalled();
        expect(broker.line_to_transaction_after_2023).toHaveBeenCalledWith([], 1);
    });
    
    test('line_to_transaction_after_2023 should parse fields correctly for buy transaction', () => {
        const fields = [
            '15/02/2023',              // Date
            'REF12345',                // Reference
            'B 100 CBA @ 105.50',      // Details
            '10550.00',                // Debit
            '',                        // Credit
            '20000.00'                 // Balance
        ];
        
        const transaction = broker.line_to_transaction_after_2023(fields, 1);
        
        expect(transaction).toBeInstanceOf(models.Transaction);
        expect(transaction.id).toBe(1);
        expect(transaction.date.getFullYear()).toBe(2023);
        expect(transaction.date.getMonth()).toBe(1); // February (0-indexed)
        expect(transaction.date.getDate()).toBe(15);
        expect(transaction.type).toBe('buy');
        expect(transaction.quantity).toBe(100);
        expect(transaction.symbol).toBe('CBA');
        expect(transaction.price).toBe(105.50);
        expect(transaction.value).toBe(10550);
        expect(transaction.total).toBe(10550);
    });
    
    test('line_to_transaction_after_2023 should parse fields correctly for sell transaction', () => {
        const fields = [
            '20/03/2023',              // Date
            'REF67890',                // Reference
            'S 50 CBA @ 110.25',       // Details
            '',                        // Debit
            '5512.50',                 // Credit
            '25512.50'                 // Balance
        ];
        
        const transaction = broker.line_to_transaction_after_2023(fields, 2);
        
        expect(transaction).toBeInstanceOf(models.Transaction);
        expect(transaction.id).toBe(2);
        expect(transaction.type).toBe('sell');
        expect(transaction.quantity).toBe(50);
        expect(transaction.symbol).toBe('CBA');
        expect(transaction.price).toBe(110.25);
        expect(transaction.value).toBe(5512.5);
        expect(transaction.total).toBe(5512.5);
    });
    
    test('line_to_transaction_after_2023 should return null for non-buy/sell transactions', () => {
        const fields = [
            '25/03/2023',              // Date
            'REF12345',                // Reference
            'DIVIDEND PAYMENT',        // Details
            '',                        // Debit
            '250.00',                  // Credit
            '25762.50'                 // Balance
        ];
        
        const transaction = broker.line_to_transaction_after_2023(fields, 3);
        
        expect(transaction).toBeNull();
    });
    
    test('line_to_transaction_before_2023 should parse fields correctly', () => {
        const fields = [
            'CBA',                     // Code
            'COMMONWEALTH BANK',       // Company
            '15/02/2023',              // Date
            'BUY',                     // Type
            '100',                     // Quantity
            '105.50',                  // Unit Price
            '10550.00',                // Trade Value
            '19.95',                   // Brokerage+GST
            '2.00',                    // GST
            'CN12345',                 // Contract Note
            '10569.95'                 // Total Value
        ];
        
        const transaction = broker.line_to_transaction_before_2023(fields, 1);
        
        expect(transaction).toBeInstanceOf(models.Transaction);
        expect(transaction.id).toBe(1);
        expect(transaction.symbol).toBe('CBA');
        expect(transaction.company).toBe('COMMONWEALTH BANK');
        expect(transaction.date.getFullYear()).toBe(2023);
        expect(transaction.date.getMonth()).toBe(1); // February (0-indexed)
        expect(transaction.date.getDate()).toBe(15);
        expect(transaction.type).toBe('buy');
        expect(transaction.quantity).toBe(100);
        expect(transaction.price).toBe(105.50);
        expect(transaction.value).toBe(10550);
        expect(transaction.fee).toBe(19.95);
        expect(transaction.gst).toBe(2);
        expect(transaction.note).toBe('CN12345');
        expect(transaction.total).toBe(10569.95);
    });
});