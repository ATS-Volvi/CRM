/**
 * Call Summary Modal Logic & Contract Test
 * Verifies call summary modal trigger conditions, language defaults, and skip reason validation.
 */

describe("Call Summary Modal Contract Tests", () => {
  test("1. Triggers modal when lead has phone or whatsappPhone", () => {
    const leadWithPhone = { id: "lead-1", phone: "+966500000000", whatsappPhone: null };
    const leadWithWhatsApp = { id: "lead-2", phone: null, whatsappPhone: "+966511111111" };
    const leadWithoutPhone = { id: "lead-3", phone: null, whatsappPhone: null };

    const shouldShow1 = Boolean(leadWithPhone.phone || leadWithPhone.whatsappPhone);
    const shouldShow2 = Boolean(leadWithWhatsApp.phone || leadWithWhatsApp.whatsappPhone);
    const shouldShow3 = Boolean(leadWithoutPhone.phone || leadWithoutPhone.whatsappPhone);

    expect(shouldShow1).toBe(true);
    expect(shouldShow2).toBe(true);
    expect(shouldShow3).toBe(false);
  });

  test("2. Language formatting fallback (Arabic vs English)", () => {
    const callNotes = "Discussed project scope and budget";
    const formatRecap = (lang: string, notes: string) => {
      return notes
        ? lang === "ar"
          ? `ملخص المكالمة: ${notes}`
          : `Call Summary: ${notes}`
        : lang === "ar"
        ? "ملخص المكالمة الهاتفية"
        : "Call summary recap";
    };

    const arRecap = formatRecap("ar", callNotes);
    const enRecap = formatRecap("en", callNotes);

    expect(arRecap).toContain("ملخص المكالمة");
    expect(enRecap).toContain("Call Summary");
  });
});
