/**
 * Unit tests for the SelfWealth broker
 *
 * NOTE: the SelfWealth column layout implemented here is derived from
 * SelfWealth's published trade-confirmation export format -- we do not have
 * a real customer export to validate against. See brokers/selfwealth.js for
 * the full disclosure comment. These tests lock in the sign/total
 * conventions verified against brokers/base.js (adjust_transaction_common)
 * and brokers/commsec.js's before_2023 handler (which this parser mirrors
 * structurally: it trusts the CSV's own "Total Value" column rather than
 * recomputing it, exactly like CommSec's before_2023 format does with its
 * "Total Value" field).
 */

const brokers = require('../brokers');

const SW_CSV = [
    'Trade Date,Settlement Date,Action,Code,Company,Units,Average Price,Brokerage,Total Value',
    '15/01/2023,17/01/2023,Buy,BHP,BHP Group Ltd,100,40.00,9.50,4009.50',
    '20/03/2024,22/03/2024,Sell,BHP,BHP Group Ltd,100,45.00,9.50,4490.50',
].join('\n');

describe('SelfWealth broker', () => {
    test('parses buys and sells with engine sign conventions', () => {
        const result = brokers.normalizeData(SW_CSV, 'selfwealth', {});
        expect(result.count).toBe(2);
        const txs = result.trades.symbols.get('BHP');
        expect(txs).toHaveLength(2);
        const [buy, sell] = txs;
        expect(buy.type).toBe('buy');
        expect(buy.quantity).toBe(100);
        expect(buy.price).toBeCloseTo(40);
        expect(buy.fee).toBeCloseTo(9.5);
        expect(buy.total).toBeCloseTo(4009.5);   // value + fee
        expect(sell.type).toBe('sell');
        expect(sell.quantity).toBe(-100);         // engine negates sells
        expect(sell.total).toBeCloseTo(-4490.5);  // signed value + fee = -4500 + 9.5
    });

    test('auto-detected from the header', () => {
        const result = brokers.normalizeData(SW_CSV, 'any', {});
        expect(result.count).toBe(2);
    });

    test('non-trade Action rows are skipped, reported via diagnostics', () => {
        const csvWithDividend = SW_CSV + '\n30/06/2024,30/06/2024,Dividend,BHP,BHP Group Ltd,0,0,0,150.00';
        const diagnostics = [];
        const result = brokers.normalizeData(csvWithDividend, 'selfwealth', { diagnostics });
        expect(result.trades.symbols.get('BHP')).toHaveLength(2);
        expect(diagnostics.some((d) => d.reason === 'not-a-transaction')).toBe(true);
    });
});
