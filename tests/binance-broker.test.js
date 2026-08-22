const fs = require('fs');
const path = require('path');

const sprolosta = require('../lib');
const brokers = require('../brokers');

describe('Binance broker', () => {
    const fixture = path.join(__dirname, 'test-data', 'mock-binance-transaction-history.csv');

    test('identifies a BOM-prefixed Binance transaction-history export', () => {
        expect(brokers.identifyBroker(fs.readFileSync(fixture, 'utf8'))).toBe('binance');
    });

    test('calculates only complete USDT-quoted pairs and includes fees', () => {
        const results = sprolosta.processTrades([fixture], {
            broker: 'binance',
            save: false,
            year: 2025,
        });
        const financialYear = results.financial_years['2025-2026'];

        // BTC: 119 proceeds - 100 cost = 19
        // LTC: 60 proceeds - 50 cost = 10
        // The TRX -> ETH cross and later ETH sale are unpriced and excluded.
        expect(financialYear.profit).toBeCloseTo(29, 10);
        expect(financialYear.profit_discount).toBe(0);
        expect(financialYear.total_cost).toBeCloseTo(150, 10);
        expect(financialYear.total_buy).toBeCloseTo(150, 10);
        expect(financialYear.total_sell).toBeCloseTo(-179, 10);
        expect(financialYear.complete_pairs).toBe(2);
        expect(financialYear.quote_currency).toBe('USDT');
        expect(financialYear.ignored_funding_records).toBe(2);
        expect(financialYear.ignored_cross_crypto_conversions).toBe(1);
        expect(financialYear.unmatched_disposal_quantity).toEqual({ TRX: 10 });
        expect(results.holdings).toEqual([]);
    });

    test('does not retain ledger rows between calculations', () => {
        const first = sprolosta.processTrades([fixture], { broker: 'binance', save: false, year: 2025 });
        const second = sprolosta.processTrades([fixture], { broker: 'binance', save: false, year: 2025 });

        expect(second.financial_years['2025-2026'].profit)
            .toBeCloseTo(first.financial_years['2025-2026'].profit, 10);
        expect(second.financial_years['2025-2026'].source_records).toBe(17);
    });
});
