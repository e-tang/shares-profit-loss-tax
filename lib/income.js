/**
 * Pure income aggregation module.
 *
 * AU dividend tax rules: a dividend is assessable in the financial year of
 * its PAYMENT date (1 July – 30 June). Grossed-up assessable income =
 * franked + credits + unfranked. This module only AGGREGATES records the
 * app supplies — it does not compute franking credits itself, and it does
 * NOT assume 100% franking or any particular company tax rate. The caller
 * (the app's dividend entry form) is responsible for supplying
 * `frankingCredits` already calculated (e.g. franked * 30/70 at the 30%
 * company rate for a fully franked dividend).
 */

const utils = require('./utils');

/**
 * Parse an ISO "YYYY-MM-DD" (or Date) payDate into a LOCAL Date at local
 * midnight.
 *
 * TIMEZONE NOTE: `new Date('2024-06-30')` parses as UTC midnight. In a
 * timezone ahead of UTC (e.g. AEST, UTC+10) that UTC instant is LATER than
 * local midnight of the same calendar date by the UTC offset. Since
 * `get_financial_year` (lib/utils.js) compares the given Date's epoch
 * instant against locally-constructed FY boundary Dates (e.g.
 * `new Date(year, 5, 30)` = local midnight 30 June), a UTC-parsed "2024-06-30"
 * ends up epoch-AFTER local-midnight-30-June, so the `date <= end` boundary
 * check fails and the record is (incorrectly) pushed into the NEXT financial
 * year. Verified empirically on this machine (AEST, UTC+10):
 *   get_financial_year(new Date('2024-06-30'))        -> 2024 (WRONG, should be 2023)
 *   get_financial_year(new Date(2024, 5, 30))          -> 2023 (correct)
 * To avoid this, we parse the ISO date string components directly into a
 * local Date (`new Date(y, m-1, d)`) instead of letting the Date
 * constructor parse the string as UTC.
 *
 * @param {string|Date} payDate
 * @returns {Date} local Date, or an Invalid Date if unparseable
 */
function toLocalDate(payDate) {
    if (payDate instanceof Date) {
        return payDate;
    }
    if (typeof payDate === 'string') {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(payDate);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            return new Date(year, month - 1, day);
        }
    }
    // Fall back to the platform parser for anything else (garbage input
    // included) — it will produce an Invalid Date for unparseable strings,
    // which the caller checks for below.
    return new Date(payDate);
}

/**
 * Aggregate dividend records into per-financial-year income summaries.
 *
 * Dividend record contract (mirrors the app's Datastore entity):
 *   { symbol, payDate (ISO string or Date), exDate?, totalAmount,
 *     frankedPortion, frankingCredits, drp? }
 *
 * @param {Array<{symbol:string, payDate:(string|Date), totalAmount:number,
 *   frankedPortion:number, frankingCredits:number}>} dividends
 * @returns {Object<string, {total: Object, symbols: Object}>} keyed
 *   "2022-2023" style, matching the trade side's financial_years keys
 *   (see lib.js#processTradesWithRecords).
 */
function calculateIncome(dividends) {
    const result = {};

    for (const d of dividends || []) {
        const date = toLocalDate(d.payDate);
        if (!date || isNaN(date.getTime())) {
            throw new Error(`Invalid payDate for ${d.symbol}: ${d.payDate}`);
        }

        const startYear = utils.get_financial_year(date);
        const key = `${startYear}-${startYear + 1}`;

        const franked = Number(d.frankedPortion) || 0;
        const total = Number(d.totalAmount) || 0;
        const unfranked = total - franked;
        const credits = Number(d.frankingCredits) || 0;

        const fy = result[key] = result[key] || {
            total: { franked: 0, unfranked: 0, credits: 0, grossedUp: 0, count: 0 },
            symbols: {},
        };
        const sym = fy.symbols[d.symbol] = fy.symbols[d.symbol] || {
            franked: 0, unfranked: 0, credits: 0, grossedUp: 0, total: 0, count: 0,
        };

        for (const bucket of [fy.total, sym]) {
            bucket.franked += franked;
            bucket.unfranked += unfranked;
            bucket.credits += credits;
            bucket.grossedUp += franked + credits + unfranked;
            bucket.count += 1;
        }
        sym.total += total;
    }

    return result;
}

module.exports = { calculateIncome };
