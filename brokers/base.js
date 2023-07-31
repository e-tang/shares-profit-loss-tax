function Broker () {
    this.name = "general"
}

Broker.prototype.load = function (files, offset) {
    throw new Error("Not implemented");
}

Broker.prototype.update_holdings = (portfolio, trades) {
    // Update portfolio
    let holding = null;
    if (options.portfolio.symbols.has(transaction.symbol)) {
        holding = options.portfolio.symbols.get(transaction.symbol);
    }
    else {
        holding = new models.Holding();
        holding.symbol = transaction.symbol;
        holding.company = transaction.company;
        options.portfolio.symbols.set(transaction.symbol, holding);
    }

    {
        if (transaction.type == "buy") {
            if (holding.quantity == 0)
                holding.average_price = holding.cost / holding.quantity;
            else
                holding.average_price = (holding.cost + transaction.total) / (holding.quantity + transaction.quantity);
            holding.quantity += transaction.quantity;
            holding.cost += transaction.total;                        
        }
        else if (transaction.type == "sell") {
            holding.quantity -= transaction.quantity;
            holding.cost -= transaction.total;
            if (holding.quantity > 0) {
                /**
                 * maybe there are a few ways to calculate the average price
                 * 1. change the average price
                 * 2. keep the average price
                 */
                // let left_cost = holding.cost - transaction.total;
                // holding.average_price = left_cost / holding.quantity;
                let cost = holding.average_price * transaction.quantity;
                let profit = transaction.total - cost;
                holding.profit += profit;

                if (holding.average_close == 0)
                    holding.average_close = transaction.price;
                else
                    holding.average_close = (holding.average_close + transaction.price) / 2;
            }
            else {
                // the profit is the negative of the cost
                holding.profit = -holding.cost;
            }

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
    }
}

module.exports = Broker;