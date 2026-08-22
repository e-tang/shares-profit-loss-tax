/** Parse one RFC 4180-style CSV record (broker fields never contain newlines). */
function parseCsvLine(line) {
    const fields = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (quoted) {
            if (char === '"' && line[i + 1] === '"') {
                field += '"';
                i++;
            }
            else if (char === '"') {
                quoted = false;
            }
            else {
                field += char;
            }
        }
        else if (char === '"' && field.length === 0) {
            quoted = true;
        }
        else if (char === ',') {
            fields.push(field);
            field = '';
        }
        else {
            field += char;
        }
    }
    if (quoted) throw new Error('Unterminated quoted CSV field');
    fields.push(field);
    return fields;
}

module.exports = { parseCsvLine };
