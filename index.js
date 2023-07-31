const Params = require('node-programmer/params');
const brokers = require('./brokers');

var params = new Params({
    "broker": "default",
});

var opts = params.getOpts();
// var optCount = params.geOptCount();

let broker = brokers[opts.broker];
var input = opts['---'];
let trades = broker.load(input);

console.log("Total symbols traded: " + trades.symbols.size);
console.log("First trade: " + trades.first);
console.log("Last trade: " + trades.last);
console.log("Years traded: " + trades.years.size);

let years_array = Array.from(trades.years);
let symbols_array = Array.from(trades.symbols.keys());

years_array.sort();

/**
 * Only Long trade for now   
 */
symbols_array.forEach(function (symbol) {
    let transactions = trades.symbols.get(symbol);

    // we may need to go back to the previous year to get the opening trade

    years_array.forEach(function (year) {
        console.log("Computing profit / loss for financial year: " + year);
    
        let start = new Date(year, 6, 1);
        let end = new Date(year + 1, 5, 30);
    
    
        
    });
});



