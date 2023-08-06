function Utils() {
  this.name = 'utils';
}

Utils.prototype.get_financial_year = function (date) {
    let year = date.getFullYear();
    // let start = new Date(year, 6, 1);
    let start = new Date(year - 1, 6, 1);
    let end = new Date(year, 5, 30);
    return (date >= start && date <= end) ? year - 1 : year;
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

module.exports = new Utils();