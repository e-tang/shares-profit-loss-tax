/**
 * @file computershare.js
 *
 * Copyright (c) 2026 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT -- format unverified against a real export
 * ---------------------------------------------------------------------------
 * The column layout below (Payment Date, Company Code, Company Name,
 * Payment Type, Dividend Rate, Shares Held, Gross Payment, Franked Amount,
 * Unfranked Amount, Franking Credits, Net Payment) is implemented from
 * Computershare Investor Centre's *published* "Payment History" / dividend
 * statement CSV export documentation (the standard AU registry payment-
 * history download: payment date, security code/name, franked/unfranked
 * split and franking credits per payment). We do not have a real
 * Computershare customer export to validate this against, so this parser
 * ships as best-effort, exactly like brokers/selfwealth.js:
 *   - header detection (`matches`) requires an EXACT prefix match on the
 *     documented header line, so we never misclassify another registry's
 *     (or a broker's) file as a Computershare statement;
 *   - if the real export differs (extra/reordered columns, different
 *     Payment Type vocabulary, etc.) this parser will simply fail to
 *     recognise the file rather than silently mis-parse it -- the app's
 *     import-preview / diagnostics flow and the "report a failed import"
 *     support form are the intended safety net for that case.
 * If/when a real Computershare export is obtained, this file and its test
 * fixture should be revalidated against it.
 * ---------------------------------------------------------------------------
 *
 * Payment Type vocabulary: Computershare payment-history exports use
 * "Payment Type" to distinguish cash dividend payments from other register
 * events (e.g. DRP/DSSP participation confirmations, which show the shares
 * allotted under a dividend reinvestment plan rather than a cash payment).
 * Only 'Dividend' (case-insensitive) is treated as an assessable cash
 * dividend record here; anything else (e.g. 'DRP Allotment') is reported as
 * 'not-a-dividend' and skipped -- consistent with how a DRP allotment is a
 * separate CGT cost-base event, not itself a Dividend income record.
 */

const { parseMoney, parseDMY } = require('./base');

const HEADER = 'Payment Date,Company Code,Company Name,Payment Type,Dividend Rate,Shares Held,Gross Payment,Franked Amount,Unfranked Amount,Franking Credits,Net Payment';

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
    if (!fields || fields.length < 11) {
        throw new Error('Expected 11 columns, got ' + (fields ? fields.length : 0));
    }

    const [paymentDate, companyCode, , paymentType, , , grossPayment, frankedAmount, , frankingCredits] = fields;

    if (String(paymentType).trim().toLowerCase() !== 'dividend') {
        collectorPushFn('not-a-dividend');
        return null;
    }

    const payDate = parseDMY(paymentDate); // throws on malformed date

    const totalAmount = parseMoney(grossPayment);
    const frankedPortion = parseMoney(frankedAmount);
    const credits = parseMoney(frankingCredits);
    if (totalAmount === null || frankedPortion === null || credits === null) {
        throw new Error('Malformed numeric field in Computershare row: ' + fields.join(','));
    }

    return {
        symbol: companyCode,
        payDate,
        totalAmount,
        frankedPortion,
        frankingCredits: credits,
        source: 'computershare',
    };
}

module.exports = { name: 'computershare', matches, rowToRecord };
