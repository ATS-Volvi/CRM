import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  optimizeDailyRoute,
  resolveWaypointCoordinates
} from "../../src/services/siteInspectionRouteOptimizer";

describe("Daily Multi-Site Route Optimizer Unit Tests", () => {
  const baseLocation = {
    name: "Jafurah Operations Base",
    latitude: 25.55,
    longitude: 49.85
  };

  const inspectionA = {
    id: "ins-jubail",
    inspectionNumber: "SI-2026-0001",
    clientOrganization: "SABIC Petrochemicals",
    siteName: "Jubail Plant 4",
    siteAreaName: "Jubail Industrial 1",
    latitude: 27.00,
    longitude: 49.65,
    priority: "NORMAL",
    dueAt: "2026-11-20T10:00:00Z"
  };

  const inspectionB = {
    id: "ins-dammam",
    inspectionNumber: "SI-2026-0002",
    clientOrganization: "Dammam Port Logistics",
    siteName: "Port Berth 7",
    siteAreaName: "Dammam Port",
    latitude: 26.42,
    longitude: 50.09,
    priority: "NORMAL",
    dueAt: "2026-11-20T12:00:00Z"
  };

  const inspectionC = {
    id: "ins-khobar",
    inspectionNumber: "SI-2026-0003",
    clientOrganization: "Al Khobar Commercial Camp",
    siteName: "Camp Office",
    siteAreaName: "Al Khobar",
    latitude: 26.28,
    longitude: 50.21,
    priority: "NORMAL",
    dueAt: "2026-11-20T14:00:00Z"
  };

  describe("1. Sequence & Distance Minimization", () => {
    it("optimizes 3 regional sites into a continuous linear path to minimize distance", () => {
      // Intentionally passing in an unoptimized zigzag order: Jubail -> Khobar -> Dammam
      const unoptimizedList = [inspectionA, inspectionC, inspectionB];

      const result = optimizeDailyRoute(unoptimizedList, {
        startLocation: baseLocation,
        returnToBase: true,
        mode: "SHORTEST_DISTANCE"
      });

      assert.equal(result.optimizedOrder.length, 3);
      assert.ok(result.totalDistanceKm > 0);
      assert.ok(result.legs.length === 4); // Base -> Stop 1 -> Stop 2 -> Stop 3 -> Return Base

      // From Jafurah (25.55, 49.85), Khobar/Dammam are closer than Jubail.
      // Visiting Khobar then Dammam then Jubail (or reverse) saves substantial km over jumping back and forth.
      const firstStop = result.optimizedOrder[0];
      const lastStop = result.optimizedOrder[2];

      assert.ok(
        (firstStop.id === "ins-khobar" && lastStop.id === "ins-jubail") ||
        (firstStop.id === "ins-jubail" && lastStop.id === "ins-khobar"),
        "Route should connect adjacent clusters sequentially"
      );

      assert.ok(result.googleMapsUrl.includes("https://www.google.com/maps/dir/"));
      assert.ok(result.googleMapsUrl.includes(String(baseLocation.latitude)));
    });

    it("handles single site inspection cleanly with round-trip metrics", () => {
      const result = optimizeDailyRoute([inspectionA], {
        startLocation: baseLocation,
        returnToBase: true
      });

      assert.equal(result.optimizedOrder.length, 1);
      assert.equal(result.legs.length, 2); // Base -> Site -> Base
      assert.equal(result.legs[0].toInspectionId, "ins-jubail");
      assert.equal(result.distanceSavedKm, 0); // No reordering possible
    });
  });

  describe("2. Coordinate Resolution & Regional Fallbacks", () => {
    it("resolves explicit GPS coordinates when present", () => {
      const resolved = resolveWaypointCoordinates(inspectionA);
      assert.equal(resolved.latitude, 27.00);
      assert.equal(resolved.longitude, 49.65);
      assert.equal(resolved.resolvedSource, "GPS_EXPLICIT");
    });

    it("falls back to REGION_COORDINATES when coordinates are missing but city name is present", () => {
      const missingGpsInspection = {
        siteAreaName: "Jubail Support Industrial",
        siteName: "Unknown Lot",
        clientOrganization: "Kishor adi"
      };

      const resolved = resolveWaypointCoordinates(missingGpsInspection);
      assert.equal(resolved.latitude, 27.0);
      assert.equal(resolved.longitude, 49.65);
      assert.equal(resolved.resolvedSource, "REGION_FALLBACK");
    });

    it("gracefully marks completely unresolvable locations without throwing an error", () => {
      const invalidInspection = {
        siteAreaName: "j",
        siteName: null,
        clientOrganization: "No Geo Client"
      };

      const resolved = resolveWaypointCoordinates(invalidInspection);
      assert.equal(resolved.latitude, null);
      assert.equal(resolved.longitude, null);
      assert.equal(resolved.resolvedSource, "UNRESOLVED");

      const routeResult = optimizeDailyRoute([inspectionA, invalidInspection], {
        startLocation: baseLocation
      });

      assert.equal(routeResult.unresolvedCount, 1);
      assert.equal(routeResult.optimizedOrder.length, 2);
      // Valid stop is first, unresolved stop is safely appended at end
      assert.equal(routeResult.optimizedOrder[0].id, "ins-jubail");
    });
  });

  describe("3. SLA-Guarded Priority Routing Mode", () => {
    it("prioritizes urgent inspection as Stop #1 in SLA_GUARDED mode even if farther away", () => {
      const urgentJubail = {
        ...inspectionA,
        priority: "URGENT"
      };
      const regularKhobar = {
        ...inspectionC,
        priority: "NORMAL"
      };

      const result = optimizeDailyRoute([regularKhobar, urgentJubail], {
        startLocation: baseLocation,
        mode: "SLA_GUARDED"
      });

      assert.equal(result.optimizedOrder[0].id, "ins-jubail", "Urgent inspection must be visited first in SLA mode");
      assert.equal(result.modeUsed, "SLA_GUARDED");
    });
  });
});
