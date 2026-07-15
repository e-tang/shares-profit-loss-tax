/**
 * @file mufg.js
 *
 * Copyright (c) 2026 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT -- format unverified against a real export
 * ---------------------------------------------------------------------------
 * The column layout below (Payment Date, ASX Code, Description, Class,
 * Units, Rate, Franked Dividend, Unfranked Dividend, Imputation Credit,
 * Payment Amount) is implemented from MUFG Corporate Markets' (formerly
 * Link Market Services -- MUFG acquired/rebranded Link's Australian share
 * registry business) *published* dividend/payment-history CSV export
 * documentation, following the same shape as Computershare's export
 * (franked/unfranked split + imputation/franking credit per payment) but
 * with MUFG/Link's own column names ("ASX Code" rather than "Company Code",
 * "Class" rather than "Payment Type", "Imputation Credit" rather than
 * "Franking Credits", "Payment Amount" rather than "Net Payment"). We do not
 * have a real MUFG/Link customer export to validate this against, so this
 * parser ships as best-effort, exactly like brokers/selfwealth.js and
 * registries/computershare.js:
 *   - header detection (`matches`) requires an EXACT prefix match on the
 *     documented header line, so we never misclassify another registry's
 *     (or a broker's) file as an MUFG statement;
 *   - if the real export differs (extra/reordered columns, different Class
 *     vocabulary, etc.) this parser will simply fail to recognise the file
 *     rather than silently mis-parse it -- the app's import-preview /
 *     diagnostics flow and the "report a failed import" support form are the
 *     intended safety net for that case.
 * If/when a real MUFG/Link export is obtained, this file and its test
 * fixture should be revalidated against it.
 * ---------------------------------------------------------------------------
 *
 * Class vocabulary: MUFG/Link payment-history exports use "Class" to
 * describe the dividend instalment (e.g. 'Interim', 'Final', 'Special'),
 * analogous to Computershare's "Payment Type". Cash dividend payments are
 * recognised by Class values that name a dividend instalment; non-dividend
 * register events reported through the same export shape (e.g. a DRP/DSSP
 * share allotment note, or a return-of-capital event) would carry a
 * different, non-instalment Class label and are treated as
 * 'not-a-dividend'. Since only the documented Interim/Final/Special
 * instalment vocabulary is known with any confidence, we whitelist those
 * three (case-insensitive) rather than guess at every possible non-dividend
 * label -- deliberately conservative, per the honesty constraint.
 */

const { parseMoney, parseDMY } = require('./base');

const HEADER = 'Payment Date,ASX Code,Description,Class,Units,Rate,Franked Dividend,Unfranked Dividend,Imputation Credit,Payment Amount';

const DIVIDEND_CLASSES = new Set(['interim', 'final', 'special']);

function matches(headerLine) {
    return String(headerLine).trim().startsWith(HEADER);
}

/**
 * @param {string[]} fields - raw split fields for one data row
 * @param {(reason: string) => void} collectorPushFn - called with a
 *   diagnostics reason when the row is recognised but intentionally
 *   skipped (e.g. not a dividend payment)
 * @returns {Object|null} a dividend record, or null when skipped
 * @throws {Error} on malformed numeric/date fields (caller routes this
 *   through the collector-gated skip/throw helper)
 */
function rowToRecord(fields, collectorPushFn) {
    if (!fields || fields.length < 10) {
        throw new Error('Expected 10 columns, got ' + (fields ? fields.length : 0));
    }

    const [paymentDate, asxCode, , dividendClass, , , frankedDividend, unfrankedDividend, imputationCredit, paymentAmount] = fields;

    if (!DIVIDEND_CLASSES.has(String(dividendClass).trim().toLowerCase())) {
        collectorPushFn('not-a-dividend');
        return null;
    }

    const payDate = parseDMY(paymentDate); // throws on malformed date

    const totalAmount = parseMoney(paymentAmount);
    const frankedPortion = parseMoney(frankedDividend);
    const credits = parseMoney(imputationCredit);
    // unfrankedDividend is not separately needed by the output contract
    // (totalAmount - frankedPortion recovers it), but validate it parses
    // too so a malformed row is still caught rather than silently dropped.
    const unfranked = parseMoney(unfrankedDividend);
    if (totalAmount === null || frankedPortion === null || credits === null || unfranked === null) {
        throw new Error('Malformed numeric field in MUFG row: ' + fields.join(','));
    }

    return {
        symbol: asxCode,
        payDate,
        totalAmount,
        frankedPortion,
        frankingCredits: credits,
        source: 'mufg',
    };
}

module.exports = { name: 'mufg', matches, rowToRecord };
