# shares-profit-loss-tax
Shares PROfit / LOSs TAx (SPROLOSTA or sprolosta) is a profit / loss calculator for trading. Although it is initially designed to help Australian stock traders calculate their profit and loss for tax purposes, specifically for the Australian financial year (July 1 to June 30), it can be used by traders in other countries as well.

It is coded in nodejs and can be used for computing the profit / loss of stock trading for each financial year. And the profit for any assets that are held more than 12 months is entitled to a 50% discount.

## Australian Taxation Office (ATO) rules
The ATO rules for calculating the profit / loss of stock trading are as follows:
- The profit / loss is calculated for each financial year
- The profit / loss is calculated by summing the profit / loss of each stock trade
- The profit / loss of each stock trade is calculated by subtracting the buy price from the sell price

Any assets held more than 12 months are entitled to a 50% discount on the profit / loss.

## Supported Brokers
- CommSec
- FP Markets

As the author only has accounts with these two brokers, only these two brokers are supported at the moment. However, the author is happy to accept pull requests for other brokers.

## Installation and Usage

### Installation

As a command-line tool:
```bash
npm install -g sprolosta
```

As a library in your project:
```bash
npm install sprolosta
```

### Command-line Usage

#### Split and Consolidation of Shares

If you have shares that have been split or consolidated, you will need to adjust the transactions manually.

```bash
sprolosta <--broker broker> <--symbol symbol1,symbol2,..> <--ignore symbol1,symbol2> <csv file>
```

#### Example 1

```bash
sprolosta --broker commsec Transactions_2540927_01072022_30062023.csv
```

#### Example 2 - Multiple CSV Files

```bash
sprolosta --broker fpmarkets 2020.csv 2021.csv 2022.csv 2023.csv
```

#### Example 3 - Check Only a Few Symbols

```bash
sprolosta --broker fpmarkets --symbol AKE,MP1,VSR 2020.csv 2021.csv 2022.csv 2023.csv
```

#### Example 4 - Ignore a Few Symbols

```bash
sprolosta --broker fpmarkets --ignore BMN 2020.csv 2021.csv 2022.csv 2023.csv
```

### Library Usage

You can also use SPROLOSTA as a library in your Node.js applications:

```javascript
const sprolosta = require('sprolosta');

// Process from files
const results = sprolosta.processTrades(['transactions.csv'], {
  broker: 'commsec',
  symbol: 'CBA,NAB',
  ignore: ['APT']
});

// Or from a CSV string
const csvString = `
Code,Trade Date,Settlement Date,Type,Description,Quantity,Average Price,Trade Value,Brokerage,GST,Contract Note,Currency
CBA,20/02/2023,22/02/2023,BUY,COMMONWEALTH BANK OF,100,100.00,10000.00,19.95,2.00,CN123456,AUD
CBA,21/05/2023,23/05/2023,SELL,COMMONWEALTH BANK OF,100,105.00,10500.00,19.95,2.00,CN123457,AUD
`;

const results = sprolosta.processTrades(csvString, {
  broker: 'commsec'
});

// Access results
console.log(`Total profit: ${results.holdings[0].profit}`);
```

See the `/examples` directory for more detailed usage examples.

## Disclaimer

- The author of this project is not responsible for any loss or damage caused by the use of this project.

- Always consult a professional tax accountant for your tax matters.

## Donation
If you find this project useful, please consider donating to the author.

Bitcoin: TSvSd6BMhVYKWJWainRvtzaDH6usPBYW4p

## Maintainer

[Eric Tang](https://twitter.com/_e_tang) @ [TYO Lab](http://tyo.com.au)


