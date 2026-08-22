/**
 * Pins the ATO CGT discount boundary: the discount requires the asset be
 * held STRICTLY MORE than 12 months. A disposal exactly on the first
 * anniversary of acquisition is NOT eligible.
 *
 * Uses real brokers.normalizeData() + processTradesWithRecords() (the
 * shipping CommSec CSV parsing + calculate_profit() path in
 * brokers/base.js) rather than hand-built Profit objects, so these tests
 * exercise the actual boundary logic end-to-end.
 */

const brokers = require('../brokers');
const sprolosta = require('../lib');

const HEADER = 'Code,Company,Date,Type,Quantity,Unit Price ($),Trade Value ($),Brokerage+GST ($),GST ($),Contract Note,Total Value ($)';

/**
 * Runs a single buy/sell round trip through the real engine and returns the
 * one resulting Profit row's discount_eligible flag.
 * Sell price is always higher than buy price so profit_num > 0 and the
 * discount_eligible branch is reached.
 */
function discountEligibleFor(buyDate, sellDate) {
    const csv = [
        HEADER,
        `BHP,BHP GROUP LIMITED,${buyDate},BUY,10,10.00,100.00,9.95,0.90,C1,109.95`,
        `BHP,BHP GROUP LIMITED,${sellDate},SELL,10,20.00,200.00,9.95,0.90,C2,-190.05`,
    ].join('\n');

    const { trades } = brokers.normalizeData(csv, 'commsec', { index: 0, offset: 0 });
    const broker = brokers.get_broker('commsec');
    const results = sprolosta.processTradesWithRecords(trades, broker, {});
    const holding = results.portfolio.holdings.get('BHP');

    // Find the single Profit row across whichever financial year(s) it landed in.
    let found = null;
    holding.profits.forEach((profitList) => {
        profitList.forEach((p) => {
            found = p;
        });
    });
    if (!found) {
        throw new Error('No profit row produced for buy=' + buyDate + ' sell=' + sellDate);
    }
    return found.discount_eligible;
}

describe('CGT discount 12-month boundary', () => {
    test('exactly 12 months (buy 10/05/2022, sell 10/05/2023) is NOT eligible', () => {
        expect(discountEligibleFor('10/05/2022', '10/05/2023')).toBe(false);
    });

    test('12 months + 1 day (buy 10/05/2022, sell 11/05/2023) is eligible', () => {
        expect(discountEligibleFor('10/05/2022', '11/05/2023')).toBe(true);
    });

    test('month rollover just past anniversary (buy 31/05/2022, sell 01/06/2023) is eligible', () => {
        expect(discountEligibleFor('31/05/2022', '01/06/2023')).toBe(true);
    });

    test('less than 12 months (buy 10/05/2022, sell 10/04/2023) is NOT eligible', () => {
        expect(discountEligibleFor('10/05/2022', '10/04/2023')).toBe(false);
    });

    test('well over 12 months (buy 10/05/2022, sell 10/05/2024) is eligible', () => {
        expect(discountEligibleFor('10/05/2022', '10/05/2024')).toBe(true);
    });

    // Leap-day acquisition: anniversary = setFullYear(2020-02-29 -> +1) which
    // JS rolls to Mar-1 2021 (non-leap year has no Feb 29). Eligibility
    // requires disposal strictly AFTER that rolled anniversary.
    // This is a conservative (taxpayer-unfavourable in the single-day
    // edge case) reading: it denies the discount on 01/03/2021, disposal
    // exactly on the rolled anniversary date, even though one could argue
    // the "true" anniversary of Feb-29 in a non-leap year is debatable.
    // We pin both sides of that rolled boundary and document the choice
    // rather than special-case leap days.
    test('leap-day buy, disposal ON the rolled anniversary (29/02/2020, sell 01/03/2021) is NOT eligible (conservative)', () => {
        expect(discountEligibleFor('29/02/2020', '01/03/2021')).toBe(false);
    });

    test('leap-day buy, disposal one day AFTER the rolled anniversary (29/02/2020, sell 02/03/2021) is eligible', () => {
        expect(discountEligibleFor('29/02/2020', '02/03/2021')).toBe(true);
    });
});
