function Transaction() {
    this.id = 0;
    this.date = new Date();
  
    this.type = "";
    this.description = "";
    this.category = "";

    this.symbol = undefined;
    this.company = undefined;
    this.quantity = 0;
    this.price = 0;
    this.value = 0; // trade value = quantity * price
    this.total = 0; // total value = trade value + fee 
    this.fee = 0;   // fee = commission + gst
    this.gst = 0;

    this.note = "";
}

function Trades() {
    this.symbols = new Map();
    this.years = new Set();
    this.first = null;
    this.last = null;
}

function Portfolio() {
    this.symbols = new Map();  // symbol -> Holding
    this.value = 0;            // total market value
    this.cost = 0;             // total cost
}

function Holding() {
    this.symbol = undefined;
    this.company = undefined;
    this.quantity = 0;
    this.average_price = 0;
    this.average_close = 0;    // average price of all closed trades
    this.value = 0;            // the latest close price
    this.cost = 0;
    this.profit = 0;
    this.profit_percent = 0;
    this.note = "";
}

module.exports = {
    Transaction: Transaction,
    Trades: Trades,
    Portfolio: Portfolio,
    Holding: Holding
}