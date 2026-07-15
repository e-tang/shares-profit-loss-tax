/**
 * Unit tests for the income module (pure dividend/franking aggregation).
 */

const { calculateIncome } = require('../lib');

// Dividend record contract (mirrors the app's Datastore entity):
// { symbol, payDate (ISO string or Date), exDate?, totalAmount, frankedPortion, frankingCredits, drp? }
const DIVIDENDS = [
    // FY 2022-2023 (payment 2023-03-15): fully franked $700 at 30% rate → credits 300
    { symbol: 'BHP', payDate: '2023-03-15', totalAmount: 700, frankedPortion: 700, frankingCredits: 300 },
    // FY 2023-2024 (payment 2023-09-01): 50% franked $1000 → franked 500, credits 500*30/70
    { symbol: 'BHP', payDate: '2023-09-01', totalAmount: 1000, frankedPortion: 500, frankingCredits: 214.29 },
    // FY 2023-2024: unfranked
    { symbol: 'CBA', payDate: '2024-02-10', totalAmount: 200, frankedPortion: 0, frankingCredits: 0 },
];

describe('calculateIncome', () => {
    test('groups by payment-date financial year with per-symbol and total aggregates', () => {
        const income = calculateIncome(DIVIDENDS);
        expect(Object.keys(income).sort()).toEqual(['2022-2023', '2023-2024']);

        const fy23 = income['2022-2023'];
        expect(fy23.total.franked).toBeCloseTo(700);
        expect(fy23.total.unfranked).toBeCloseTo(0);
        expect(fy23.total.credits).toBeCloseTo(300);
        expect(fy23.total.grossedUp).toBeCloseTo(1000);   // 700 + 300 + 0
        expect(fy23.symbols.BHP.count).toBe(1);

        const fy24 = income['2023-2024'];
        expect(fy24.total.franked).toBeCloseTo(500);
        expect(fy24.total.unfranked).toBeCloseTo(700);    // (1000-500) + 200
        expect(fy24.total.credits).toBeCloseTo(214.29);
        expect(fy24.total.grossedUp).toBeCloseTo(1414.29);
        expect(fy24.symbols.CBA.total).toBeCloseTo(200);
    });

    test('FY boundary: June 30 vs July 1', () => {
        const income = calculateIncome([
            { symbol: 'X', payDate: '2024-06-30', totalAmount: 10, frankedPortion: 0, frankingCredits: 0 },
            { symbol: 'X', payDate: '2024-07-01', totalAmount: 20, frankedPortion: 0, frankingCredits: 0 },
        ]);
        expect(income['2023-2024'].total.grossedUp).toBeCloseTo(10);
        expect(income['2024-2025'].total.grossedUp).toBeCloseTo(20);
    });

    test('empty input yields empty object; invalid dates throw', () => {
        expect(calculateIncome([])).toEqual({});
        expect(() => calculateIncome([{ symbol: 'X', payDate: 'garbage', totalAmount: 1, frankedPortion: 0, frankingCredits: 0 }]))
            .toThrow(/payDate/i);
    });
});
