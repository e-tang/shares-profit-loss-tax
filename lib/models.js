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
    this.value = 0;           // trade value = quantity * price
    this.total = 0;           // total value = trade value + fee 
    this.fee = 0;             // fee = commission + gst
    this.gst = 0;

    this.note = "";

    this.count = 1;           // transaction count, yes, normally it is 1, but for merged transactions, it is > 1

    this.copy = function () {
        let copy = new Transaction();
        copy.id = this.id;
        copy.date = this.date;
        copy.type = this.type;
        copy.description = this.description;
        copy.category = this.category;
        copy.symbol = this.symbol;
        copy.company = this.company;
        copy.quantity = this.quantity;
        copy.price = this.price;
        copy.value = this.value;
        copy.total = this.total;
        copy.fee = this.fee;
        copy.gst = this.gst;
        copy.note = this.note;

        return copy;
    }
}

function Trades() {
    this.symbols = new Map();
    this.years = new Set();
    this.first = null;
    this.last = null;
}

function Portfolio() {
    this.holdings = new Map();              // Holdings
    this.value = 0;                         // total market value
    this.cost = 0;                          // total cost
    this.profit = 0;                        // overall profit
    this.profits = new Map();               // year -> profit, for each financial year
}

function Profit() {
    this.year_init = 0;                     // the year when the holding is first bought
    this.year_close = 0;                    // the year when the holding is last closed
    this.quantity = 0;                      // the quantity of the holding involved in the round-trip trade
    this.cost = 0;                          // the cost of the holding involved in the round-trip trade
    this.cost_price = 0;                    // the average cost price of the holding involved in the round-trip trade
    this.close_price = 0;                   // the average close price of the holding involved in the round-trip trade
    this.profit = 0;                        // overall profit
    // this.profit_gain = 0;                   // profit that is positive
    // this.profit_loss = 0;                   // profit that is negative
    this.profit_for_discount = 0;                   // discount for long term capital gain
    this.discount_eligible = false;
                                            // discount_eligible = true if the holding period is more than 12 months
    this.discount_quantity = 0;             // the quantity of the holding involved in the round-trip trade that is eligible for discount
    this.transactions = [];                 // list of transactions for the round-trip trade
    this.transactions_stack;                // stack of unclosed transactions
}

function Holding() {
    this.symbol = undefined;
    this.company = undefined;
    this.quantity = 0;
    this.average_price = 0;
    this.average_close = 0;                 // average price of all closed trades
    this.value = 0;                         // 
    this.cost = 0;
    this.profit = 0;                        // overall profit
    this.profits = new Map();               // year -> Profit[], for each financial year
    this.profit_percent = 0;
    this.note = "";
    this.date_init = null;                  // the date when the holding is first bought
    this.date_close = null;                 // the date when the holding is last closed
    this.transaction_init = null;           // the transaction when the holding is first bought
    this.transaction_close = null;          // the transaction when the holding is last closed
    this.trade_values = new Map();          // year -> TradeValue, for each financial year
}

function FinancialYear() {
    this.year = 0;
    this.cost = 0;
    this.profit = 0;
    this.profit_discount = 0;               // the amount of profit that is eligible for discount for long term capital gain
    this.total_trades = 0;                  // total number of trades / transactions

}

function TradeValue() {
    this.buy = 0;
    this.sell = 0;
    this.year = 0;
    this.transactions = [];
}

function Trade() {
    this.symbol = undefined;
    this.cost_price = 0;
    this.close_price = 0;
    this.quantity = 0;
    this.profit = 0;

    this.toString = function() {
        if (this.symbol == undefined)
            return "";
        return this.symbol + " (" + this.quantity + "): open @" + this.cost_price + ", close @" + this.close_price + ", profit: " + this.profit.toFixed(2);
    }
}

module.exports = {
    Transaction: Transaction,
    Trades: Trades,
    Portfolio: Portfolio,
    Holding: Holding,
    Profit: Profit,
    FinancialYear: FinancialYear,
    TradeValue: TradeValue,
    Trade: Trade
}