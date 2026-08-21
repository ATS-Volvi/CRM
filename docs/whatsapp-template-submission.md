# WhatsApp Business Template Submission Guide

> This document was generated from the actual code in `communicationService.ts` (template
> body text) and `whatsappController.ts` (variable merge block). Copy-paste the wording
> below verbatim into Meta/WhatsApp Manager. Do **not** alter placeholder syntax.

---

## Template 1 — Arabic (AR)

| Field              | Value |
|--------------------|-------|
| **Template Name**  | `call_summary_ar` |
| **Language**       | Arabic – `ar` |
| **Category**       | UTILITY |
| **Channel**        | WhatsApp Business |

### Body Text

```
مرحباً {{1}}، شكراً لوقتك في المكالمة. ملخص المناقشة: {{2}}. {{3}}
```

### Variable Mapping (populated at send time)

| Placeholder | Source field | Example |
|-------------|-------------|---------|
| `{{1}}` | Lead full name (`firstName + lastName`) | `محمد العمري` |
| `{{2}}` | Call notes entered by rep after logging the call | `تمت مناقشة متطلبات المشروع والميزانية والجدول الزمني` |
| `{{3}}` | Static next-step line (hardcoded) | `يرجى التواصل مع ممثلك لأي استفسارات إضافية.` |

### Sample Message (as it will appear to the customer)

```
مرحباً محمد العمري، شكراً لوقتك في المكالمة. ملخص المناقشة: تمت مناقشة متطلبات المشروع والميزانية والجدول الزمني. يرجى التواصل مع ممثلك لأي استفسارات إضافية.
```

---

## Template 2 — English (EN)

| Field              | Value |
|--------------------|-------|
| **Template Name**  | `call_summary_en` |
| **Language**       | English – `en` |
| **Category**       | UTILITY |
| **Channel**        | WhatsApp Business |

### Body Text

```
Hello {{1}}, thank you for your time on the call. Here is a summary of our discussion: {{2}}. {{3}}
```

### Variable Mapping (populated at send time)

| Placeholder | Source field | Example |
|-------------|-------------|---------|
| `{{1}}` | Lead full name (`firstName + lastName`) | `Ahmed Al-Rashid` |
| `{{2}}` | Call notes entered by rep after logging the call | `Discussed project scope, pricing, and next steps for the facility fit-out` |
| `{{3}}` | Static next-step line (hardcoded) | `Please contact your representative if you have any questions.` |

### Sample Message (as it will appear to the customer)

```
Hello Ahmed Al-Rashid, thank you for your time on the call. Here is a summary of our discussion: Discussed project scope, pricing, and next steps for the facility fit-out. Please contact your representative if you have any questions.
```

---

## Post-Approval Steps

After Meta approves both templates and Twilio assigns `HX...` Content SIDs:

1. Open the CRM → **Master Data → Templates** tab.
2. Find the row named **"WhatsApp Call Summary (Arabic)"** and click **Edit**.
3. Paste the approved **Twilio Content SID** (starts with `HX`) into the **Twilio Content SID** field and click **Save**.
4. Repeat for **"WhatsApp Call Summary (English)"**.
5. Run the smoke test to confirm end-to-end send works with a real number:
   ```bash
   cd backend && npm run smoke:whatsapp-template -- +9665XXXXXXXX
   ```

> [!CAUTION]
> **Do not** run the smoke test until both template rows have real `HX...` SIDs.
> The script will refuse to proceed if stub values are detected.

---

## Code References

- Template bodies: [`backend/src/services/communicationService.ts`](../backend/src/services/communicationService.ts) lines 88–109
- Variable merge block: [`backend/src/controllers/whatsappController.ts`](../backend/src/controllers/whatsappController.ts) lines 185–189
- Service dispatch: [`backend/src/services/whatsappService.ts`](../backend/src/services/whatsappService.ts) — `sendWhatsAppTemplateMessage()`
