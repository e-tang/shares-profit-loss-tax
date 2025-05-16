/**
 * Represents a stock transaction
 */
declare class Transaction {
    id: number;
    uuid: string;
    date: Date;
    type: string;
    description: string;
    category: string;
    symbol?: string;
    company?: string;
    quantity: number;
    price: number;
    value: number;
    total: number;
    fee: number;
    gst: number;
    currency: string;
    exchange: string;
    note: string;
    count: number;
    
    /**
     * Creates a copy of the transaction
     */
    copy(): Transaction;
}

/**
 * Collection of trades
 */
declare class Trades {
    symbols: Map<string, any>;
    years: Set<number>;
    first: any;
    last: any;
}

/**
 * Represents a stock portfolio
 */
declare class Portfolio {
    holdings: Map<string, Holding>;
    value: number;
    cost: number;
    profit: number;
    profits: Map<number, number>;
    history_years: Set<number>;
}

/**
 * Represents profit/loss from a trade
 */
declare class Profit {
    year_init: number;
    year_close: number;
    quantity: number;
    cost: number;
    cost_price: number;
    close_price: number;
    profit: number;
    discount_eligible: boolean;
    transaction_open: any;
    transaction_close: any;
    trade_type: string;
    total_trades: number;
}

/**
 * Represents a stock holding
 */
declare class Holding {
    symbol?: string;
    company?: string;
    quantity: number;
    average_price: number;
    average_close: number;
    value: number;
    cost: number;
    profit: number;
    profits: Map<number, Profit[]>;
    profit_percent: number;
    note: string;
    date_init: Date | null;
    date_close: Date | null;
    transaction_init: Transaction | null;
    transaction_close: Transaction | null;
    trade_values: Map<number, TradeValue>;
    records: any[];
    last_cos: Date | null;
}

/**
 * Represents a financial year
 */
declare class FinancialYear {
    year: number;
    cost: number;
    profit: number;
    profit_discount: number;
    total_trades: number;
}

/**
 * Represents trade values for a financial year
 */
declare class TradeValue {
    buy: number;
    sell: number;
    year: number;
    transactions: any[];
}

/**
 * Represents a trade
 */
declare class Trade {
    symbol?: string;
    cost_price: number;
    close_price: number;
    quantity: number;
    profit: number;
    type: string;
    
    toString(): string;
}

declare const _default: {
    Transaction: typeof Transaction;
    Trades: typeof Trades;
    Portfolio: typeof Portfolio;
    Holding: typeof Holding;
    Profit: typeof Profit;
    FinancialYear: typeof FinancialYear;
    TradeValue: typeof TradeValue;
    Trade: typeof Trade;
};

export = _default;