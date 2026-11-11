import { getEmployeeDivisionCategory, ROLE_LABELS } from "../pages/SalespersonTracker";

describe("Business Users Division Categorization & Filter Logic", () => {
  test("categorizes Pre-Sales / SDR reps correctly", () => {
    const sdr1 = { id: "1", name: "Ava Sterling", role: "sales_rep", tier: "agent", department: "Inside Sales" };
    const sdr2 = { id: "2", name: "Bob Agent", role: "sales_rep", tier: null, department: "Sales" };

    expect(getEmployeeDivisionCategory(sdr1)).toBe("presales");
    expect(getEmployeeDivisionCategory(sdr2)).toBe("presales");
  });

  test("categorizes Sales Closers (Executive AE / Senior AE) correctly", () => {
    const closer1 = { id: "3", name: "Helena Rostova", role: "senior_ae", department: "Enterprise" };
    const closer2 = { id: "4", name: "Carl Executive", role: "sales_rep", tier: "executive", department: "Commercial" };

    expect(getEmployeeDivisionCategory(closer1)).toBe("sales");
    expect(getEmployeeDivisionCategory(closer2)).toBe("sales");
  });

  test("categorizes Field Inspectors & Site Surveyors correctly", () => {
    const inspector1 = { id: "5", name: "Zaid Surveyor", role: "site_manager", department: "Site Feasibility" };
    const inspector2 = { id: "6", name: "Sara Inspector", role: "agent", inspectorProfile: { id: "insp-1", maxOpenInspections: 5 } };
    const inspector3 = { id: "7", name: "Tariq Survey", role: "user", department: "Field Inspection Unit" };

    expect(getEmployeeDivisionCategory(inspector1)).toBe("inspector");
    expect(getEmployeeDivisionCategory(inspector2)).toBe("inspector");
    expect(getEmployeeDivisionCategory(inspector3)).toBe("inspector");
  });

  test("categorizes Field Technicians correctly", () => {
    const tech1 = { id: "8", name: "Alexander Wright", role: "technician", department: "Field Service" };
    const tech2 = { id: "9", name: "Mike Mechanic", role: "user", serviceResource: { id: "res-1", skills: ["Generator"] } };

    expect(getEmployeeDivisionCategory(tech1)).toBe("tech");
    expect(getEmployeeDivisionCategory(tech2)).toBe("tech");
  });

  test("categorizes Managers and Leadership correctly", () => {
    const admin = { id: "10", name: "Sophia Martinez", role: "admin" };
    const salesMgr = { id: "11", name: "David Boss", role: "sales_manager" };
    const opsMgr = { id: "12", name: "Emily Director", role: "ops_manager" };
    const director = { id: "13", name: "Robert CEO", role: "director" };

    expect(getEmployeeDivisionCategory(admin)).toBe("management");
    expect(getEmployeeDivisionCategory(salesMgr)).toBe("management");
    expect(getEmployeeDivisionCategory(opsMgr)).toBe("management");
    expect(getEmployeeDivisionCategory(director)).toBe("management");
  });

  test("verifies ROLE_LABELS mappings are distinct and user friendly", () => {
    expect(ROLE_LABELS.site_manager).toContain("Field Inspector");
    expect(ROLE_LABELS.technician).toContain("Field Service Technician");
    expect(ROLE_LABELS.sales_rep).toBeDefined();
  });
});
