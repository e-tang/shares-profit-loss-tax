const zlib = require('zlib');

const MAX_ENTRY_SIZE = 50 * 1024 * 1024;

function decodeXml(value) {
    return String(value)
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function unzipEntries(buffer) {
    let end = -1;
    const minimum = Math.max(0, buffer.length - 65557);
    for (let offset = buffer.length - 22; offset >= minimum; offset--) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
            end = offset;
            break;
        }
    }
    if (end < 0) throw new Error('Invalid XLSX: ZIP directory not found');

    const entryCount = buffer.readUInt16LE(end + 10);
    let offset = buffer.readUInt32LE(end + 16);
    const entries = new Map();
    for (let i = 0; i < entryCount; i++) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error('Invalid XLSX: corrupt ZIP directory');
        }
        const flags = buffer.readUInt16LE(offset + 8);
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');

        if ((flags & 1) !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
            throw new Error('Unsupported encrypted or ZIP64 XLSX entry');
        }
        if (uncompressedSize > MAX_ENTRY_SIZE || compressedSize > MAX_ENTRY_SIZE) {
            throw new Error(`XLSX entry is too large: ${name}`);
        }
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
            throw new Error('Invalid XLSX: corrupt ZIP entry');
        }
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
        let data;
        if (method === 0) data = compressed;
        else if (method === 8) data = zlib.inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_SIZE });
        else throw new Error(`Unsupported XLSX compression method ${method}`);
        if (data.length !== uncompressedSize) throw new Error(`Invalid XLSX entry size: ${name}`);
        entries.set(name, data.toString('utf8').replace(/^\uFEFF/, ''));
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function parseSharedStrings(xml = '') {
    const values = [];
    for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
        values.push(Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
            .map(part => decodeXml(part[1])).join(''));
    }
    return values;
}

function columnIndex(reference) {
    const letters = String(reference).match(/^[A-Z]+/i);
    if (!letters) return 0;
    return Array.from(letters[0].toUpperCase()).reduce(
        (value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0
    ) - 1;
}

function parseWorksheet(xml, sharedStrings) {
    const rows = [];
    for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const row = [];
        for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
            const attributes = cellMatch[1];
            const body = cellMatch[2];
            const ref = attributes.match(/\br="([^"]+)"/);
            const type = attributes.match(/\bt="([^"]+)"/);
            const value = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
            const inline = body.match(/<is\b[^>]*>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
            let decoded = value ? decodeXml(value[1]) : (inline ? decodeXml(inline[1]) : '');
            if (type && type[1] === 's') decoded = sharedStrings[Number(decoded)] ?? '';
            row[ref ? columnIndex(ref[1]) : row.length] = decoded;
        }
        rows.push(row.map(value => value ?? ''));
    }
    return rows;
}

function csvField(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function xlsxBufferToCsv(buffer) {
    const entries = unzipEntries(buffer);
    const worksheetName = Array.from(entries.keys())
        .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
    if (!worksheetName) throw new Error('Invalid XLSX: worksheet not found');
    const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml'));
    return parseWorksheet(entries.get(worksheetName), sharedStrings)
        .map(row => row.map(csvField).join(','))
        .join('\n');
}

module.exports = { xlsxBufferToCsv };
