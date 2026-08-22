const fs = require('fs');
const path = require('path');

const sprolosta = require('../lib');
const brokers = require('../brokers');
const Pepperstone = require('../brokers/pepperstone');
const models = require('../lib/models');
const { xlsxBufferToCsv } = require('../lib/xlsx');

const fixture = path.join(__dirname, 'test-data', 'mock-pepperstone.csv');

function storedZip(entries) {
    const locals = [];
    const central = [];
    let offset = 0;
    for (const [name, value] of Object.entries(entries)) {
        const filename = Buffer.from(name);
        const data = Buffer.from(value);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(filename.length, 26);
        locals.push(local, filename, data);

        const directory = Buffer.alloc(46);
        directory.writeUInt32LE(0x02014b50, 0);
        directory.writeUInt16LE(20, 4);
        directory.writeUInt16LE(20, 6);
        directory.writeUInt32LE(data.length, 20);
        directory.writeUInt32LE(data.length, 24);
        directory.writeUInt16LE(filename.length, 28);
        directory.writeUInt32LE(offset, 42);
        central.push(directory, filename);
        offset += local.length + filename.length + data.length;
    }
    const centralData = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(entries).length, 8);
    end.writeUInt16LE(Object.keys(entries).length, 10);
    end.writeUInt32LE(centralData.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, centralData, end]);
}

describe('Pepperstone cTrader broker', () => {
    test('identifies and parses Net AUD closed positions', () => {
        const content = fs.readFileSync(fixture, 'utf8');
        expect(brokers.identifyBroker(content)).toBe('pepperstone');

        const parsed = new Pepperstone().load_content(
            new models.Trades(), content, { index: 0, offset: 0 }
        );
        const transaction = parsed.trades.symbols.get('XAUUSD')[0];
        expect(transaction.net_profit).toBe(2.12);
        expect(transaction.date_close.getMilliseconds()).toBe(517);
        expect(transaction.currency).toBe('AUD');
        expect(transaction.note).toBe('manual,workstation');
    });

    test('calculates FY result from broker-reported Net AUD', () => {
        const results = sprolosta.processTrades([fixture], {
            broker: 'pepperstone', save: false, year: 2025
        });
        const year = results.financial_years['2025-2026'];
        expect(year.profit).toBeCloseTo(22.53, 10);
        expect(year.total_profit_gain).toBeCloseTo(24.12, 10);
        expect(year.total_profit_loss).toBe(-1.59);
        expect(year.closed_positions).toBe(3);
        expect(year.reporting_currency).toBe('AUD');
        expect(year.broker_reported_net).toBe(true);
        expect(year.profit_discount).toBe(0);
    });

    test('reads shared-string XLSX worksheets without an external dependency', () => {
        const strings = ['ID', 'Order ID'];
        const workbook = storedZip({
            'xl/sharedStrings.xml': `<sst>${strings.map(value => `<si><t>${value}</t></si>`).join('')}</sst>`,
            'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>123</v></c><c r="B2" t="inlineStr"><is><t>OID1</t></is></c></row></sheetData></worksheet>'
        });
        expect(xlsxBufferToCsv(workbook)).toBe('ID,Order ID\n123,OID1');
    });
});
