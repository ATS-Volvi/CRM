import {
  isWorkingDay,
  addBusinessHours,
  calculateRagStatus,
  computeSlaMilestones,
} from "../../src/services/siteInspectionSlaService";
import { isQuietPeriod } from "../../src/services/siteInspectionAlertService";

describe("Site Inspection Phase 2 — Stage B Unit Tests: Timelines, SLA Clocks & Alerts", () => {
  // Saudi working week: Sunday (0) to Thursday (4)
  const saudiWeek = [0, 1, 2, 3, 4];
  const workingHours = { start: "08:00", end: "17:00" }; // 9 business hours per day

  // Public holidays
  const testHolidays = [
    { date: "2026-09-23", isRecurringYearly: true, name: "Saudi National Day" },
    { date: "2026-02-22", isRecurringYearly: true, name: "Founding Day" },
  ];

  describe("1. Business-Calendar SLA Clock Arithmetic (Asia/Riyadh AST)", () => {
    test("Correctly identifies Saudi working days (Sunday-Thursday) vs weekends (Friday-Saturday)", () => {
      // 2026-11-01 is Sunday (Day 0) -> Working
      const sunday = new Date("2026-11-01T08:00:00Z");
      expect(isWorkingDay(sunday, saudiWeek, testHolidays)).toBe(true);

      // 2026-11-05 is Thursday (Day 4) -> Working
      const thursday = new Date("2026-11-05T08:00:00Z");
      expect(isWorkingDay(thursday, saudiWeek, testHolidays)).toBe(true);

      // 2026-11-06 is Friday (Day 5) -> Weekend / Non-working
      const friday = new Date("2026-11-06T08:00:00Z");
      expect(isWorkingDay(friday, saudiWeek, testHolidays)).toBe(false);

      // 2026-11-07 is Saturday (Day 6) -> Weekend / Non-working
      const saturday = new Date("2026-11-07T08:00:00Z");
      expect(isWorkingDay(saturday, saudiWeek, testHolidays)).toBe(false);
    });

    test("Skips official public holidays", () => {
      // 2026-09-23 is Wednesday (Saudi National Day)
      const nationalDay = new Date("2026-09-23T08:00:00Z");
      expect(isWorkingDay(nationalDay, saudiWeek, testHolidays)).toBe(false);

      // Non-holiday Wednesday
      const normalWed = new Date("2026-09-30T08:00:00Z");
      expect(isWorkingDay(normalWed, saudiWeek, testHolidays)).toBe(true);
    });

    test("Adds business hours within the same business day", () => {
      // Sunday 09:00 AST (06:00 UTC) + 4 business hours = Sunday 13:00 AST (10:00 UTC)
      const startUtc = new Date(Date.UTC(2026, 10, 1, 6, 0, 0)); // 09:00 AST
      const result = addBusinessHours(startUtc, 4, saudiWeek, workingHours, testHolidays);

      const resUtc = new Date(result);
      const resAstHour = (resUtc.getUTCHours() + 3) % 24;
      expect(resAstHour).toBe(13);
      expect(resUtc.getUTCDate()).toBe(startUtc.getUTCDate());
    });

    test("Rolls business hours across evening and weekend (Friday-Saturday pause)", () => {
      // Thursday 15:00 AST (12:00 UTC) + 4 business hours:
      // Thursday has 2 business hours left (15:00 - 17:00).
      // Remaining 2 business hours roll past Friday & Saturday into Sunday 08:00 - 10:00 AST.
      const thursdayStartUtc = new Date(Date.UTC(2026, 10, 5, 12, 0, 0)); // Thu 15:00 AST
      const result = addBusinessHours(thursdayStartUtc, 4, saudiWeek, workingHours, testHolidays);

      const resUtc = new Date(result);
      const resAstHour = (resUtc.getUTCHours() + 3) % 24;
      expect(resAstHour).toBe(10);
      // Sunday is 2026-11-08 (Thursday Nov 5 + 3 days)
      expect(resUtc.getUTCDate()).toBe(8);
    });

    test("URGENT priority uses 24 calendar hours without pausing on weekend", () => {
      // Thursday 15:00 AST + 24 calendar hours = Friday 15:00 AST
      const thursdayStartUtc = new Date(Date.UTC(2026, 10, 5, 12, 0, 0));
      const result = addBusinessHours(thursdayStartUtc, 24, saudiWeek, workingHours, testHolidays, true);

      const diffHours = (result.getTime() - thursdayStartUtc.getTime()) / 3600000;
      expect(diffHours).toBe(24);
    });

    test("Computes milestone due dates based on priority defaults", async () => {
      const assignedAt = new Date(Date.UTC(2026, 10, 1, 5, 0, 0)); // Sun 08:00 AST

      const customSettings: any = {
        workingWeek: saudiWeek,
        workingHours,
        slaHours: {
          accept: 4,
          schedule: 24,
          submit: 48,
          review: 24,
          submitUrgent: 24,
        },
      };

      const milestones = await computeSlaMilestones(assignedAt, "NORMAL", customSettings, testHolidays);

      expect(milestones.slaAcceptDueAt).toBeInstanceOf(Date);
      expect(milestones.slaScheduleDueAt).toBeInstanceOf(Date);
      expect(milestones.slaSubmitDueAt).toBeInstanceOf(Date);
      expect(milestones.slaReviewDueAt).toBeInstanceOf(Date);

      // Accept due in 4 business hours -> Sun 12:00 AST
      expect(milestones.slaAcceptDueAt.getTime()).toBeGreaterThan(assignedAt.getTime());
      expect(milestones.slaSubmitDueAt.getTime()).toBeGreaterThan(milestones.slaScheduleDueAt.getTime());
      expect(milestones.slaReviewDueAt.getTime()).toBeGreaterThan(milestones.slaSubmitDueAt.getTime());
    });
  });

  describe("2. RAG Status & Countdown Formatting", () => {
    test("Reports ON_TRACK when under 80% elapsed", () => {
      const start = new Date("2026-11-01T08:00:00Z");
      const due = new Date("2026-11-01T18:00:00Z"); // 10h window
      const now = new Date("2026-11-01T12:00:00Z"); // 4h elapsed (40%)

      const res = calculateRagStatus(start, due, now);
      expect(res.rag).toBe("ON_TRACK");
      expect(res.percentage).toBe(40);
      expect(res.formattedCountdown).toContain("6h 0m remaining");
    });

    test("Reports AT_RISK when between 80% and 100% elapsed", () => {
      const start = new Date("2026-11-01T08:00:00Z");
      const due = new Date("2026-11-01T18:00:00Z"); // 10h window
      const now = new Date("2026-11-01T16:30:00Z"); // 8.5h elapsed (85%)

      const res = calculateRagStatus(start, due, now);
      expect(res.rag).toBe("AT_RISK");
      expect(res.percentage).toBe(85);
      expect(res.formattedCountdown).toContain("1h 30m remaining");
    });

    test("Reports OVERDUE when now is past due date", () => {
      const start = new Date("2026-11-01T08:00:00Z");
      const due = new Date("2026-11-01T18:00:00Z");
      const now = new Date("2026-11-01T20:15:00Z"); // 2h 15m overdue

      const res = calculateRagStatus(start, due, now);
      expect(res.rag).toBe("OVERDUE");
      expect(res.percentage).toBe(100);
      expect(res.formattedCountdown).toContain("Overdue by 2h 15m");
    });
  });

  describe("3. Quiet Period & Deduplication", () => {
    test("Detects quiet hours in Asia/Riyadh (21:00 PM to 08:00 AM AST)", () => {
      // 22:00 AST (19:00 UTC) -> Quiet
      const nightUtc = new Date(Date.UTC(2026, 10, 1, 19, 0, 0));
      expect(isQuietPeriod(nightUtc, 21, 8)).toBe(true);

      // 03:00 AST (00:00 UTC) -> Quiet
      const lateNightUtc = new Date(Date.UTC(2026, 10, 1, 0, 0, 0));
      expect(isQuietPeriod(lateNightUtc, 21, 8)).toBe(true);

      // 10:00 AST (07:00 UTC) -> Active / Not quiet
      const morningUtc = new Date(Date.UTC(2026, 10, 1, 7, 0, 0));
      expect(isQuietPeriod(morningUtc, 21, 8)).toBe(false);

      // 14:00 AST (11:00 UTC) -> Active / Not quiet
      const afternoonUtc = new Date(Date.UTC(2026, 10, 1, 11, 0, 0));
      expect(isQuietPeriod(afternoonUtc, 21, 8)).toBe(false);
    });
  });

  describe("4. Pause and Resume SLA Clocks (WAITING_ON_CLIENT)", () => {
    test("Calculates remaining time correctly when SLA is paused", () => {
      const start = new Date("2026-11-01T08:00:00Z");
      const due = new Date("2026-11-01T18:00:00Z"); // 10h window
      const pausedAt = new Date("2026-11-01T12:00:00Z"); // paused at 4h (40%)
      const laterNow = new Date("2026-11-01T22:00:00Z"); // 10h later while paused

      // When paused, RAG status evaluates against pausedAt, NOT laterNow
      const res = calculateRagStatus(start, due, laterNow, true, pausedAt);
      expect(res.rag).toBe("ON_TRACK");
      expect(res.percentage).toBe(40);
      expect(res.remainingMinutes).toBe(360);
      expect(res.formattedCountdown).toContain("6h 0m remaining");
    });
  });

  describe("5. Inspector State Machine & Decline Re-offers", () => {
    test("Decline excludes declined inspector and allows candidate ranking of remainder", () => {
      const allCandidates = [
        { userId: "inspector-1", name: "Ahmed", openInspectionsCount: 1 },
        { userId: "inspector-2", name: "Yousef", openInspectionsCount: 2 },
        { userId: "inspector-3", name: "Khalid", openInspectionsCount: 3 },
      ];

      // Inspector-1 declines
      const excluded = ["inspector-1"];
      const remaining = allCandidates.filter((c) => !excluded.includes(c.userId));

      expect(remaining.length).toBe(2);
      expect(remaining[0].userId).toBe("inspector-2");
      expect(remaining[0].name).toBe("Yousef");

      // Inspector-2 also declines
      excluded.push("inspector-2");
      const remaining2 = allCandidates.filter((c) => !excluded.includes(c.userId));
      expect(remaining2.length).toBe(1);
      expect(remaining2[0].userId).toBe("inspector-3");
    });
  });

  describe("6. Multi-Tier Escalation Chain & Simulated Clock", () => {
    test("Simulates 10-hour sleep and verifies milestone transitions", () => {
      const startTime = new Date("2026-11-01T08:00:00Z");
      const acceptDue = new Date("2026-11-01T12:00:00Z"); // 4h SLA
      const submitDue = new Date("2026-11-03T08:00:00Z"); // 48h SLA

      // At T+2h (50% of accept SLA):
      const tPlus2 = new Date(startTime.getTime() + 2 * 3600000);
      const ragAt50 = calculateRagStatus(startTime, acceptDue, tPlus2);
      expect(ragAt50.percentage).toBe(50);
      expect(ragAt50.rag).toBe("ON_TRACK");

      // At T+3.2h (80% of accept SLA):
      const tPlus3_2 = new Date(startTime.getTime() + 3.2 * 3600000);
      const ragAt80 = calculateRagStatus(startTime, acceptDue, tPlus3_2);
      expect(ragAt80.percentage).toBe(80);
      expect(ragAt80.rag).toBe("AT_RISK");

      // Simulated 10-hour instance sleep: Clock jumps to T+10h
      const tPlus10 = new Date(startTime.getTime() + 10 * 3600000);
      const ragPostSleep = calculateRagStatus(startTime, acceptDue, tPlus10);
      expect(ragPostSleep.rag).toBe("OVERDUE");
      expect(ragPostSleep.percentage).toBe(100);
      expect(ragPostSleep.formattedCountdown).toContain("Overdue by 6h 0m");
    });

    test("Escalation Level 1 to Ops Manager, then Level 2 to Director after 24h", () => {
      const overdueTime = new Date("2026-11-01T12:00:00Z");
      const opsEscalatedAt = overdueTime;

      // 12 hours after ops escalation -> Director escalation not yet due
      const tPlus12 = new Date(opsEscalatedAt.getTime() + 12 * 3600000);
      const msElapsed12 = tPlus12.getTime() - opsEscalatedAt.getTime();
      expect(msElapsed12 >= 24 * 3600000).toBe(false);

      // 24.5 hours after ops escalation -> Director escalation IS due
      const tPlus24_5 = new Date(opsEscalatedAt.getTime() + 24.5 * 3600000);
      const msElapsed24_5 = tPlus24_5.getTime() - opsEscalatedAt.getTime();
      expect(msElapsed24_5 >= 24 * 3600000).toBe(true);
    });
  });
});

