import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseLocationInput,
  SAUDI_INDUSTRIAL_ZONES,
} from "../../src/utils/siteLocationParser";

describe("Site Inspection Location Parser & Geolocation Unit Tests", () => {
  describe("1. Raw Coordinates Parsing", () => {
    it("parses comma-separated latitude and longitude", () => {
      const res = parseLocationInput("27.0214, 49.6120");
      assert.equal(res.confidence, "EXACT");
      assert.equal(res.source, "COORDINATES");
      assert.equal(res.latitude, 27.0214);
      assert.equal(res.longitude, 49.612);
      assert.ok(res.googleMapsUrl?.includes("27.0214"));
    });

    it("handles degree symbols and cardinal directions (27.0214° N, 49.6120° E)", () => {
      const res = parseLocationInput("27.0214° N, 49.6120° E");
      assert.equal(res.confidence, "EXACT");
      assert.equal(res.latitude, 27.0214);
      assert.equal(res.longitude, 49.612);
    });

    it("handles negative coordinates for western/southern coordinates", () => {
      const res = parseLocationInput("-23.5505, -46.6333");
      assert.equal(res.confidence, "EXACT");
      assert.equal(res.latitude, -23.5505);
      assert.equal(res.longitude, -46.6333);
    });
  });

  describe("2. Google Maps URL Parsing", () => {
    it("extracts coordinates from @lat,lng Google Maps URL", () => {
      const url = "https://www.google.com/maps/place/Jubail/@27.0214,49.6120,15z/data=xxx";
      const res = parseLocationInput(url);
      assert.equal(res.source, "GOOGLE_MAPS_URL");
      assert.equal(res.confidence, "EXACT");
      assert.equal(res.latitude, 27.0214);
      assert.equal(res.longitude, 49.612);
    });

    it("extracts coordinates from ?q=lat,lng query URL", () => {
      const url = "https://maps.google.com/?q=26.4200,50.0900";
      const res = parseLocationInput(url);
      assert.equal(res.source, "GOOGLE_MAPS_URL");
      assert.equal(res.confidence, "EXACT");
      assert.equal(res.latitude, 26.42);
      assert.equal(res.longitude, 50.09);
    });

    it("extracts coordinates from protobuf !3d and !4d parameters", () => {
      const url = "https://www.google.com/maps/place/Plant+Gate/!3d27.0600!4d49.5200";
      const res = parseLocationInput(url);
      assert.equal(res.source, "GOOGLE_MAPS_URL");
      assert.equal(res.confidence, "EXACT");
      assert.equal(res.latitude, 27.06);
      assert.equal(res.longitude, 49.52);
    });

    it("safely handles Google Maps short links without inline coordinates", () => {
      const url = "https://maps.app.goo.gl/w8xyz123";
      const res = parseLocationInput(url);
      assert.equal(res.source, "GOOGLE_MAPS_URL");
      assert.equal(res.googleMapsUrl, url);
      assert.equal(res.latitude, null);
    });
  });

  describe("3. Saudi National Address Code (SPL)", () => {
    it("resolves Jubail National Address code (e.g. JBLA2941)", () => {
      const res = parseLocationInput("JBLA2941");
      assert.equal(res.source, "NATIONAL_ADDRESS");
      assert.equal(res.confidence, "REGIONAL_APPROX");
      assert.equal(res.latitude, 27.02);
      assert.equal(res.longitude, 49.61);
      assert.ok(res.areaName.includes("JBLA2941"));
    });

    it("resolves Dammam National Address code (e.g. RDMA4412)", () => {
      const res = parseLocationInput("RDMA4412");
      assert.equal(res.source, "NATIONAL_ADDRESS");
      assert.equal(res.confidence, "REGIONAL_APPROX");
      assert.equal(res.latitude, 26.42);
      assert.equal(res.longitude, 50.09);
    });
  });

  describe("4. Saudi Industrial Zone Presets", () => {
    it("recognizes Jubail Industrial City 2 preset", () => {
      const res = parseLocationInput("Jubail Industrial City 2");
      assert.equal(res.source, "PRESET_ZONE");
      assert.equal(res.confidence, "REGIONAL_APPROX");
      assert.equal(res.latitude, 27.06);
      assert.equal(res.longitude, 49.52);
    });

    it("recognizes Dammam 2nd Industrial City (MODON)", () => {
      const res = parseLocationInput("Dammam 2nd Industrial City");
      assert.equal(res.source, "PRESET_ZONE");
      assert.equal(res.latitude, 26.23);
      assert.equal(res.longitude, 49.98);
    });

    it("recognizes Ras Tanura refinery zone", () => {
      const res = parseLocationInput("Ras Tanura");
      assert.equal(res.source, "PRESET_ZONE");
      assert.equal(res.latitude, 26.65);
      assert.equal(res.longitude, 50.15);
    });

    it("handles plain text area gracefully without crashing", () => {
      const res = parseLocationInput("Some Remote Yard Outside Town");
      assert.equal(res.source, "CUSTOM_TEXT");
      assert.equal(res.confidence, "TEXT_ONLY");
      assert.equal(res.latitude, null);
      assert.equal(res.areaName, "Some Remote Yard Outside Town");
    });
  });
});
