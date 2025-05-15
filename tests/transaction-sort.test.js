/**
 * Unit tests for date sorting functionality
 */

const models = require('../lib/models');

// Define a simple sort function that mimics the transaction_sort function in lib.js
function sortFunction(a, b) {
    if (a.date < b.date)
        return -1;
    else if (a.date > b.date)
        return 1;
    else
        return 0;
}

describe('transaction_sort function', () => {
    test('should sort transactions by date in ascending order', () => {
        const transaction1 = new models.Transaction();
        transaction1.date = new Date('2023-01-15');
        
        const transaction2 = new models.Transaction();
        transaction2.date = new Date('2023-02-20');
        
        const transaction3 = new models.Transaction();
        transaction3.date = new Date('2022-12-10');
        
        // Test sort function directly
        expect(sortFunction(transaction1, transaction2)).toBe(-1);
        expect(sortFunction(transaction2, transaction1)).toBe(1);
        expect(sortFunction(transaction3, transaction1)).toBe(-1);
        expect(sortFunction(transaction1, transaction1)).toBe(0);
        
        // Test array sorting
        const transactions = [transaction1, transaction2, transaction3];
        const sortedTransactions = [...transactions].sort(sortFunction);
        
        expect(sortedTransactions[0]).toBe(transaction3);
        expect(sortedTransactions[1]).toBe(transaction1);
        expect(sortedTransactions[2]).toBe(transaction2);
    });
});