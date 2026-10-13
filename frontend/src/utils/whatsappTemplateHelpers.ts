/**
 * Helper utilities for WhatsApp Content Templates
 */

export interface PreviewSegment {
  text: string;
  isHighlight: boolean;
  varKey?: string;
  resolvedValue?: string;
}

/**
 * Extracts ordered variable placeholder keys from template body (e.g. {{1}}, {{name}}),
 * deduplicating and unioning with any keys in Twilio's variables map.
 */
export const extractTemplateVariables = (
  body: string,
  twilioVariables?: Record<string, any>
): string[] => {
  const vars: string[] = [];
  const seen = new Set<string>();

  if (body) {
    const regex = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        vars.push(key);
      }
    }
  }

  if (twilioVariables && typeof twilioVariables === "object") {
    for (const key of Object.keys(twilioVariables)) {
      if (!seen.has(key)) {
        seen.add(key);
        vars.push(key);
      }
    }
  }

  return vars;
};

/**
 * Auto-suggests a default placeholder mapping (e.g. {{firstName}}, {{company}}, {{campaignName}})
 * by analyzing words preceding or surrounding the variable in bodyText or inspecting the variable key / sample value.
 */
export const suggestDefaultVariableValue = (
  variableKey: string,
  bodyText: string,
  sampleValue?: string
): string => {
  const cleanBody = String(bodyText || "");
  const cleanSample = String(sampleValue || "").toLowerCase();
  const cleanKey = String(variableKey || "").toLowerCase();

  const escapedKey = variableKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, "i");
  const match = regex.exec(cleanBody);
  const keyIndex = match ? match.index : -1;
  const matchLen = match ? match[0].length : 0;

  const textBefore = keyIndex > 0 ? cleanBody.slice(Math.max(0, keyIndex - 60), keyIndex).toLowerCase() : "";
  const textAfter = keyIndex >= 0 ? cleanBody.slice(keyIndex + matchLen, keyIndex + matchLen + 60).toLowerCase() : "";

  // 1. Last name / honorifics (Mr., Ms., Dr., surname) or key explicitly naming surname/last name
  if (
    cleanKey.includes("last") ||
    cleanKey.includes("surname") ||
    cleanSample.includes("last") ||
    cleanSample.includes("surname") ||
    /\b(?:mr\.?|ms\.?|mrs\.?|dr\.?|surname|family|last name)\b/i.test(textBefore)
  ) {
    return "{{lastName}}";
  }

  // 2. Company / organization indications (from {{x}}, at {{x}}, welcome to {{x}})
  if (
    /\b(?:from|at|with|welcome to|colleagues at|team at|company|organization|firm|business|employed at)\b/i.test(
      textBefore
    )
  ) {
    return "{{company}}";
  }

  // 3. Campaign / promotion indications
  if (
    /\b(?:campaign|offer|promo|promotion|event|webinar|discount)\b/i.test(textBefore) ||
    /\b(?:campaign|offer|promo|promotion|event|webinar|discount)\b/i.test(textAfter) ||
    cleanKey.includes("promo") ||
    cleanKey.includes("campaign")
  ) {
    return "{{campaignName}}";
  }

  // 4. First name / greeting indications (Hi, Hello, Dear)
  if (/\b(?:hi|hello|dear|hey|greetings|hola)\b/i.test(textBefore)) {
    return "{{firstName}}";
  }

  // 5. Sample value or key name hints
  if (
    cleanSample.includes("first") ||
    cleanSample.includes("name") ||
    cleanSample.includes("alex") ||
    cleanSample.includes("john") ||
    cleanKey.includes("first") ||
    cleanKey.includes("name")
  ) {
    return "{{firstName}}";
  }

  if (
    cleanSample.includes("company") ||
    cleanSample.includes("corp") ||
    cleanSample.includes("inc") ||
    cleanKey.includes("company") ||
    cleanKey.includes("org")
  ) {
    return "{{company}}";
  }

  if (cleanSample.includes("campaign") || cleanSample.includes("offer") || cleanSample.includes("promo")) {
    return "{{campaignName}}";
  }

  // 6. Positional fallbacks
  if (variableKey === "1") return "{{firstName}}";
  if (variableKey === "2") return "{{company}}";
  if (variableKey === "3") return "{{campaignName}}";

  return "{{firstName}}";
};

export interface SampleLeadData {
  firstName: string;
  lastName: string;
  company: string;
  campaignName: string;
}

export const DEFAULT_SAMPLE_LEAD: SampleLeadData = {
  firstName: "Alex",
  lastName: "Taylor",
  company: "Acme Corp",
  campaignName: "Special Outreach"
};

/**
 * Builds preview segments highlighting substituted variable values
 */
export const buildPreviewSegments = (
  body: string,
  variables: Array<{ key: string; value: string }>,
  useCustomerNames: boolean = false,
  sampleLead: SampleLeadData = DEFAULT_SAMPLE_LEAD
): PreviewSegment[] => {
  if (!body) return [];

  // Create lookup map of variableKey -> resolved value
  const valMap = new Map<string, string>();
  for (const v of variables) {
    const rawVal = v.value.trim();
    let resolved = "";
    if (rawVal === "{{firstName}}") {
      resolved = useCustomerNames ? sampleLead.firstName : "Customer";
    } else if (rawVal === "{{lastName}}") {
      resolved = useCustomerNames ? sampleLead.lastName : "";
    } else if (rawVal === "{{company}}") {
      resolved = sampleLead.company;
    } else if (rawVal === "{{campaignName}}") {
      resolved = sampleLead.campaignName;
    } else if (rawVal) {
      // Custom text or mixed text
      resolved = rawVal
        .replace(/{{\s*firstName\s*}}/gi, useCustomerNames ? sampleLead.firstName : "Customer")
        .replace(/{{\s*lastName\s*}}/gi, useCustomerNames ? sampleLead.lastName : "")
        .replace(/{{\s*company\s*}}/gi, sampleLead.company)
        .replace(/{{\s*campaignName\s*}}/gi, sampleLead.campaignName);
    } else {
      resolved = "Customer";
    }
    valMap.set(v.key, resolved || "Customer");
  }

  const segments: PreviewSegment[] = [];
  const regex = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    const start = match.index;
    const end = regex.lastIndex;
    const varKey = match[1];

    if (start > lastIndex) {
      segments.push({
        text: body.slice(lastIndex, start),
        isHighlight: false
      });
    }

    const resolvedValue = valMap.get(varKey) || "Customer";
    segments.push({
      text: resolvedValue,
      isHighlight: true,
      varKey,
      resolvedValue
    });

    lastIndex = end;
  }

  if (lastIndex < body.length) {
    segments.push({
      text: body.slice(lastIndex),
      isHighlight: false
    });
  }

  return segments;
};
