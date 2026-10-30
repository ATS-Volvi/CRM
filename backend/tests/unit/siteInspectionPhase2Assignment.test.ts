import {
  evaluateAndRankCandidates,
  isCandidateOnLeave,
  EngineCandidate,
  EngineSiteBase,
} from "../../src/services/siteInspectionAssignmentEngine";
import {
  DEFAULT_SETTINGS,
  validateSetting,
  explainSettingEffect,
} from "../../src/services/siteInspectionSettingsService";
import { haversineKm } from "../../src/services/siteInspectionService";

describe("Site Inspection Phase 2 — Stage A Assignment Engine & Settings Unit Tests", () => {
  const testBases: EngineSiteBase[] = [
    { id: "base-jubail", name: "Jubail Operations Base", latitude: 27.0, longitude: 49.65 },
    { id: "base-yanbu", name: "Yanbu Operations Base", latitude: 24.09, longitude: 38.06 },
    { id: "base-riyadh", name: "Riyadh Operations Base", latitude: 24.71, longitude: 46.68 },
  ];

  const defaultSettings = {
    maxOpenInspections: 5,
    maxVisitsPerDay: 2,
    maxDistanceKm: 300,
    balancedWeights: { distance: 0.5, load: 0.5 },
  };

  const createCandidate = (overrides: Partial<EngineCandidate> = {}): EngineCandidate => ({
    userId: "user-1",
    name: "Inspector 1",
    isAvailable: true,
    userStatus: "Active",
    onLeaveFrom: null,
    onLeaveTo: null,
    homeBaseId: "base-jubail",
    coverageBaseIds: [],
    maxOpenInspections: null,
    maxVisitsPerDay: null,
    maxDistanceKm: null,
    certifications: ["GENERAL", "SEWAGE", "HAZARDOUS"],
    languages: ["Arabic", "English"],
    lastAssignedAt: null,
    openInspectionsCount: 0,
    scheduledVisitsTodayCount: 0,
    ...overrides,
  });

  describe("1. Pure Engine Qualification & Disqualification Rules", () => {
    test("Disqualifies candidate when marked unavailable in profile", () => {
      const c1 = createCandidate({ userId: "u1", name: "Unavailable Inspector", isAvailable: false });
      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        projectLocation: { latitude: 27.02, longitude: 49.6 },
        candidates: [c1],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBeNull();
      expect(decision.assignmentState).toBe("UNASSIGNED");
      expect(decision.evaluations[0].qualified).toBe(false);
      expect(decision.evaluations[0].disqualificationReasons).toContain("Marked unavailable in inspector profile");
    });

    test("Disqualifies candidate when user account is Inactive", () => {
      const c1 = createCandidate({ userId: "u1", userStatus: "Inactive" });
      const decision = evaluateAndRankCandidates({
        mode: "legacy",
        candidates: [c1],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBeNull();
      expect(decision.evaluations[0].qualified).toBe(false);
      expect(decision.evaluations[0].disqualificationReasons).toContain("User account is inactive");
    });

    test("Disqualifies candidate when on approved leave on assessment date", () => {
      const c1 = createCandidate({
        userId: "u1",
        onLeaveFrom: "2026-11-01T00:00:00.000Z",
        onLeaveTo: "2026-11-05T23:59:59.000Z",
      });

      expect(isCandidateOnLeave(c1, new Date("2026-11-03T10:00:00.000Z"))).toBe(true);
      expect(isCandidateOnLeave(c1, new Date("2026-11-10T10:00:00.000Z"))).toBe(false);

      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        targetDate: "2026-11-03T12:00:00.000Z",
        candidates: [c1],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBeNull();
      expect(decision.evaluations[0].qualified).toBe(false);
      expect(decision.evaluations[0].disqualificationReasons[0]).toMatch(/On approved leave/);
    });

    test("Disqualifies candidate who reached maximum open inspections capacity", () => {
      const c1 = createCandidate({ userId: "u1", openInspectionsCount: 5 }); // global max = 5
      const c2 = createCandidate({ userId: "u2", maxOpenInspections: 3, openInspectionsCount: 3 }); // profile max = 3
      const c3 = createCandidate({ userId: "u3", maxOpenInspections: 6, openInspectionsCount: 4 }); // qualified (4 < 6)

      const decision = evaluateAndRankCandidates({
        mode: "legacy",
        candidates: [c1, c2, c3],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u3");
      expect(decision.evaluations[0].qualified).toBe(false);
      expect(decision.evaluations[1].qualified).toBe(false);
      expect(decision.evaluations[2].qualified).toBe(true);
    });

    test("Disqualifies candidate who reached maximum visits per day", () => {
      const c1 = createCandidate({ userId: "u1", scheduledVisitsTodayCount: 2 }); // global max = 2
      const c2 = createCandidate({ userId: "u2", scheduledVisitsTodayCount: 1 }); // qualified

      const decision = evaluateAndRankCandidates({
        mode: "legacy",
        candidates: [c1, c2],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u2");
      expect(decision.evaluations[0].qualified).toBe(false);
      expect(decision.evaluations[0].disqualificationReasons[0]).toMatch(/daily site visit limit/);
      expect(decision.evaluations[1].qualified).toBe(true);
    });

    test("Disqualifies candidate lacking required scope certifications", () => {
      const c1 = createCandidate({ userId: "u1", certifications: ["GENERAL", "SEWAGE"] });
      const c2 = createCandidate({ userId: "u2", certifications: ["hazardous", "general"] }); // case-insensitive

      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        requiredCertifications: ["HAZARDOUS"],
        projectLocation: { latitude: 27.0, longitude: 49.65 },
        candidates: [c1, c2],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u2");
      expect(decision.evaluations[0].qualified).toBe(false);
      expect(decision.evaluations[0].disqualificationReasons[0]).toMatch(/Missing required scope certification/);
      expect(decision.evaluations[1].qualified).toBe(true);
    });

    test("Disqualifies candidate beyond maxDistanceKm from project site", () => {
      // Jubail base is ~27.0, 49.65. Yanbu is ~1100 km away.
      const jubailInspector = createCandidate({ userId: "u-jubail", homeBaseId: "base-jubail" });
      const yanbuInspector = createCandidate({ userId: "u-yanbu", homeBaseId: "base-yanbu" });

      const projectNearJubail = { latitude: 26.9, longitude: 49.6 };

      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        projectLocation: projectNearJubail,
        candidates: [jubailInspector, yanbuInspector],
        bases: testBases,
        settings: { ...defaultSettings, maxDistanceKm: 300 },
      });

      expect(decision.selectedUserId).toBe("u-jubail");
      expect(decision.evaluations[1].qualified).toBe(false);
      expect(decision.evaluations[1].disqualificationReasons[0]).toMatch(/exceeding maximum travel radius/);
    });

    test("Considers coverage bases in distance calculation", () => {
      // Home base is Riyadh, but has coverage base in Jubail
      const flexibleInspector = createCandidate({
        userId: "u-flex",
        homeBaseId: "base-riyadh",
        coverageBaseIds: ["base-jubail"],
      });

      const projectNearJubail = { latitude: 27.05, longitude: 49.62 };
      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        projectLocation: projectNearJubail,
        candidates: [flexibleInspector],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u-flex");
      expect(decision.evaluations[0].nearestBase?.name).toBe("Jubail Operations Base");
      expect(decision.evaluations[0].minDistanceKm).toBeLessThan(50);
    });

    test("Returns UNASSIGNED with clear explanation when all candidates are disqualified", () => {
      const c1 = createCandidate({ userId: "u1", name: "Tariq", openInspectionsCount: 5 });
      const c2 = createCandidate({ userId: "u2", name: "Faisal", isAvailable: false });

      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        candidates: [c1, c2],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBeNull();
      expect(decision.assignmentState).toBe("UNASSIGNED");
      expect(decision.assignmentReason).toContain("No qualified inspector available");
      expect(decision.assignmentReason).toContain("Tariq");
      expect(decision.assignmentReason).toContain("Faisal");
    });
  });

  describe("2. Mode-Specific Ranking & Tie-Breaking", () => {
    test("Legacy Mode: strictly ranks by fewest open inspections regardless of location", () => {
      const farInspectorWithLowLoad = createCandidate({
        userId: "u-far",
        homeBaseId: "base-yanbu",
        openInspectionsCount: 1,
      });
      const nearInspectorWithHigherLoad = createCandidate({
        userId: "u-near",
        homeBaseId: "base-jubail",
        openInspectionsCount: 3,
      });

      const decision = evaluateAndRankCandidates({
        mode: "legacy",
        projectLocation: { latitude: 27.0, longitude: 49.65 },
        candidates: [nearInspectorWithHigherLoad, farInspectorWithLowLoad],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u-far");
      expect(decision.assignmentReason).toContain("Legacy round-robin: open load 1/5");
    });

    test("Nearest Mode: ranks by proximity from base to site", () => {
      const closerInspector = createCandidate({
        userId: "u-close",
        homeBaseId: "base-jubail",
        openInspectionsCount: 2,
      });
      const fartherInspector = createCandidate({
        userId: "u-far",
        homeBaseId: "base-riyadh",
        openInspectionsCount: 1, // lower load, but farther
      });

      const projectInEasternProvince = { latitude: 26.9, longitude: 49.6 };
      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        projectLocation: projectInEasternProvince,
        candidates: [fartherInspector, closerInspector],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u-close");
      expect(decision.assignmentReason).toMatch(/Nearest base: Jubail Operations Base, \d+(\.\d+)? km/);
    });

    test("Nearest Mode: breaks distance tie by lowest open load", () => {
      const inspectorA = createCandidate({
        userId: "u-a",
        homeBaseId: "base-jubail",
        openInspectionsCount: 3,
      });
      const inspectorB = createCandidate({
        userId: "u-b",
        homeBaseId: "base-jubail",
        openInspectionsCount: 1,
      });

      const projectCoords = { latitude: 27.0, longitude: 49.65 };
      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        projectLocation: projectCoords,
        candidates: [inspectorA, inspectorB],
        bases: testBases,
        settings: defaultSettings,
      });

      expect(decision.selectedUserId).toBe("u-b");
    });

    test("Ties on distance and workload broken by fair round-robin (lastAssignedAt)", () => {
      const assignedYesterday = createCandidate({
        userId: "u-yesterday",
        homeBaseId: "base-jubail",
        openInspectionsCount: 2,
        lastAssignedAt: new Date(Date.now() - 24 * 3600 * 1000),
      });
      const assignedLastWeek = createCandidate({
        userId: "u-lastweek",
        homeBaseId: "base-jubail",
        openInspectionsCount: 2,
        lastAssignedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      });

      const decision = evaluateAndRankCandidates({
        mode: "nearest",
        projectLocation: { latitude: 27.0, longitude: 49.65 },
        candidates: [assignedYesterday, assignedLastWeek],
        bases: testBases,
        settings: defaultSettings,
      });

      // Least recently assigned is picked
      expect(decision.selectedUserId).toBe("u-lastweek");
    });

    test("Balanced Mode: calculates weighted score combining distance and load", () => {
      // u1 is 20 km away with 3 open loads
      // u2 is 100 km away with 0 open loads
      const c1 = createCandidate({
        userId: "u1",
        homeBaseId: "base-jubail",
        openInspectionsCount: 3,
      });
      const c2 = createCandidate({
        userId: "u2",
        homeBaseId: "base-riyadh",
        openInspectionsCount: 0,
      });

      const decision = evaluateAndRankCandidates({
        mode: "balanced",
        projectLocation: { latitude: 27.0, longitude: 49.65 }, // at Jubail
        candidates: [c1, c2],
        bases: testBases,
        settings: {
          ...defaultSettings,
          balancedWeights: { distance: 0.7, load: 0.3 }, // heavier weight on distance
        },
      });

      expect(decision.selectedUserId).toBe("u1");
      expect(decision.assignmentReason).toMatch(/Balanced score:/);
    });
  });

  describe("3. Settings Validation & Plain-Text Explanation", () => {
    test("Validates ranges for maxOpenInspections and maxDistanceKm", () => {
      expect(validateSetting("maxOpenInspections", 0)).toBeTruthy();
      expect(validateSetting("maxOpenInspections", 60)).toBeTruthy();
      expect(validateSetting("maxOpenInspections", 10)).toBeNull();

      expect(validateSetting("maxDistanceKm", 5)).toBeTruthy();
      expect(validateSetting("maxDistanceKm", 300)).toBeNull();
    });

    test("Validates balancedWeights must sum to 1.0", () => {
      expect(validateSetting("balancedWeights", { distance: 0.5, load: 0.4 })).toBeTruthy();
      expect(validateSetting("balancedWeights", { distance: 0.6, load: 0.4 })).toBeNull();
    });

    test("Validates assignmentMode must be legacy, nearest, or balanced", () => {
      expect(validateSetting("assignmentMode", "random" as any)).toBeTruthy();
      expect(validateSetting("assignmentMode", "nearest")).toBeNull();
    });

    test("Validates workingWeek can contain any days 0 to 6 (Sunday to Saturday)", () => {
      // Default Sunday to Thursday
      expect(DEFAULT_SETTINGS.workingWeek).toEqual([0, 1, 2, 3, 4]);
      expect(validateSetting("workingWeek", [0, 1, 2, 3, 4])).toBeNull();
      // Sunday to Saturday (all days)
      expect(validateSetting("workingWeek", [0, 1, 2, 3, 4, 5, 6])).toBeNull();
      // Any combination of 0 to 6
      expect(validateSetting("workingWeek", [1, 2, 3, 4, 5])).toBeNull();
      expect(validateSetting("workingWeek", [0, 6])).toBeNull();
      // Rejects invalid day numbers
      expect(validateSetting("workingWeek", [-1, 0, 1])).toBeTruthy();
      expect(validateSetting("workingWeek", [0, 7])).toBeTruthy();
      expect(validateSetting("workingWeek", [])).toBeTruthy();
    });

    test("Checks defaults for maxVisitsPerDay: 2 and slaHours (accept: 4, schedule: 24, submit: 48, review: 24)", () => {
      expect(DEFAULT_SETTINGS.maxVisitsPerDay).toBe(2);
      expect(DEFAULT_SETTINGS.slaHours.accept).toBe(4);
      expect(DEFAULT_SETTINGS.slaHours.schedule).toBe(24);
      expect(DEFAULT_SETTINGS.slaHours.submit).toBe(48);
      expect(DEFAULT_SETTINGS.slaHours.review).toBe(24);

      expect(validateSetting("maxVisitsPerDay", 2)).toBeNull();
      expect(validateSetting("maxVisitsPerDay", 0)).toBeTruthy();
      expect(validateSetting("maxVisitsPerDay", 25)).toBeTruthy();

      expect(validateSetting("slaHours", { accept: 4, schedule: 24, submit: 48, review: 24 })).toBeNull();
      expect(validateSetting("slaHours", { accept: 0, schedule: 24, submit: 48, review: 24 })).toBeTruthy();
    });

    test("Produces descriptive human-readable effect explanations", () => {
      const modeEffect = explainSettingEffect("assignmentMode", "legacy", "nearest");
      expect(modeEffect).toContain("nearest-base routing");

      const capEffect = explainSettingEffect("maxOpenInspections", 5, 8);
      expect(capEffect).toContain("from 5 to 8 open inspections");

      const autoEffect = explainSettingEffect("automation", false, true);
      expect(autoEffect).toContain("Enabled site inspection automation");

      const weekEffect = explainSettingEffect("workingWeek", [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5, 6]);
      expect(weekEffect).toContain("Working week changed to Sun, Mon, Tue, Wed, Thu, Fri, Sat");
    });
  });
});
