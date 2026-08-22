# SPROLOSTA

Shares PROfit / LOSs TAx (`sprolosta`) is a Node.js command-line tool and library for calculating realised trading profit and loss by Australian financial year (1 July to 30 June). It supports CommSec, FP Markets, Binance closed-pair calculations, and column-mapped generic CSV exports.

The calculator groups transactions by symbol, sorts them chronologically, maintains an average cost for each open position, assigns realised results to the financial year in which a position is closed, and separately reports profitable amounts it considers eligible for the 12-month CGT discount.

> **Important:** This tool is an aid, not tax advice or a tax-lot election system. Check its input, output, cost-base treatment, and CGT-discount treatment with a qualified tax professional before preparing a return.

## Supported brokers and input formats

### CommSec

Both formats currently produced by CommSec parsers are supported:

- Transaction-search CSV beginning with `Code,Company,Date,Type,Quantity,...`
- Cash-transaction CSV beginning with `Date,Reference,Details,Debit($),Credit($),Balance($)`

CommSec can normally be detected from the header, so `--broker commsec` is optional when the first input file has one of those headers.

### FP Markets

Two FP Markets formats are supported.

The legacy share-transaction header begins with:

```text
ID,Date,Time,Account Code,Buy or Sell,Currency,Exchange,Stock,Volume,Price,Value
```

Legacy share prices are interpreted as cents and divided by 100 by the broker adapter.

The cTrader closed-position header begins with:

```text
ID,Open Time,Close Time,Account Code,Buy or Sell,Currency,Stock,Volume,Open Price,Close Price,Commission,Swaps,Profit
```

Each cTrader row is treated as one already-closed position. Its realised result is calculated from the broker-reported values:

```text
Net P/L = Profit + Commission + Swaps
```

The result belongs to the financial year containing `Close Time`. Decimal CFD volumes are supported. Closed CFD positions are not placed in the share CGT-discount bucket, even when the opening date is more than 12 months earlier.

### Binance

Binance transaction-history exports beginning with this header are supported:

```text
User ID,Time,Account,Operation,Coin,Change,Remark
```

The Binance adapter reconstructs complete round trips quoted in USDT from
`Transaction Buy`, `Transaction Spend`, `Transaction Sold`, `Transaction
Revenue`, `Transaction Fee`, and paired `Binance Convert` ledger rows. Fees in
the traded asset or USDT are folded into the paired result.

Deposits, withdrawals, and transfers between Binance wallets are ignored.
Cross-crypto conversions without a USDT leg are not valued: received inventory
is marked unknown, and its share of a later disposal is excluded. This prevents
missing funding or an unpriced crypto deposit from being treated as zero-cost
profit.

Without an FX file, Binance results are reported in **USDT**. For an Australian
tax worksheet, pass the RBA F11.1 daily exchange-rate CSV with `--fx-rates`.
SPROLOSTA then converts every matched acquisition cost and disposal proceeds
separately using `AUD = USDT / FXRUSD`. It uses the latest published observation
on or before the transaction date, which covers weekends and RBA holidays.
This method treats 1 USDT as 1 USD and records both the AUD calculation and its
USDT reconciliation. Binance results are never placed in the share CGT-discount
bucket.

### Other brokers and generic CSV files

Use `--broker any` and provide zero-based column indexes. The required logical columns are symbol, date, quantity, price, and type. In practice, a total/settlement column should also be supplied so the calculator can establish a correct opening cost.

For example:

```text
Symbol,Date,Quantity,Price,Type,Total
CBA,15/02/2023,100,100.00,buy,10000.00
CBA,15/05/2023,100,105.00,sell,10500.00
```

Dates containing `/` are parsed as `DD/MM/YYYY`. Type may be `buy`, `sell`, `b`, or `s`, case-insensitively. Generic files currently need at least six comma-separated fields per line.

## Installation

Install the published command globally:

```bash
npm install -g sprolosta
```

Or install it as a project dependency:

```bash
npm install sprolosta
```

To run a source checkout:

```bash
npm install
node cli.js --broker commsec --save false transactions.csv
```

## Command-line usage

```text
sprolosta [options] <csv-file> [additional-csv-files...]
```

When working in a source checkout, replace `sprolosta` with `node cli.js`.

### CommSec

```bash
sprolosta --broker commsec --save false Transactions_01072022_30062023.csv
```

