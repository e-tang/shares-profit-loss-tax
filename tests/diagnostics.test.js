const brokers = require('../brokers');

describe('parse diagnostics', () => {
    const CSV = [
        'Code,Company,Date,Type,Quantity,Unit Price ($),Trade Value ($),Brokerage+GST ($),GST ($),Contract Note,Total Value ($)',
        'BHP,BHP GROUP LIMITED,15/01/2023,BUY,100,40.00,4000.00,19.95,1.81,C123,4019.95',
        'THIS LINE IS GARBAGE AND NOT A TRADE',
        'BHP,BHP GROUP LIMITED,20/03/2024,SELL,100,45.00,4500.00,19.95,1.81,C124,-4480.05',
    ].join('\n');

    test('collects skipped lines when a diagnostics array is provided', () => {
        const diagnostics = [];
        const result = brokers.normalizeData(CSV, 'commsec', { diagnostics });
        // NOTE: `count` counts every data line ATTEMPTED (including skipped/garbage
        // lines), not just successfully parsed transactions -- this matches today's
        // pre-existing observable behavior in load_content_common (verified via
        // scratch check against the after-2023 CommSec format, which already has a
        // null-returning branch). 3 data lines are attempted here: 1 valid, 1
        // garbage, 1 valid.
        expect(result.count).toBe(3);
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0]).toMatchObject({ raw: expect.stringContaining('GARBAGE') });
        expect(typeof diagnostics[0].line).toBe('number');
        expect(diagnostics[0].reason).toBe('not-a-transaction');
    });

    test('no diagnostics option — behavior unchanged', () => {
        const result = brokers.normalizeData(CSV, 'commsec', {});
        expect(result.count).toBe(3);
    });

    test('unrecognized content reports no-data-header-recognized when collector present', () => {
        const diagnostics = [];
        // This content matches CommSec's "Date,Reference," format marker (so the
        // broker-specific format sniff in commsec.js's load_content() does not
        // throw its own "Unknown CommSec format" error before we ever reach
        // load_content_common), but no line ever has enough commas to satisfy
        // is_data_line_started(), so the shared parsing loop in base.js never
        // finds a start line and count stays 0.
        const CSV_NO_START = [
            'Date,Reference,Details',
            'Row1,Row2',
            'Row3,Row4',
        ].join('\n');
        const result = brokers.normalizeData(CSV_NO_START, 'commsec', { diagnostics });
        expect(result.count).toBe(0);
        expect(diagnostics.some((d) => d.reason === 'no-data-header-recognized')).toBe(true);
    });
});
