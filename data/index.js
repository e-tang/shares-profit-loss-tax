let cos_data = require('./cos.json');

function parse_cos_data(cos_data) {
    let cos_data_map = new Map();
    let symbols = Object.keys(cos_data);
    for (let symbol of symbols) {
        let cos = cos_data[symbol];
        let cos_array = null;

        if (!Array.isArray(cos)) {
            cos_array = [cos];
        }
        else {
            cos_array = cos;
        }

        for (let cos_item of cos_array) {
            cos_item.date = new Date(cos_item.date);
        }

        cos_array.sort((a, b) => {
            if (a.date < b.date)
                return -1;
            else if (a.date > b.date)
                return 1;
            else
                return 0;
        });

        cos_data_map.set(symbol, cos_array);
    }
    return cos_data_map;
}

function get_cos(symbol, date, last_cos) {

    let cos_array = this.cos_data.get(symbol);
    if (!cos_array)
        return null;

    // for (let cos_item of cos_array) {
    //     if (cos_item.date >= date)
    //         return cos_item;
    // }
    for (let i = 0; i < cos_array.length; i++) {
        let cos_item = cos_array[i];
        let cos_date = cos_item.date;

        let next_cos_date = cos_array[i + 1] ? cos_array[i + 1].date : null;
        if (!next_cos_date) {
            if (last_cos)
                return last_cos < cos_date && cos_date < date ? cos_item : null;
            return cos_date < date ? cos_item : null;
        }
        else if (cos_date < date && date < next_cos_date) {
            return cos_item;
        }
    }

    return null;
}

let cos_obj = {
    cos_data: parse_cos_data(cos_data),
}

module.exports = {
    cos_data: cos_obj,
    get_cos: get_cos.bind(cos_obj),
    // other data
}