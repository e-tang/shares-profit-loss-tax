# shares-profit-loss-tax
Shares PROfit / LOSs TAx (SPROLOSTA or sprolosta) is a profit / loss calculator for stock trading in Australia.

It is coded in nodejs and can be used for computeing the profit / loss of stock trading for each financial year. And the profit for any assets that are held more than 12 months is entitled to a 50% discount.

## Australian Taxation Office (ATO) rules
The ATO rules for calculating the profit / loss of stock trading are as follows:
- The profit / loss is calculated for each financial year
- The profit / loss is calculated by summing the profit / loss of each stock trade
- The profit / loss of each stock trade is calculated by subtracting the buy price from the sell price

Any assets hold more than 12 months are entitled to a 50% discount on the profit / loss.

## Supported Brokers
- CommSec
- FP Markets

As the author only has accounts with these two brokers, only these two brokers are supported at the moment. However, the author is happy to accept pull requests for other brokers.

## Installation and Usage

### Installation
```bash
```bash
npm install -g sprolosta
```

### Usage
```bash
sprolosta <--broker broker> <csv file>
```
## Disclaimer

- The author of this project is not responsible for any loss or damage caused by the use of this project.

- Always consult a professional tax accountant for your tax matters.

## Donation
If you find this project useful, please consider donating to the author.

Bitcoin: TSvSd6BMhVYKWJWainRvtzaDH6usPBYW4p

## Maintainer

[Eric Tang](https://twitter.com/_e_tang) @ [TYO Lab](http://tyo.com.au)


