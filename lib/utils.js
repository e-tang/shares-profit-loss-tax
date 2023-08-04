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

module.exports = new Utils();