function Utils() {
  this.name = 'utils';
}

Utils.prototype.get_financial_year = function (date) {
    const year = date.getFullYear();
    return date.getMonth() >= 6 ? year : year - 1;
}

/**
 * Turn "01/01/2019" into a Date object
 * the second parameter is the separator, default is "/"
 * the middle digits are month, the first two digits are day, the last four digits are year
 * 
 * @param {*} year 
 */
Utils.prototype.to_date = function (year, separator) {
    if (separator == undefined) {
        separator = "/";
    }

    let tokens = year.split(separator);
    return new Date(tokens[2], tokens[1] - 1, tokens[0]);
}

Utils.prototype.parse_date = function (date) {
    if (date.indexOf("/") >= 0) {
        let tokens = date.split("/");
        if (tokens.length != 3) {
            throw new Error("Invalid date format: " + date);
        }
        let year = parseInt(tokens[2]);
        let month = parseInt(tokens[1]) - 1;
        let day = parseInt(tokens[0]);
        return new Date(year, month, day);
    }
    return new Date(date);
}

module.exports = new Utils();
