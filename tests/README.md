# SPROLOSTA Tests

This directory contains unit and integration tests for the SPROLOSTA library.

## Running Tests

Run all tests:

```bash
npm test
```

Run specific test file:

```bash
npm test tests/models.test.js
```

## Test Files

- `models.test.js` - Tests for models defined in `/lib/models.js`
- `utils.test.js` - Tests for utility functions in `/lib/utils.js`
- `lib.test.js` - Tests for the main library functions in `/lib.js`
- `broker-base.test.js` - Tests for the base broker class
- `commsec-broker.test.js` - Tests for the CommSec broker implementation
- `transaction-sort.test.js` - Tests for the transaction sorting function
- `integration.test.js` - Integration tests with mock CSV data

## Test Data

Mock CSV data for testing is located in the `test-data` directory:

- `mock-commsec.csv` - Sample CommSec CSV data in pre-2023 format
- `mock-commsec-new.csv` - Sample CommSec CSV data in post-2023 format

## Test Coverage

The tests cover:

1. Data models and their functionality
2. Utility functions for date handling and financial year calculation
3. Broker implementations (base class and CommSec)
4. CSV parsing and transaction processing
5. Profit and loss calculations
6. Financial year reporting

## Adding New Tests

When adding new tests:

1. Follow the existing pattern of placing tests in the appropriate file based on what they're testing
2. Use Jest's `describe` and `test` functions to organize tests
3. For new broker implementations, create a dedicated test file (e.g., `fpmarkets-broker.test.js`)
4. For integration tests with new data formats, add sample CSV files to the `test-data` directory