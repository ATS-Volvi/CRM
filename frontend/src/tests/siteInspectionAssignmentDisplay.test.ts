import { getAssignmentDisplay, formatInspectionDateTime, SiteInspectionRecord } from "../lib/siteInspection";

describe("getAssignmentDisplay Unit Tests", () => {
  const dummyInspector = {
    id: "user-101",
    name: "Ahmad Al-Mansoor",
    email: "ahmad@nexus.com",
    role: "site_manager",
  };

  const requestedInspector = {
    id: "user-102",
    name: "Sami Al-Harbi",
    email: "sami@nexus.com",
    role: "site_manager",
  };

  test("State a: status === 'REQUESTED' with assignedTo and !acceptedAt (Waiting for acceptance)", () => {
    // 1. Not overdue
    const refNow = new Date("2026-11-04T10:00:00Z").getTime();
    const futureDue = "2026-11-04T15:30:00Z";

    const displayOnTime = getAssignmentDisplay(
      {
        status: "REQUESTED",
        assignedTo: dummyInspector,
        acceptedAt: null,
        slaAcceptDueAt: futureDue,
      } as Partial<SiteInspectionRecord>,
      refNow
    );

    expect(displayOnTime).not.toBeNull();
    expect(displayOnTime?.state).toBe("REQUESTED_AWAITING_ACCEPTANCE");
    expect(displayOnTime?.title).toBe("Requested from");
    expect(displayOnTime?.name).toBe("Ahmad Al-Mansoor");
    expect(displayOnTime?.email).toBe("ahmad@nexus.com");
    expect(displayOnTime?.pillText).toBe("Waiting for acceptance");
    expect(displayOnTime?.pillVariant).toBe("amber");
    expect(displayOnTime?.isOverdue).toBe(false);
    expect(displayOnTime?.subline).toContain("Accept by");
    expect(displayOnTime?.headerStatusOverride).toBe("Awaiting Acceptance");

    // 2. Overdue
    const pastDue = "2026-11-04T08:00:00Z";
    const displayOverdue = getAssignmentDisplay(
      {
        status: "REQUESTED",
        assignedTo: dummyInspector,
        acceptedAt: null,
        slaAcceptDueAt: pastDue,
      } as Partial<SiteInspectionRecord>,
      refNow
    );

    expect(displayOverdue?.isOverdue).toBe(true);
    expect(displayOverdue?.subline).toContain("Accept by");
  });

  test("State b: assignmentState === 'PENDING_CONFIRMATION' && requestedInspector", () => {
    const display = getAssignmentDisplay({
      status: "REQUESTED",
      assignmentState: "PENDING_CONFIRMATION",
      requestedInspector,
      requestedInspectorReason: "Lead requested specialized hazardous materials expert",
    } as Partial<SiteInspectionRecord>);

    expect(display).not.toBeNull();
    expect(display?.state).toBe("PENDING_CONFIRMATION");
    expect(display?.title).toBe("Requested inspector");
    expect(display?.name).toBe("Sami Al-Harbi");
    expect(display?.email).toBe("sami@nexus.com");
    expect(display?.pillText).toBe("Awaiting manager confirmation");
    expect(display?.pillVariant).toBe("amber");
    expect(display?.subline).toBe("Lead requested specialized hazardous materials expert");
  });

  test("State c: assignmentState === 'DECLINED' || declinedAt", () => {
    const display = getAssignmentDisplay({
      status: "REQUESTED",
      assignmentState: "DECLINED",
      assignedTo: dummyInspector,
      declinedAt: "2026-11-03T11:00:00Z",
      declineReason: "Conflicting emergency audit at Jubail facility",
    } as Partial<SiteInspectionRecord>);

    expect(display).not.toBeNull();
    expect(display?.state).toBe("DECLINED");
    expect(display?.title).toBe("Declined");
    expect(display?.name).toBe("Ahmad Al-Mansoor");
    expect(display?.pillText).toBe("Declined");
    expect(display?.pillVariant).toBe("red");
    expect(display?.subline).toBe("Conflicting emergency audit at Jubail facility");
  });

  test("State d: assignedTo && (acceptedAt || status in DRAFT, WAITING_ON_CLIENT, SUBMITTED, CHANGES_REQUESTED, APPROVED)", () => {
    // 1. Accepted in DRAFT
    const displayAccepted = getAssignmentDisplay({
      status: "DRAFT",
      assignedTo: dummyInspector,
      acceptedAt: "2026-11-04T09:15:00Z",
    } as Partial<SiteInspectionRecord>);

    expect(displayAccepted).not.toBeNull();
    expect(displayAccepted?.state).toBe("ACCEPTED");
    expect(displayAccepted?.title).toBe("Assigned Site Inspector");
    expect(displayAccepted?.name).toBe("Ahmad Al-Mansoor");
    expect(displayAccepted?.pillText).toBe("Accepted");
    expect(displayAccepted?.pillVariant).toBe("green");
    expect(displayAccepted?.subline).toContain("Accepted 04 Nov");

    // 2. Visit scheduled
    const displayScheduled = getAssignmentDisplay({
      status: "DRAFT",
      assignedTo: dummyInspector,
      acceptedAt: "2026-11-04T09:15:00Z",
      scheduledVisitAt: "2026-11-05T14:00:00Z",
    } as Partial<SiteInspectionRecord>);

    expect(displayScheduled?.pillText).toBe("Visit scheduled");
    expect(displayScheduled?.subline).toContain("Visit: 05 Nov");

    // 3. Visit started
    const displayStarted = getAssignmentDisplay({
      status: "DRAFT",
      assignedTo: dummyInspector,
      acceptedAt: "2026-11-04T09:15:00Z",
      scheduledVisitAt: "2026-11-05T14:00:00Z",
      startedAt: "2026-11-05T14:05:00Z",
    } as Partial<SiteInspectionRecord>);

    expect(displayStarted?.pillText).toBe("Visit started");
  });

  test("State e: no assignedTo (UNASSIGNED / NEEDS_AREA)", () => {
    const displayUnassigned = getAssignmentDisplay({
      status: "REQUESTED",
      assignmentState: "UNASSIGNED",
      assignedTo: null,
      assignmentReason: "No qualified inspector available within 150 km of Yanbu",
    } as Partial<SiteInspectionRecord>);

    expect(displayUnassigned).not.toBeNull();
    expect(displayUnassigned?.state).toBe("UNASSIGNED");
    expect(displayUnassigned?.title).toBe("Assigned Site Inspector");
    expect(displayUnassigned?.name).toBe("Not assigned yet");
    expect(displayUnassigned?.pillText).toBe("UNASSIGNED");
    expect(displayUnassigned?.pillVariant).toBe("amber");
    expect(displayUnassigned?.subline).toBe("No qualified inspector available within 150 km of Yanbu");
    expect(displayUnassigned?.approverHint).toContain("Open the portal to assign an inspector manually");

    const displayNeedsArea = getAssignmentDisplay({
      status: "REQUESTED",
      assignmentState: "NEEDS_AREA",
      assignedTo: null,
      assignmentReason: "Lead address does not match known service areas",
    } as Partial<SiteInspectionRecord>);

    expect(displayNeedsArea?.pillText).toBe("NEEDS AREA");
  });

  test("Edge case: null or undefined inspection returns null", () => {
    expect(getAssignmentDisplay(null)).toBeNull();
    expect(getAssignmentDisplay(undefined)).toBeNull();
  });
});
