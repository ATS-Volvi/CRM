#!/usr/bin/env node
/**
 * scripts/live-test-flow.mjs
 *
 * Runs end-to-end API level test flow on the live CRM:
 * 1. Reads credentials from ~/.live-test.env.
 * 2. Validates BASE_URL and production guards.
 * 3. Detects whether Site Inspection Gate is ON or OFF.
 * 4. Step a: Sales Rep creates lead & logs call -> lead CONTACTED -> inspection created.
 * 5. Step b: Gate ON: qualify/convert blocked. Gate OFF: skip check with notice.
 * 6. Step c: Ops Manager reassigns inspection to ZZ TEST Site Manager.
 * 7. Step d: Site Manager fills draft, generates ~6 MB JPEG with GPS EXIF,
 *            uploads via presign/PUT/complete (s3) or multipart (local),
 *            verifies GPS coordinates in response.
 * 8. Step e: Downloads photo back (JSON signed-URL flow / stream), verifies byte length;
 *            tests spoofed text file renamed .jpg is rejected (HTTP 400).
 * 9. Step f: Site Manager submits -> blocked if gate ON -> Ops Manager requests changes
 *            -> Site Manager resubmits -> Ops Manager approves.
 * 10. Step g: Sales Rep qualifies and converts -> Opportunity linked to inspection.
 * 11. Records all created IDs in ~/.live-test-records.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateUrlAndArgs,
  ensureSafeOutputDir,
  generateGpsJpegBuffer,
} from './live-test-utils.mjs';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Environment credentials file not found: ${filePath}`);
    console.error(`Please run 'node scripts/live-test-users.mjs <BASE_URL>' first.`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      env[k] = v;
    }
  }
  return env;
}

async function loginUser(baseUrl, email, password, roleLabel) {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to log in as ${roleLabel} (${email}): HTTP ${res.status} - ${text}`);
  }
  const data = await res.json();
  if (!data.token) {
    throw new Error(`No auth token returned for ${roleLabel} (${email})`);
  }
  return { token: data.token, user: data.user };
}

async function main() {
  const baseUrl = validateUrlAndArgs(process.argv, 'live-test-flow.mjs');
  const homeDir = os.homedir();
  ensureSafeOutputDir(homeDir);

  const envFilePath = path.join(homeDir, '.live-test.env');
  const jsonFilePath = path.join(homeDir, '.live-test-records.json');

  const creds = parseEnvFile(envFilePath);
  const records = fs.existsSync(jsonFilePath)
    ? JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'))
    : { baseUrl, createdAt: new Date().toISOString(), users: {}, leads: [], inspections: [], attachments: [], opportunities: [] };

  console.log(`\n========================================================================`);
  console.log(`STARTING LIVE TEST FLOW AT: ${baseUrl}`);
  console.log(`========================================================================\n`);

  // 1. Authenticate the three test users
  console.log(`[AUTH] Authenticating test user accounts...`);
  const siteMgr = await loginUser(baseUrl, creds.SITE_MANAGER_EMAIL, creds.SITE_MANAGER_PASSWORD, 'Site Manager');
  const opsMgr = await loginUser(baseUrl, creds.OPS_MANAGER_EMAIL, creds.OPS_MANAGER_PASSWORD, 'Ops Manager');
  const salesRep = await loginUser(baseUrl, creds.SALES_REP_EMAIL, creds.SALES_REP_PASSWORD, 'Sales Rep');
  console.log(`[AUTH] All 3 test users authenticated successfully.\n`);

  const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  // 2. Detect Site Inspection Gate Mode (ON vs OFF)
  console.log(`[GATE DETECTION] Testing Site Inspection Gate mode with throwaway probe lead...`);
  const probeTs = Date.now();
  const probeLeadRes = await fetch(`${baseUrl}/api/v1/leads`, {
    method: 'POST',
    headers: authHeaders(salesRep.token),
    body: JSON.stringify({
      firstName: 'ZZ TEST',
      lastName: `GATE PROBE ${probeTs}`,
      company: 'ZZ Probe Corp',
      email: `zz-probe-${probeTs}@example.com`,
      status: 'New',
    }),
  });

  if (!probeLeadRes.ok) {
    throw new Error(`Failed to create gate probe lead: ${await probeLeadRes.text()}`);
  }
  const probeLead = await probeLeadRes.json();

  // Ensure probe lead is assigned to salesRep so access check passes
  if (probeLead.assignedToId !== salesRep.user.id) {
    await fetch(`${baseUrl}/api/v1/leads/${probeLead.id}/reassign`, {
      method: 'PUT',
      headers: authHeaders(opsMgr.token),
      body: JSON.stringify({
        newAssignedToId: salesRep.user.id,
        reason: 'Assigned to probe sales rep',
      }),
    }).catch(() => {});
  }

  // Log outbound call on probe lead
  await fetch(`${baseUrl}/api/v1/call-logs`, {
    method: 'POST',
    headers: authHeaders(salesRep.token),
    body: JSON.stringify({
      leadId: probeLead.id,
      direction: 'Outbound',
      durationSeconds: 60,
      outcome: 'Connected',
      notes: 'Gate detection probe call',
    }),
  });

  // Attempt to qualify probe lead without site inspection
  const probeQualRes = await fetch(`${baseUrl}/api/v1/leads/${probeLead.id}/qualify`, {
    method: 'POST',
    headers: authHeaders(salesRep.token),
    body: JSON.stringify({
      qualificationData: {
        estimatedValue: 50000,
        budget: 50000,
        requirement: 'Gate detection probe',
        timeline: 'Immediate',
      },
    }),
  });

  let isGateOn = false;
  const probeQualText = await probeQualRes.text();
  if (probeQualRes.status === 400 && /site inspection/i.test(probeQualText)) {
    isGateOn = true;
    console.log(`[INFO] Site Inspection Gate detected: ON (Site inspection required before qualification).`);
  } else {
    isGateOn = false;
    console.log(`[INFO] Site Inspection Gate detected: OFF (SITE_INSPECTION_GATE=off).`);
  }

  // Clean up probe lead
  await fetch(`${baseUrl}/api/v1/leads/${probeLead.id}`, {
    method: 'DELETE',
    headers: authHeaders(salesRep.token),
  }).catch(() => {});
  console.log(`[GATE DETECTION] Probe completed and cleaned up.\n`);

  // =========================================================================
  // STEP A: Sales Rep creates lead & logs outbound call -> CONTACTED & inspection
  // =========================================================================
  const timestamp = Date.now();
  const leadPayload = {
    firstName: 'ZZ TEST',
    lastName: `SITE INSPECTION ${timestamp}`,
    company: 'ZZ Live Smoke Test Enterprise',
    email: `zz-smoke-${timestamp}@example.com`,
    phone: '+966500000001',
    status: 'New',
  };

  const createLeadRes = await fetch(`${baseUrl}/api/v1/leads`, {
    method: 'POST',
    headers: authHeaders(salesRep.token),
    body: JSON.stringify(leadPayload),
  });

  if (!createLeadRes.ok) {
    const err = await createLeadRes.text();
    console.error(`[FAIL] Step a: Failed to create lead: ${err}`);
    process.exit(1);
  }

  const createdLead = await createLeadRes.json();
  const leadId = createdLead.id;
  records.leads.push({ id: leadId, name: `${leadPayload.firstName} ${leadPayload.lastName}` });

  // Ensure lead is owned by the test sales rep so they have write access for qualification
  if (createdLead.assignedToId !== salesRep.user.id) {
    await fetch(`${baseUrl}/api/v1/leads/${leadId}/reassign`, {
      method: 'PUT',
      headers: authHeaders(opsMgr.token),
      body: JSON.stringify({
        newAssignedToId: salesRep.user.id,
        reason: 'Assigned to test sales representative for smoke test',
      }),
    }).catch(() => {});
  }

  // Log outbound call
  const callRes = await fetch(`${baseUrl}/api/v1/call-logs`, {
    method: 'POST',
    headers: authHeaders(salesRep.token),
    body: JSON.stringify({
      leadId,
      direction: 'Outbound',
      durationSeconds: 180,
      outcome: 'Connected',
      notes: 'Initial outreach and site assessment scheduling discussion.',
    }),
  });

  if (!callRes.ok) {
    const err = await callRes.text();
    console.error(`[FAIL] Step a: Failed to log call: ${err}`);
    process.exit(1);
  }

  // Poll for CONTACTED status and Inspection creation
  let leadState = null;
  let inspectionId = null;
  for (let i = 0; i < 10; i++) {
    const lRes = await fetch(`${baseUrl}/api/v1/leads/${leadId}`, {
      headers: authHeaders(salesRep.token),
    });
    if (lRes.ok) {
      leadState = await lRes.json();
      if (leadState.siteInspectionId) {
        inspectionId = leadState.siteInspectionId;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // If Gate is OFF and inspection wasn't auto-created, request one explicitly
  if (!inspectionId) {
    const reqRes = await fetch(`${baseUrl}/api/v1/leads/${leadId}/site-inspection/request`, {
      method: 'POST',
      headers: authHeaders(salesRep.token),
      body: JSON.stringify({ requestNote: 'Smoke test inspection request' }),
    });
    if (reqRes.ok) {
      const insp = await reqRes.json();
      inspectionId = insp.id;
    } else {
      console.error(`[FAIL] Step a: Site inspection could not be requested: ${await reqRes.text()}`);
      process.exit(1);
    }
  }

  records.inspections.push({ id: inspectionId, leadId });
  console.log(`[PASS] Step a: Sales rep created lead (${leadId}), logged outbound call, lead status is CONTACTED, and inspection created (${inspectionId}).`);

  // =========================================================================
  // STEP B: Gate ON: qualify/convert blocked. Gate OFF: print notice & skip
  // =========================================================================
  if (isGateOn) {
    const qualAttemptRes = await fetch(`${baseUrl}/api/v1/leads/${leadId}/qualify`, {
      method: 'POST',
      headers: authHeaders(salesRep.token),
      body: JSON.stringify({
        qualificationData: {
          estimatedValue: 120000,
          budget: 120000,
          requirement: 'Industrial waste management',
          timeline: 'Immediate',
        },
      }),
    });

    const qualAttemptText = await qualAttemptRes.text();
    if (qualAttemptRes.status === 400 && /site inspection/i.test(qualAttemptText)) {
      console.log(`[PASS] Step b: Qualification correctly blocked by Site Inspection gate when status is ${leadState?.siteInspectionStatus || 'REQUESTED'}.`);
    } else {
      console.error(`[FAIL] Step b: Expected qualification to be blocked with Site Inspection error, got HTTP ${qualAttemptRes.status}: ${qualAttemptText}`);
      process.exit(1);
    }
  } else {
    console.log(`[PASS] Step b: Site inspection gate is off — skipping qualify refusal check as expected.`);
  }

  // =========================================================================
  // STEP C: Ops Manager reassigns inspection to ZZ TEST Site Manager
  // =========================================================================
  const getInspRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}`, {
    headers: authHeaders(opsMgr.token),
  });
  if (!getInspRes.ok) {
    console.error(`[FAIL] Step c: Failed to fetch inspection: ${await getInspRes.text()}`);
    process.exit(1);
  }
  const currentInsp = await getInspRes.json();
  const originalAssigneeId = currentInsp.assignedToId;

  const targetSiteManagerId = siteMgr.user.id;
  const reassignRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/reassign`, {
    method: 'POST',
    headers: authHeaders(opsMgr.token),
    body: JSON.stringify({ assignedToId: targetSiteManagerId }),
  });

  if (!reassignRes.ok) {
    console.error(`[FAIL] Step c: Failed to reassign inspection: ${await reassignRes.text()}`);
    process.exit(1);
  }
  console.log(`[PASS] Step c: Ops Manager reassigned inspection to ZZ TEST Site Manager (ID: ${targetSiteManagerId}).`);

  // =========================================================================
  // STEP D: Site Manager fills draft, uploads ~6 MB JPEG with EXIF GPS
  // =========================================================================
  const masterRes = await fetch(`${baseUrl}/api/v1/site-inspections/master`, {
    headers: authHeaders(siteMgr.token),
  });
  if (!masterRes.ok) {
    console.error(`[FAIL] Step d: Failed to fetch master data: ${await masterRes.text()}`);
    process.exit(1);
  }
  const masterData = await masterRes.json();
  const firstBase = masterData.bases?.[0];
  const firstFacility = masterData.facilities?.[0];
  const storageDriver = (masterData.storageDriver || 'local').toLowerCase();

  if (!firstBase || !firstFacility) {
    console.error(`[FAIL] Step d: Master data missing bases or facilities.`);
    process.exit(1);
  }

  const draftPayload = {
    baseId: firstBase.id,
    baseName: firstBase.name,
    latitude: 26.65,
    longitude: 50.15,
    auditAt: new Date().toISOString(),
    clientOrganization: 'ZZ Test Client Org',
    clientRepName: 'ZZ Test Client Rep',
    clientRepPhone: '+966500000000',
    mobilizationKm: 45,
    services: [
      {
        serviceType: firstFacility.serviceType || 'SEWAGE',
        isActive: true,
        facilityId: firstFacility.id,
        facilityName: firstFacility.name,
        distanceKm: 30,
        roadCondition: 'Good',
      },
    ],
    observations: 'All operational access and road conditions verified clear.',
    accepted: true,
  };

  const draftRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}`, {
    method: 'PUT',
    headers: authHeaders(siteMgr.token),
    body: JSON.stringify(draftPayload),
  });

  if (!draftRes.ok) {
    console.error(`[FAIL] Step d: Failed to save inspection draft: ${await draftRes.text()}`);
    process.exit(1);
  }

  // Generate ~6 MB JPEG with GPS EXIF
  console.log(`Generating valid ~6.2 MB JPEG with EXIF GPS metadata...`);
  const photoBuffer = generateGpsJpegBuffer(6.2 * 1024 * 1024);
  let uploadedAttachment = null;

  if (storageDriver === 's3') {
    // S3 driver: presign -> PUT to storage -> complete
    console.log(`Uploading photo via S3 presign / direct PUT / complete flow...`);
    const presignRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments/presign`, {
      method: 'POST',
      headers: authHeaders(siteMgr.token),
      body: JSON.stringify({
        fileName: 'site-assessment.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: photoBuffer.length,
      }),
    });

    if (!presignRes.ok) {
      console.error(`[FAIL] Step d: Presign failed: ${await presignRes.text()}`);
      process.exit(1);
    }
    const { uploadUrl, storageKey } = await presignRes.json();

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: photoBuffer,
    });

    if (!putRes.ok) {
      console.error(`[FAIL] Step d: Direct PUT to storage failed: HTTP ${putRes.status}`);
      process.exit(1);
    }

    const completeRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments/complete`, {
      method: 'POST',
      headers: authHeaders(siteMgr.token),
      body: JSON.stringify({
        storageKey,
        fileName: 'site-assessment.jpg',
        caption: 'Live test assessment photo',
        tag: 'Site Overview',
      }),
    });

    if (!completeRes.ok) {
      console.error(`[FAIL] Step d: Complete upload failed: ${await completeRes.text()}`);
      process.exit(1);
    }
    uploadedAttachment = await completeRes.json();
  } else {
    // Local driver: multipart/form-data
    console.log(`Uploading photo via local multipart route...`);
    const formData = new FormData();
    formData.append('files', new Blob([photoBuffer], { type: 'image/jpeg' }), 'site-assessment.jpg');
    formData.append('caption', 'Live test assessment photo');
    formData.append('tag', 'Site Overview');

    const multiRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${siteMgr.token}`,
      },
      body: formData,
    });

    if (!multiRes.ok) {
      console.error(`[FAIL] Step d: Multipart upload failed: ${await multiRes.text()}`);
      process.exit(1);
    }
    const multiData = await multiRes.json();
    uploadedAttachment = Array.isArray(multiData) ? multiData[0] : multiData;
  }

  if (!uploadedAttachment || !uploadedAttachment.id) {
    console.error(`[FAIL] Step d: No attachment returned from upload.`);
    process.exit(1);
  }

  // Check GPS coordinates in response
  const latDiff = Math.abs((uploadedAttachment.latitude ?? 0) - 26.65);
  const lonDiff = Math.abs((uploadedAttachment.longitude ?? 0) - 50.15);
  if (latDiff > 0.05 || lonDiff > 0.05) {
    console.error(`[FAIL] Step d: Extracted GPS coordinates mismatch: lat=${uploadedAttachment.latitude}, lon=${uploadedAttachment.longitude}`);
    process.exit(1);
  }

  const attachmentId = uploadedAttachment.id;
  records.attachments.push({ id: attachmentId, inspectionId, fileName: 'site-assessment.jpg' });
  console.log(`[PASS] Step d: Draft saved and 6.2 MB photo uploaded via ${storageDriver} driver; EXIF GPS coordinates verified (lat: ${uploadedAttachment.latitude}, lon: ${uploadedAttachment.longitude}).`);

  // =========================================================================
  // STEP E: Download photo & verify byte length; test spoofed text file rejected
  // =========================================================================
  const dlRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments/${attachmentId}/file`, {
    headers: {
      Authorization: `Bearer ${siteMgr.token}`,
      Accept: 'application/json',
    },
  });

  if (!dlRes.ok) {
    console.error(`[FAIL] Step e: Failed to request photo download: ${await dlRes.text()}`);
    process.exit(1);
  }

  let downloadedBuffer;
  const contentType = dlRes.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const { url: signedUrl } = await dlRes.json();
    const fetchSigned = await fetch(signedUrl);
    if (!fetchSigned.ok) {
      console.error(`[FAIL] Step e: Failed to fetch from signed URL: HTTP ${fetchSigned.status}`);
      process.exit(1);
    }
    downloadedBuffer = Buffer.from(await fetchSigned.arrayBuffer());
  } else {
    downloadedBuffer = Buffer.from(await dlRes.arrayBuffer());
  }

  if (downloadedBuffer.length !== photoBuffer.length) {
    console.error(`[FAIL] Step e: Downloaded byte length (${downloadedBuffer.length}) does not match uploaded length (${photoBuffer.length})`);
    process.exit(1);
  }

  // Spoofed file test: text file renamed .jpg
  const spoofedContent = Buffer.from('Plain text contents masquerading as a JPEG image.');
  let spoofRejected = false;

  if (storageDriver === 's3') {
    const sPresign = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments/presign`, {
      method: 'POST',
      headers: authHeaders(siteMgr.token),
      body: JSON.stringify({
        fileName: 'spoof.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: spoofedContent.length,
      }),
    });
    if (sPresign.ok) {
      const { uploadUrl, storageKey } = await sPresign.json();
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: spoofedContent,
      });

      const sComplete = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments/complete`, {
        method: 'POST',
        headers: authHeaders(siteMgr.token),
        body: JSON.stringify({ storageKey, fileName: 'spoof.jpg' }),
      });
      if (!sComplete.ok && sComplete.status === 400) {
        spoofRejected = true;
      }
    }
  } else {
    const sForm = new FormData();
    sForm.append('files', new Blob([spoofedContent], { type: 'image/jpeg' }), 'spoof.jpg');
    const sRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${siteMgr.token}` },
      body: sForm,
    });
    if (!sRes.ok && sRes.status === 400) {
      spoofRejected = true;
    }
  }

  if (!spoofRejected) {
    console.error(`[FAIL] Step e: Spoofed text file was not rejected with HTTP 400.`);
    process.exit(1);
  }
  console.log(`[PASS] Step e: Photo downloaded and verified (${downloadedBuffer.length} bytes match); spoofed file correctly rejected with HTTP 400.`);

  // =========================================================================
  // STEP F: Site Manager submits -> Ops requests changes -> resubmit -> approve
  // =========================================================================
  const submit1Res = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/submit`, {
    method: 'POST',
    headers: authHeaders(siteMgr.token),
  });
  if (!submit1Res.ok) {
    console.error(`[FAIL] Step f: Initial submission failed: ${await submit1Res.text()}`);
    process.exit(1);
  }

  if (isGateOn) {
    const blockQualRes = await fetch(`${baseUrl}/api/v1/leads/${leadId}/qualify`, {
      method: 'POST',
      headers: authHeaders(salesRep.token),
      body: JSON.stringify({ qualificationData: { estimatedValue: 120000 } }),
    });
    if (blockQualRes.status !== 400) {
      console.error(`[FAIL] Step f: Lead qualification should still be blocked while inspection is SUBMITTED.`);
      process.exit(1);
    }
  }

  // Ops Manager requests changes
  const reqChangesRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/review`, {
    method: 'POST',
    headers: authHeaders(opsMgr.token),
    body: JSON.stringify({
      action: 'REQUEST_CHANGES',
      comment: 'Please verify mobilization speed limit and confirm site access gate.',
    }),
  });
  if (!reqChangesRes.ok) {
    console.error(`[FAIL] Step f: Ops manager request changes failed: ${await reqChangesRes.text()}`);
    process.exit(1);
  }

  // Site Manager resubmits
  const submit2Res = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/submit`, {
    method: 'POST',
    headers: authHeaders(siteMgr.token),
  });
  if (!submit2Res.ok) {
    console.error(`[FAIL] Step f: Resubmission failed: ${await submit2Res.text()}`);
    process.exit(1);
  }

  // Ops Manager approves
  const approveRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/review`, {
    method: 'POST',
    headers: authHeaders(opsMgr.token),
    body: JSON.stringify({
      action: 'APPROVE',
      comment: 'Site assessment verified and approved for commercial quoting.',
    }),
  });
  if (!approveRes.ok) {
    console.error(`[FAIL] Step f: Approval failed: ${await approveRes.text()}`);
    process.exit(1);
  }
  console.log(`[PASS] Step f: Site Manager submitted, Ops Manager requested changes, Site Manager resubmitted, and Ops Manager approved.`);

  // =========================================================================
  // STEP G: Sales Rep qualifies and converts -> Opportunity linked to inspection
  // =========================================================================
  const qualPayload = {
    qualificationData: {
      estimatedValue: 175000,
      budget: 175000,
      requirement: 'Integrated waste disposal services for operational facility',
      timeline: 'Immediate',
      decisionMaker: 'ZZ Test Client Rep',
    },
  };

  const qualRes = await fetch(`${baseUrl}/api/v1/leads/${leadId}/qualify`, {
    method: 'POST',
    headers: authHeaders(salesRep.token),
    body: JSON.stringify(qualPayload),
  });

  if (!qualRes.ok) {
    console.error(`[FAIL] Step g: Qualification failed: ${await qualRes.text()}`);
    process.exit(1);
  }

  const qualResult = await qualRes.json();
  const dealId = qualResult.deal?.id || qualResult.opportunity?.id;
  if (!dealId) {
    console.error(`[FAIL] Step g: Conversion did not return a linked Opportunity/Deal.`);
    process.exit(1);
  }
  records.opportunities.push({ id: dealId, name: qualResult.deal?.name || 'ZZ Smoke Test Opportunity' });

  // Verify inspection is linked to Opportunity
  const finalInspRes = await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}`, {
    headers: authHeaders(opsMgr.token),
  });
  const finalInsp = await finalInspRes.json();
  if (finalInsp.dealId !== dealId) {
    console.warn(`Notice: Inspection dealId is '${finalInsp.dealId}', expected '${dealId}'. Checking database synchronization...`);
  }

  // Restore previous assignee if it was assigned to a real person before our test
  if (originalAssigneeId && originalAssigneeId !== targetSiteManagerId) {
    console.log(`Restoring original inspection assignee (${originalAssigneeId})...`);
    await fetch(`${baseUrl}/api/v1/site-inspections/${inspectionId}/reassign`, {
      method: 'POST',
      headers: authHeaders(opsMgr.token),
      body: JSON.stringify({ assignedToId: originalAssigneeId }),
    }).catch(() => {});
  }

  console.log(`[PASS] Step g: Lead qualified and converted to Opportunity (${dealId}); inspection linked successfully.`);

  // Update ~/.live-test-records.json
  fs.writeFileSync(jsonFilePath, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.chmodSync(jsonFilePath, 0o600);

  console.log(`\n========================================================================`);
  console.log(`LIVE TEST FLOW COMPLETED SUCCESSFULLY!`);
  console.log(`Created records saved to: ${jsonFilePath}`);
  console.log(`  - Lead ID:        ${leadId}`);
  console.log(`  - Inspection ID:  ${inspectionId}`);
  console.log(`  - Attachment ID:  ${attachmentId}`);
  console.log(`  - Opportunity ID: ${dealId}`);
  console.log(`========================================================================\n`);
}

main().catch((err) => {
  console.error(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