Broker auto-detection also works for recognised CommSec headers:

```bash
sprolosta --save false Transactions_01072022_30062023.csv
```

### FP Markets and multiple files

```bash
sprolosta --broker fpmarkets --save false 2022.csv 2023.csv 2024.csv
```

For a cTrader closed-position export:

```bash
sprolosta --broker fpmarkets --save false --year 2025 FPMarkets_2025-2026.csv
```

The files do not need to be passed chronologically; transactions are sorted by date within each symbol. Do not supply overlapping exports unless duplicate transactions have been removed, because the tool does not deduplicate them.

### Binance transaction history

```bash
sprolosta \
  --broker binance \
  --save false \
  --year 2025 \
  --fx-rates RBA-F11.1-data.csv \
  Binance-Transaction-History.csv
```

`--year 2025` selects the 2025–2026 Australian financial year. When Binance
produces several `partN-ofN` files, pass every non-overlapping part to the same
command. Parts may be passed in any order because ledger rows are sorted before
pair reconstruction.

Download the RBA `Exchange Rates – Daily – 2023 to Current` F11.1 CSV from the
[RBA historical data page](https://www.rba.gov.au/statistics/historical-data.html).
Keep the exact source file or a documented subset of every observation used
with the calculation records.

### Selected symbols

```bash
sprolosta --broker fpmarkets --save false --symbol AKE,MP1,VSR 2022.csv 2023.csv
```

### Ignore a symbol

```bash
sprolosta --broker fpmarkets --save false --ignore BMN 2022.csv 2023.csv
```

The CLI reliably accepts one `--ignore` value. Library callers can pass an array to ignore multiple symbols.

### Selected financial year

```bash
sprolosta --broker commsec --save false --year 2023 transactions.csv
```

`--year 2023` selects the `2023-2024` Australian financial year. It does not limit input parsing, so include all earlier transactions needed to establish the cost of positions sold in the requested year.

### Detailed calculation output

```bash
sprolosta --broker commsec --save false --details true transactions.csv
```

### Generic CSV

For the six-column example above, where prices and totals are already expressed in dollars:

```bash
sprolosta \
  --broker any \
  --save false \
  --col-symbol 0 \
  --col-date 1 \
  --col-quantity 2 \
  --col-price 3 \
  --col-type 4 \
  --col-total 5 \
  --price-unit 1 \
  transactions.csv
```

The CLI default for `--price-unit` is `0.01`, suitable for a price column expressed in cents. Use `--price-unit 1` for dollar prices.

Optional generic mappings are:

- `--col-commission`
- `--col-fees`
- `--col-tax`
- `--col-exchange`
- `--col-currency`

Commission, fee, and tax columns are parsed but are not currently added to `total` automatically. Supply a `--col-total` value that already represents the amount the calculation should use.

## Common options

| Option | Default | Meaning |
| --- | --- | --- |
| `--broker` | auto-detect/any | `commsec`, `fpmarkets`, `binance`, or `any` |
| `--save` | `true` in the CLI | Write the calculated portfolio JSON |
| `--portfolio-file` | `portfolio.json` | Portfolio output path used by `--save` |
| `--year` | all | Starting year of the Australian financial year |
| `--fx-rates` | none | RBA F11.1 CSV used to convert Binance USDT legs to AUD |
| `--details` | `false` | Print per-symbol calculation details |
| `--symbol` | all | Comma-separated symbols to include |
| `--ignore` | none | Symbol to skip |
| `--adjust-transaction` | `true` | Convert sells to negative quantities/values |
| `--price-unit` | `0.01` in the CLI | Multiplier for generic price values |
| `--sort-by` | `pl` | Sort symbol output by P/L; other values retain input order |

For analysis runs, explicitly use `--save false`. The current JSON serialization does not preserve JavaScript `Map` contents in a reusable form, and saving overwrites the selected portfolio file.

## Understanding the report

The report contains:

- **Total profit / loss:** realised results not placed in the discount-eligible bucket.
- **Total profit eligible for discount:** profitable realised amounts the program flags as held for at least 12 months.
- **Total cost:** cost allocated to the closed quantities in that bucket/year.
- **Total buy / sell:** transaction totals for the financial year. Sell totals are currently displayed as negative numbers.
- **Cumulative profit / loss:** gross winning and losing realised amounts.
- **Per-symbol P/L:** realised non-discount-bucket P/L for each symbol.
- **Current portfolio:** quantities and average costs left open after all supplied transactions.

For FP Markets cTrader input, the report also shows closed-position count, gross trading P/L, commission, and swaps. Buy/sell turnover and portfolio cost remain zero because the export does not provide account-currency transaction values and contains only closed positions.

For Binance input, the report shows complete-pair count, reporting and quote
currencies, the USDT reconciliation, FX source and method, ignored
funding/transfer records, and ignored cross-crypto conversions. With
`--fx-rates`, `Total buy`, `Total sell`, profit and per-symbol P/L are AUD.
Unmatched quantities and the exact RBA observations used are exposed in the
library result for reconciliation.

Because eligible gains are reported separately, the program's total pre-discount realised result is generally:

```text
Total profit / loss + Total profit eligible for discount
```

Do not simply halve the eligible figure to prepare a tax return. Capital losses, eligibility rules, parcel identification, and the order in which concessions apply need to be considered separately.

## Calculation behavior and limitations

- Open positions use a pooled average cost; parcel selection is not configurable.
- Realised P/L is assigned to the financial year of the closing transaction.
- Brokerage and other costs affect results when they are included in the parsed transaction total.
- The generic commission/fee/tax mappings alone do not change the transaction total.
- The CSV reader splits rows on commas and is not a full RFC-compliant CSV parser; embedded commas in quoted fields may be misread.
- Transactions are not deduplicated across files.
- Automatic consolidation/split data is limited to entries in `data/cos.json`. Other corporate actions must be reviewed and adjusted before relying on the report.
- A malformed file may be logged and skipped while other files continue processing, so always reconcile the reported symbol count, first/last dates, trade count, and turnover with the source exports.
- The library accepts either a CSV-content string or an array of file paths. Use file arrays when combining multiple exports.
- FP Markets cTrader results use the broker-reported closed-position P/L, commission, and swaps. They do not attempt to reconstruct CFD contract values from price and volume.
- Binance closed-pair results use FIFO inventory matching solely to distinguish
  known USDT-costed quantities from unknown inventory. Deposits, withdrawals,
  wallet transfers, and unvalued cross-crypto quantities do not contribute to
  P/L.
- Binance fee currencies other than the traded asset or USDT are rejected
  because this export does not provide a USDT value for those fees.
- Binance AUD conversion assumes 1 USDT equals 1 USD, then applies the RBA
  F11.1 FXRUSD observation on the transaction date or the latest prior
  published date. Keep the source rates and review whether that stablecoin
  approximation is appropriate for the intended tax treatment.

## Library usage

The high-level library accepts file input:

```javascript
const sprolosta = require('sprolosta');

const results = sprolosta.processTrades(
    ['2022.csv', '2023.csv', '2024.csv'],
    {
        broker: 'commsec',
        save: false,
        symbol: 'CBA,NAB',
        ignore: ['APT']
    }
);

for (const [year, report] of Object.entries(results.financial_years)) {
    const preDiscountResult = report.profit + report.profit_discount;
    console.log(`${year}: ${preDiscountResult}`);
}

for (const holding of results.holdings) {
    console.log(
        `${holding.symbol}: ${holding.quantity} @ ${holding.average_price}`
    );
}
```

Notable result fields include:

- `financial_years`: object keyed by strings such as `2023-2024`
- `holdings`: remaining open positions
- `remaining_cost`: aggregate cost of remaining long positions
- `symbols_count`, `first_trade`, `last_trade`, and `periods_traded`
- `portfolio` and `trades`: detailed model objects containing `Map` and `Set` values

See [`examples/library-usage.js`](examples/library-usage.js) and [`tests/test-data`](tests/test-data) for additional examples and representative input formats.

## Tests

Install development dependencies and run:

```bash
npm test
```

See [`tests/README.md`](tests/README.md) for the test layout.

## Disclaimer

The author is not responsible for loss or damage caused by use of this project. Always consult a professional tax accountant for tax matters.

## Donation

Bitcoin: `TSvSd6BMhVYKWJWainRvtzaDH6usPBYW4p`

## Maintainer

[Eric Tang](https://twitter.com/_e_tang) at [TYO Lab](http://tyo.com.au)
