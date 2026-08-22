/**
 * @file base.js
 *
 * Copyright (c) 2026 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * Shared helpers for share-registry (Computershare, MUFG/Link Market
 * Services, ...) dividend/payment-history statement parsers.
 *
 * Registries are a NEW, deliberately small family -- they are NOT brokers
 * (they never see buy/sell trades, only dividend payment events) so this
 * does not subclass brokers/base.js's Broker class. Instead each registry
 * module is a plain object { name, matches(headerLine), rowToRecord(fields,
 * collectorPushFn) } and registries/index.js drives them, mirroring the
 * *shape* of brokers/base.js's diagnostics contract (collector-gated
 * skip-vs-throw) without inheriting its trade-specific machinery.
 */

/**
 * Split a single CSV data line into raw string fields.
 *
 * Registry statements observed/documented for Computershare and MUFG/Link
 * are plain, unquoted CSV (no embedded commas in the fields we consume --
 * company names don't contain commas in these export formats), so a plain
 * split is sufficient; this mirrors selfwealth.js's reasoning (see that
 * file's is_data_line_started comment) for not needing quote-aware parsing.
 *
 * @param {string} line
 * @returns {string[]}
 */
function splitLine(line) {
    return line.split(',').map((field) => field.trim());
}

/**
 * Parse a money-like string ("$1,234.56", "1234.56", "") into a number.
 * Strips a leading currency symbol and thousands-separator commas.
 * Returns null (not NaN) when the result isn't a finite number, so callers
 * can distinguish "absent/blank" from a real parse failure if they choose.
 *
 * @param {string} str
 * @returns {number|null}
 */
function parseMoney(str) {
    if (str === undefined || str === null) {
        return null;
    }
    const cleaned = String(str).replace(/[$,]/g, '').trim();
    if (cleaned === '') {
        return null;
    }
    const value = parseFloat(cleaned);
    return Number.isNaN(value) ? null : value;
}

/**
 * Parse a "DD/MM/YYYY" (AU date convention, matches lib/utils.js#to_date)
 * string into an ISO "YYYY-MM-DD" string via LOCAL date component
 * formatting.
 *
 * TIMEZONE NOTE (same lesson as lib/income.js#toLocalDate): we deliberately
 * build the ISO string by zero-padding the already-parsed day/month/year
 * components ourselves, rather than constructing a Date and calling
 * .toISOString(). Date#toISOString() always renders in UTC, so in a
 * timezone ahead of UTC (e.g. AEST, UTC+10) a local midnight Date for, say,
 * 30 June rolls back to 29 June once formatted in UTC -- silently shifting
 * the record across a financial-year boundary. Formatting the DD/MM/YYYY
 * components directly avoids ever routing through a Date/UTC round trip.
 *
 * @param {string} str - "DD/MM/YYYY"
 * @returns {string} "YYYY-MM-DD"
 * @throws {Error} if str isn't a parseable DD/MM/YYYY date
 */
function parseDMY(str) {
    const tokens = String(str).trim().split('/');
    if (tokens.length !== 3) {
        throw new Error('Invalid date format (expected DD/MM/YYYY): ' + str);
    }
    const day = parseInt(tokens[0], 10);
    const month = parseInt(tokens[1], 10);
    const year = parseInt(tokens[2], 10);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) ||
        day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) {
        throw new Error('Invalid date format (expected DD/MM/YYYY): ' + str);
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

/**
 * Collector-gated skip/throw helper, mirroring brokers/base.js's
 * load_content_common diagnostics contract:
 *   - when `diagnostics` is an Array, push { line, raw, reason } and return
 *     null (caller skips the row);
 *   - when `diagnostics` is absent, rethrow the original error (fail loud).
 *
 * @param {Error} err
 * @param {number} line - 1-based line number in the source content
 * @param {string} raw - the raw line text
 * @param {Array<{line:number, raw:string, reason:string}>} [diagnostics]
 * @returns {null}
 * @throws {Error} rethrows err when diagnostics is not an array
 */
function skipOrThrow(err, line, raw, diagnostics) {
    if (!Array.isArray(diagnostics)) {
        throw err;
    }
    diagnostics.push({
        line,
        raw,
        reason: 'parse-error: ' + err.message,
    });
    return null;
}

module.exports = { splitLine, parseMoney, parseDMY, skipOrThrow };
