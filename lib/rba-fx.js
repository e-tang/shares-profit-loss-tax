/**
 * Parse the RBA F11.1 daily exchange-rate CSV and convert USD amounts to AUD.
 * FXRUSD is expressed as units of USD per A$1, so AUD = USD / FXRUSD.
 */

const MONTHS = new Map([
    ['Jan', 0], ['Feb', 1], ['Mar', 2], ['Apr', 3], ['May', 4], ['Jun', 5],
    ['Jul', 6], ['Aug', 7], ['Sep', 8], ['Oct', 9], ['Nov', 10], ['Dec', 11],
]);

function dateKey(date) {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function localDateString(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function parseRbaDate(value) {
    const match = String(value).trim().match(/^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/);
    if (!match || !MONTHS.has(match[2])) {
        return null;
    }
    return new Date(Number(match[3]), MONTHS.get(match[2]), Number(match[1]));
}

class RbaUsdAudRates {
    constructor(content) {
        const lines = String(content).replace(/^\uFEFF/, '').split(/\r?\n/);
        const seriesLine = lines.findIndex(line => line.startsWith('Series ID,'));
        if (seriesLine < 0) {
            throw new Error('RBA exchange-rate CSV has no Series ID row');
        }

        const series = lines[seriesLine].split(',');
        const usdIndex = series.indexOf('FXRUSD');
        if (usdIndex < 0) {
            throw new Error('RBA exchange-rate CSV has no FXRUSD series');
        }

        this.entries = [];
        for (const line of lines.slice(seriesLine + 1)) {
            const fields = line.split(',');
            const date = parseRbaDate(fields[0]);
            const usdPerAud = Number(fields[usdIndex]);
            if (date && Number.isFinite(usdPerAud) && usdPerAud > 0) {
                this.entries.push({ date, dateString: localDateString(date), key: dateKey(date), usdPerAud });
            }
        }
        this.entries.sort((left, right) => left.key - right.key);
        if (this.entries.length === 0) {
            throw new Error('RBA exchange-rate CSV contains no FXRUSD observations');
        }
    }

    rateFor(date) {
        const target = dateKey(date);
        let low = 0;
        let high = this.entries.length - 1;
        let match = null;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const entry = this.entries[middle];
            if (entry.key <= target) {
                match = entry;
                low = middle + 1;
            }
            else {
                high = middle - 1;
            }
        }

        if (!match) {
            throw new Error(`No RBA USD/AUD rate available on or before ${date.toISOString().slice(0, 10)}`);
        }
        return match;
    }

    usdToAud(amount, date) {
        const rate = this.rateFor(date);
        return {
            amount: amount / rate.usdPerAud,
            rate,
        };
    }
}

module.exports = RbaUsdAudRates;
