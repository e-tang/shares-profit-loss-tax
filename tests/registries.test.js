/**
 * Unit tests for registry statement parsers (Computershare, MUFG).
 *
 * NOTE: the column layouts implemented here are derived from Computershare's
 * and MUFG's (formerly Link Market Services) *published* dividend/payment
 * history CSV export documentation -- we do not have real customer exports
 * to validate against. See registries/computershare.js and registries/mufg.js
 * for the full disclosure comments. These tests lock in the ISO payDate /
 * franked-credits mapping / source-tag / diagnostics-gating / throw-on-unknown
 * contract described in registries/index.js.
 */

const registries = require('../registries');

const CS_CSV = [
    'Payment Date,Company Code,Company Name,Payment Type,Dividend Rate,Shares Held,Gross Payment,Franked Amount,Unfranked Amount,Franking Credits,Net Payment',
    '15/03/2023,BHP,BHP GROUP LIMITED,Dividend,0.70,1000,700.00,700.00,0.00,300.00,700.00',
    '01/09/2023,BHP,BHP GROUP LIMITED,Dividend,1.00,1000,1000.00,500.00,500.00,214.29,1000.00',
].join('\n');

const MUFG_CSV = [
    'Payment Date,ASX Code,Description,Class,Units,Rate,Franked Dividend,Unfranked Dividend,Imputation Credit,Payment Amount',
    '10/02/2024,CBA,COMMONWEALTH BANK,Final,100,2.00,0.00,200.00,0.00,200.00',
].join('\n');

describe('registry parsers', () => {
    test('Computershare statement parses to dividend records', () => {
        const { records } = registries.parseStatement(CS_CSV, { diagnostics: [] });
        expect(records).toHaveLength(2);
        expect(records[0]).toMatchObject({
            symbol: 'BHP', totalAmount: 700, frankedPortion: 700, frankingCredits: 300, source: 'computershare',
        });
        expect(records[0].payDate).toBe('2023-03-15');
        expect(records[1].frankedPortion).toBeCloseTo(500);
    });

    test('MUFG statement auto-detects and parses', () => {
        const { records } = registries.parseStatement(MUFG_CSV, {});
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ symbol: 'CBA', totalAmount: 200, frankedPortion: 0, source: 'mufg' });
        expect(records[0].payDate).toBe('2024-02-10');
    });

    test('non-dividend rows are skipped with diagnostics', () => {
        const withNoise = CS_CSV + '\n15/04/2023,BHP,BHP GROUP LIMITED,DRP Allotment,0,50,0,0,0,0,0';
        const diagnostics = [];
        const { records } = registries.parseStatement(withNoise, { diagnostics });
        expect(records).toHaveLength(2);
        expect(diagnostics.some((d) => d.reason === 'not-a-dividend')).toBe(true);
    });

    test('malformed data row: skipped+collected with collector, throws without', () => {
        const bad = CS_CSV + '\nGARBAGE LINE NO COMMAS';
        const diagnostics = [];
        const { records } = registries.parseStatement(bad, { diagnostics });
        expect(records).toHaveLength(2);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(() => registries.parseStatement(bad, {})).toThrow();
    });

    test('unrecognized content throws with a clear message', () => {
        expect(() => registries.parseStatement('Alpha,Beta\n1,2', {})).toThrow(/unrecognized registry format/i);
    });
});
