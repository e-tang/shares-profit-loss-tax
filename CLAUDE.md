# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This project is a Node.js application (sprolosta) that calculates profit/loss of stock trading for Australian tax purposes.

## Build Commands
- `node index.js --broker <broker> [options] <input>` - Run the application
- `npm install` - Install dependencies

## Code Style Guidelines
- **JavaScript**: Standard JavaScript (ES6) with CommonJS modules
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/constructors
- **Imports**: Use CommonJS require system (e.g., `const models = require('./lib/models')`)
- **Models**: Define model objects in lib/models.js
- **Error Handling**: Use console.error for errors and process.exit(1) for critical failures
- **Broker Implementations**: Extend base broker class in brokers/base.js for new broker support
- **Function Documentation**: Use JSDoc style comments for function documentation
- **Data Structure**: Use Maps and Sets for collections where appropriate
- **Dates**: Use Date objects for date handling, utilities in lib/utils.js
- **Indentation**: 4-space indentation
- **String Quotes**: Use single quotes for strings unless double quotes needed

## Financial Calculation Rules
- Transactions are sorted chronologically for accurate profit calculation
- Capital gains discount for assets held more than 12 months
- Supports consolidation/split adjustments from data/cos.json