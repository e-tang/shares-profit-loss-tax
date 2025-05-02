/**
 * Example showing how to use sprolosta as a library
 */

// Import the library
const sprolosta = require('sprolosta');

// Example 1: Process trades from files
function processFilesExample() {
    const results = sprolosta.processTrades(['./data/example-trades.csv'], {
        broker: 'commsec',
        year: 2023,
        details: true,
        symbol: 'CBA,NAB',
        ignore: ['APT']
    });

    // Access results
    console.log(`Processed ${results.symbols_count} symbols`);
    console.log(`First trade: ${results.first_trade}`);
    console.log(`Profit/Loss for 2023-2024: ${results.financial_years['2023-2024'].profit}`);
    
    // Access portfolio information
    results.holdings.forEach(holding => {
        console.log(`${holding.symbol}: ${holding.quantity} shares at $${holding.average_price.toFixed(2)}`);
    });
}

// Example 2: Process trades from CSV string
function processCsvStringExample() {
    const csvString = `
Code,Trade Date,Settlement Date,Type,Description,Quantity,Average Price,Trade Value,Brokerage,GST,Contract Note,Currency
CBA,20/02/2023,22/02/2023,BUY,COMMONWEALTH BANK OF,100,100.00,10000.00,19.95,2.00,CN123456,AUD
CBA,21/05/2023,23/05/2023,SELL,COMMONWEALTH BANK OF,100,105.00,10500.00,19.95,2.00,CN123457,AUD
    `;
    
    const results = sprolosta.processTrades(csvString, {
        broker: 'commsec'
    });
    
    // Calculate profit
    console.log(`Total profit: ${results.holdings[0].profit}`);
    
    // Access financial year data
    Object.entries(results.financial_years).forEach(([year, data]) => {
        console.log(`${year} - Profit: ${data.profit}, Trades: ${data.total_trades}`);
    });
}

// Example 3: Using the models directly
function useModelsExample() {
    const { models } = sprolosta;
    
    // Create a new portfolio
    const portfolio = new models.Portfolio();
    
    // Create a transaction
    const transaction = new models.Transaction();
    transaction.date = new Date();
    transaction.symbol = 'NAB';
    transaction.type = 'buy';
    transaction.quantity = 100;
    transaction.price = 30.50;
    transaction.value = transaction.quantity * transaction.price;
    transaction.fee = 19.95;
    transaction.total = transaction.value + transaction.fee;
    
    console.log(`Created transaction for ${transaction.quantity} shares of ${transaction.symbol}`);
}

// Run the examples
console.log("=== File Processing Example ===");
// processFilesExample(); // Uncomment to run with actual files

console.log("\n=== CSV String Processing Example ===");
processCsvStringExample();

console.log("\n=== Models Example ===");
useModelsExample();