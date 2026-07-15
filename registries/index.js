/**
 * @file index.js
 *
 * Copyright (c) 2026 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * Entry point for share-registry (Computershare, MUFG/Link Market Services)
 * dividend/payment-history statement parsing.
 *
 * Registries are a NEW, deliberately small family, separate from brokers/
 * (see registries/base.js for why). Each registry module exports:
 *   { name: string,
 *     matches(headerLine: string): boolean,
 *     rowToRecord(fields: string[], collectorPushFn: (reason: string) => void):
 *       Object|null }
 * `matches` must be an EXACT header-prefix match (never a loose substring
 * heuristic) so one registry's file is never misclassified as another's --
 * same honesty constraint as brokers/selfwealth.js.
 */

const Computershare = require('./computershare');
const MUFG = require('./mufg');
const { splitLine, skipOrThrow } = require('./base');

const REGISTRIES = [Computershare, MUFG];

/**
 * Parse a registry (Computershare / MUFG) dividend/payment-history CSV
 * statement into dividend records feeding the app's Dividend entities.
 *
 * Detection: scans lines for the first one that exactly matches a known
 * registry's header (via that registry's `matches`); the registry is fixed
 * for the rest of the file from that point. If no line matches any known
 * registry, throws "Unrecognized registry format" -- callers should route
 * that failure into the app's failed-import → support funnel, per the
 * honesty constraint documented in registries/computershare.js and
 * registries/mufg.js.
 *
 * Per-row diagnostics contract (mirrors brokers/base.js#load_content_common):
 *   - a row whose registry-specific "is this a dividend?" check fails (e.g.
 *     a DRP allotment note, not a cash payment) is skipped and, when
 *     `options.diagnostics` is an Array, recorded as
 *     { line, raw, reason: 'not-a-dividend' };
 *   - a row with malformed numeric/date fields is skipped and recorded as
 *     { line, raw, reason: 'parse-error: <message>' } when
 *     `options.diagnostics` is an Array;
 *   - when `options.diagnostics` is ABSENT, either failure above throws
 *     instead of being silently skipped (fail-loud legacy behavior, same as
 *     the broker family).
 * `line` numbers are 1-based, counted from the start of `csv`.
 *
 * @param {string} csv - raw statement content
 * @param {Object} [options]
 * @param {Array<{line:number, raw:string, reason:string}>} [options.diagnostics]
 *   When present, per-row failures are collected here instead of throwing.
 * @returns {{records: Array<{symbol:string, payDate:string, totalAmount:number,
 *   frankedPortion:number, frankingCredits:number, source:string}>,
 *   registry: string}} `records[].payDate` is an ISO "YYYY-MM-DD" string
 *   (see registries/base.js#parseDMY for why it's never produced via
 *   Date#toISOString()). `registry` is the matched registry's `name`.
 * @throws {Error} "Unrecognized registry format" when no header line
 *   matches a known registry; also throws on the first malformed/invalid
 *   data row when `options.diagnostics` is absent.
 */
function parseStatement(csv, options) {
    options = options || {};
    const diagnostics = options.diagnostics;

    const lines = String(csv).split('\n');

    let registry = null;
    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const found = REGISTRIES.find((r) => r.matches(lines[i]));
        if (found) {
            registry = found;
            headerLineIndex = i;
            break;
        }
    }

    if (!registry) {
        throw new Error('Unrecognized registry format');
    }

    const records = [];

    for (let j = headerLineIndex + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim().length === 0) {
            // blank line ends the data block, same convention as
            // brokers/base.js#is_data_line_ended
            break;
        }

        const fields = splitLine(line);

        try {
            const record = registry.rowToRecord(fields, (reason) => {
                if (Array.isArray(diagnostics)) {
                    diagnostics.push({ line: j + 1, raw: line, reason });
                }
            });
            if (record) {
                records.push(record);
            }
        } catch (e) {
            skipOrThrow(e, j + 1, line, diagnostics);
        }
    }

    return { records, registry: registry.name };
}

module.exports = { parseStatement, REGISTRIES };
