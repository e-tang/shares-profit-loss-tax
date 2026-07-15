/**
 * @file selfwealth.js
 *
 * Copyright (c) 2026 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT -- format unverified against a real export
 * ---------------------------------------------------------------------------
 * The column layout below (Trade Date, Settlement Date, Action, Code,
 * Company, Units, Average Price, Brokerage, Total Value) is implemented from
 * SelfWealth's *published* trade-confirmation export format. We do not have
 * a real SelfWealth customer file to validate this against, so this parser
 * ships as best-effort:
 *   - header detection (is_data_line_started) requires an EXACT match on the
 *     documented header line, so we never misclassify another broker's file
 *     as SelfWealth;
 *   - if the real export differs (extra/reordered columns, different
 *     currency handling, etc.) this parser will simply fail to recognise the
 *     file rather than silently mis-parse it -- the app's import-preview /
 *     diagnostics flow and the "report a failed import" support form are the
 *     intended safety net for that case.
 * If/when a real SelfWealth export is obtained, this file and its test
 * fixture should be revalidated against it.
 */

const Broker = require('./base');

const models = require('../lib/models');

class SelfWealth extends Broker {
    constructor(options) {
        super(options);

        this.name = 'SelfWealth';
    }

    /**
     * SelfWealth CSV exports are plain, unquoted CSV -- no fields contain
     * embedded commas, so the default (quote_count_needed = false) base
     * splitter in load_content_common handles them as-is; no override of
     * quote_count_check/quote_count_needed is required here.
     */
    is_data_line_started(line) {
        // Conservative exact match: never misclassify another broker's file
        // as a SelfWealth export.
        return line.startsWith('Trade Date,Settlement Date,Action,');
    }

    line_to_transaction(fields, index) {
        // Trade Date
        // Settlement Date
        // Action           (Buy / Sell / Dividend / ... -- only Buy/Sell are trades)
        // Code
        // Company
        // Units
        // Average Price
        // Brokerage
        // Total Value
        if (!fields || fields.length < 9) {
            return null;
        }

        let action = String(fields[2]).toLowerCase();
        if (action !== 'buy' && action !== 'sell') {
            // non-trade rows (e.g. Dividend, Transfer) are not transactions;
            // load_content_common reports these via diagnostics
            // (reason: 'not-a-transaction') when a collector is present.
            return null;
        }

        let transaction = new models.Transaction();
        transaction.id = index;

        // date is DD/MM/YYYY, same split-based approach as commsec.js's
        // before_2023 handler.
        let tokens = String(fields[0]).split('/');
        transaction.date = new Date(tokens[2], tokens[1] - 1, tokens[0]);

        transaction.type = action;
        transaction.symbol = fields[3];
        transaction.company = fields[4];
        transaction.quantity = parseInt(fields[5]);
        transaction.price = parseFloat(fields[6]);
        transaction.fee = parseFloat(fields[7]);

        transaction.value = transaction.quantity * transaction.price;

        // Trust the CSV's own "Total Value" column as the authoritative
        // settlement amount, mirroring commsec.js's before_2023 handler
        // (which trusts its own "Total Value" field rather than recomputing
        // value + fee). This is what correctly nets brokerage into the
        // total for both buys (value + fee) and sells (value - fee) without
        // this parser needing to special-case the arithmetic per type --
        // adjust_transaction_common() below then normalizes the sign.
        transaction.total = parseFloat(fields[8]);

        this.adjust_transaction_common(transaction);

        return transaction;
    }
}

module.exports = SelfWealth;
