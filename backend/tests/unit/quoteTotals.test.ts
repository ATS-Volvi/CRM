import { formatQuoteWithTotals } from "../../src/controllers/quoteController";

describe("Quote Totals Calculation Unit Tests", () => {
  it("should correctly compute subtotal, totalDiscount, totalTax, and totalAmount with discounted and non-discounted items", () => {
    const rawQuote = {
      id: "quote-test-1",
      QuoteLineItems: [
        {
          quantity: 2,
          unitPrice: 100,
          discount: 0,
          tax: 15,
          totalPrice: 200, // 2 * 100
          isOptional: false
        },
        {
          quantity: 1,
          unitPrice: 500,
          discount: 10,
          tax: 15,
          totalPrice: 450, // 500 * (1 - 0.10)
          isOptional: false
        }
      ]
    };

    const formatted = formatQuoteWithTotals(rawQuote);

    // Item 1: gross = 200, discount = 0, subtotal = 200, tax (15%) = 30
    // Item 2: gross = 500, discount = 50, subtotal = 450, tax (15%) = 67.50
    // Aggregate subtotal = 200 + 500 = 700
    // Aggregate totalDiscount = 0 + 50 = 50
    // Aggregate totalTax = 30 + 67.50 = 97.50
    // Aggregate totalAmount = 700 - 50 + 97.50 = 747.50

    expect(formatted.subtotal).toBe(700);
    expect(formatted.totalDiscount).toBe(50);
    expect(formatted.totalTax).toBe(97.50);
    expect(formatted.totalAmount).toBe(747.50);
  });

  it("should exclude optional items from aggregates", () => {
    const rawQuote = {
      id: "quote-test-2",
      QuoteLineItems: [
        {
          quantity: 1,
          unitPrice: 1000,
          discount: 20,
          tax: 15,
          totalPrice: 800,
          isOptional: false
        },
        {
          quantity: 5,
          unitPrice: 200,
          discount: 0,
          tax: 15,
          totalPrice: 1000,
          isOptional: true // Optional!
        }
      ]
    };

    const formatted = formatQuoteWithTotals(rawQuote);

    // Non-optional Item 1: gross = 1000, discount = 200, subtotal = 800, tax = 120
    expect(formatted.subtotal).toBe(1000);
    expect(formatted.totalDiscount).toBe(200);
    expect(formatted.totalTax).toBe(120);
    expect(formatted.totalAmount).toBe(920);
  });
});
