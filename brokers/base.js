function Broker () {
    this.name = "general";
    this.shortsell_allowed = false;
    this.missing_trades = new Map();
}

Broker.prototype.load = function (files, offset) {
    throw new Error("Not implemented");
}

Broker.prototype.calculate_financial_year_profit = function (portfolio, year) {
    let financial_year = new models.FinancialYear();
    financial_year.year = year;
    let total_profit = 0;
    let total_discount = 0;
    let total_trades = 0;
    let total_cost = 0;
    portfolio.holdings.forEach(function (holding) {
        let profits_year = holding.profits.get(year); // the list of profits for the year
        if (profits_year) {
            profits_year.forEach(function (profit) {
                total_profit += profit.profit;
                total_discount += profit.profit_for_discount;
                total_trades += profit.transactions.length;
                total_cost += profit.cost;
            });
        }
    });
    financial_year.profit = total_profit;
    financial_year.profit_discount = total_discount;
    financial_year.total_trades = total_trades;
}

Broker.prototype.calculate_profit = function (holding, transaction, transactions) {

    let profit = new models.Profit();

    /**
     * maybe there are a few ways to calculate the average price
     * 1. change the average price
     * 2. keep the average price
     */
    // let left_cost = holding.cost - transaction.total;
    // holding.average_price = left_cost / holding.quantity;

    let cost = holding.quantity == transaction.quantity ? holding.cost : holding.average_price * transaction.quantity;
    let profit_num = transaction.total - cost;

    profit.quantity = transaction.quantity;
    profit.cost = cost;
    profit.cost_price = holding.average_price;
    profit.close_price = transaction.price;
    profit.profit_price = close_price - cost_price;
    profit.profit = profit_num;

    profit.transactions.push(transaction);

    // now we need to decide whether there is discount for the capital gain
    let acquired_quantity = 0;

    let last_transaction = null;
    while((last_transaction = transactions.pop()) != null) {
        profit.transactions.unshift(last_transaction);

        acquired_quantity += last_transaction.quantity;

        // now check if the asset hold more than 12 months
        // if so, then there is discount for the capital gain
        // worry about the discount only if there is profit
        if (profit_num > 0) {
            let year = last_transaction.date.getFullYear();
            let close_year = transaction.date.getFullYear();
            if (year != close_year) {
                let month = last_transaction.date.getMonth();
                let close_month = transaction.date.getMonth();
                if (month <= close_month) {
                    let day = last_transaction.date.getDate();
                    let close_day = transaction.date.getDate();

                    if (day < close_day) {
                        // the asset is hold more than 12 months
                        profit.discount_eligible = true;
                        profit.discount_quantity += last_transaction.quantity;
                    }
                }
            }
        }

        if (acquired_quantity >= transaction.quantity) {
            profit.year_init = last_transaction.date;
            profit.year_close = transaction.date;

            if (acquired_quantity > transaction.quantity) {
                // the last transaction is not fully used
                // so we need to put it back to the stack
                last_transaction.quantity = acquired_quantity - transaction.quantity;
                transactions.push(last_transaction);
            }
            break;
        }

    }

    // now decide which financial year the transaction belongs to
    let year = transaction.date.getFullYear();
    let start = new Date(year, 6, 1);
    // let end = new Date(year + 1, 5, 30);
    let financial_year = (transaction.date >= start) ? year : year - 1;
    let profits_year = holding.profits.get(financial_year);
    if (profits_year == null) {
        profits_year = [];
        holding.profits.set(financial_year, profits_year);
    }
    profits_year.push(profit);

    holding.profit += profit_num;

    if (holding.average_close == 0)
        holding.average_close = transaction.price;
    else
        holding.average_close = (holding.average_close + transaction.price) / 2;

    // return profit;
}

Broker.prototype.update_holding = function (portfolio, symbol, trades) {
    if (!trades || trades.length == 0) {
        console.log("No trades to update");
        return;
    }

    let transactions = [];

    // Update portfolio
    let holding = null;
    // let symbol = trades[0].symbol;
    if (portfolio.holdings.has(transaction.symbol)) {
        holding = portfolio.holdings.get(transaction.symbol);
    }
    else {
        holding = new models.Holding();
        holding.symbol = transaction.symbol;
        holding.company = transaction.company;
        portfolio.holdings.set(transaction.symbol, holding);
    }

    let last_transaction = null;
    let last_trade_index = -1;
    for (let i = 0; i < trades.length; i++)
    {
        let transaction = trades[i];
        transactions.push(transaction);

        if (transaction.type == "buy") {
            if (holding.quantity == 0) {
                holding.average_price = holding.cost / holding.quantity;
            }
            else if (holding.quantity > 0)
                holding.average_price = (holding.cost + transaction.total) / (holding.quantity + transaction.quantity);
            else {
                // @todo: handle this case
            }
            holding.quantity += transaction.quantity;
            holding.cost += transaction.total;                        
        }
        else if (transaction.type == "sell") {
            if (holding.quantity == 0) {
                // todo : handle this case
                // short selling, initialise a new position
            }
            else if (holding.quantity > 0) {
                this.calculate_profit(holding, transaction, transactions, last_trade_index);
            }
            else {
                // short selling, increase the position
                // the profit is the negative of the cost
                // holding.profit = -holding.cost;
            }

            holding.quantity -= transaction.quantity;
            holding.cost -= transaction.total;

            // if (holding.quantity == 0) {
            //     holding.average_price = 0;
            //     holding.cost = 0;
            //     holding.average_close = 0;
            // }
        }
        else {
            console.error("Unknown transaction type: " + transaction.type);
            process.exit(1);
        }

        last_transaction = transaction;
    }
}

module.exports = Broker;