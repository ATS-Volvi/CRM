---
name: Horizon Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#006399'
  on-secondary: '#ffffff'
  secondary-container: '#7bc2ff'
  on-secondary-container: '#004f7b'
  tertiary: '#924628'
  on-tertiary: '#ffffff'
  tertiary-container: '#b05e3d'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#cde5ff'
  secondary-fixed-dim: '#94ccff'
  on-secondary-fixed: '#001d32'
  on-secondary-fixed-variant: '#004b74'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#773215'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  sidebar-width: 260px
  gutter: 20px
---

## Brand & Style

This design system is engineered for high-velocity B2B sales environments across the Gulf and South Asia markets. The brand personality is authoritative yet accessible, prioritizing clarity and speed of thought. The visual style follows a **Modern Corporate** aesthetic—a refined evolution of SaaS patterns that balances data density with visual breathing room. 

The emotional response is one of "calm control." By utilizing a disciplined grid and a professional color palette, the UI reduces the cognitive load associated with complex CRM workflows. It avoids decorative flourishes in favor of functional elegance, ensuring that regional sales teams can navigate deep data structures with precision.

## Colors

The palette is anchored by a dual-tone professional core. Teal (#0D9488) serves as the primary action color, providing a fresh, modern energy suitable for growth-oriented markets, while the secondary Deep Blue (#0369A1) is used for structural elements and navigation to establish trust.

The neutral scale utilizes slate-toned greys to prevent visual fatigue. Semantic colors are strictly reserved for status communication:
- **Success:** Positive revenue milestones and won deals.
- **Warning:** Stale leads or upcoming task deadlines.
- **Danger:** Lost opportunities or overdue payments.
- **Info:** System sync status and neutral updates.

The interface defaults to a high-contrast Light Mode to ensure legibility in brightly lit office environments common in the target regions.

## Typography

Inter is the sole typeface for this design system, chosen for its exceptional legibility in data-heavy SaaS applications. The scale is designed to handle high information density without sacrificing hierarchy.

- **Data Tables:** Use the `data-tabular` style which enables tabular numpfing (tnum) to ensure numbers align vertically for easy comparison in financial reports.
- **Hierarchy:** Use `label-caps` for section headers within sidebars or card headers to provide clear structural anchoring.
- **Mobile:** Headlines scale down to prevent awkward wrapping on handheld devices used by field agents.

## Layout & Spacing

The layout utilizes a **Fixed Grid** approach for desktop to maintain a consistent dashboard experience across various monitor sizes, centering the content once the viewport exceeds 1440px.

- **Navigation:** A persistent 260px left sidebar houses the primary application modules (Leads, Accounts, Pipeline).
- **Utility Bar:** A top bar (64px height) contains global search, notifications, and real-time sync indicators.
- **Content Area:** Uses a 12-column grid. For data-heavy views, cards typically span 4, 6, or 12 columns.
- **Density:** High-density tables use 8px vertical cell padding, while standard forms and cards use 24px padding to maintain professional breathing room.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and subtle ambient shadows. The background uses a light slate tint (#F8FAFC), while interactive surfaces (cards, modals) are pure white.

- **Surface Level 0 (Background):** Page canvas.
- **Surface Level 1 (Default):** White cards with a 1px border in #E2E8F0. No shadow.
- **Surface Level 2 (Hover/Active):** Cards gain a soft, diffused shadow (0px 4px 12px rgba(0,0,0,0.05)) to indicate interactivity.
- **Surface Level 3 (Modals/Popovers):** Higher elevation with a 0px 20px 25px -5px rgba(0,0,0,0.1) shadow to focus the user's attention.

Avoid heavy blurs or glassmorphism to keep the focus on data clarity and performance.

## Shapes

The design system adopts a **Soft** shape language. This provides a professional, modern feel that isn't as aggressive as sharp corners nor as casual as pill-shaped designs.

- **Standard Elements:** Buttons, input fields, and small cards use a 4px (0.25rem) radius.
- **Containers:** Large dashboard widgets and main cards use a 8px (0.5rem) radius.
- **Status Chips:** Small badges use a 12px (0.75rem) radius to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Teal (#0D9488) with white text.
- **Secondary:** Outline Blue (#0369A1) with white background.
- **Ghost:** No border or background, used for secondary actions in tables.

### Data Tables
Tables are the core of the CRM. Use a "Zebra" striping pattern or subtle dividers (#F1F5F9). Headers are sticky and use the `label-caps` typography style. Cell height should be 40px for high density or 56px for standard views.

### Status Chips
Small, high-contrast badges used for "Lead Status" or "Deal Stage." Use the semantic color palette with a 10% opacity background of the same hue for a modern "tinted" look (e.g., Success Green text on a 10% Green background).

### Input Fields
Inputs use a 1px slate border that thickens and turns Teal on focus. Labels should always be visible above the field in `body-sm` bold.

### Real-Time Sync Indicator
A small, pulsating dot in the top utility bar. Green indicates "Synced," while Amber indicates "Syncing..." to provide reassurance for field agents in areas with intermittent connectivity.

### Progress Bars
Used for "Pipeline Stages." A horizontal segmented bar where completed stages are solid Teal and current stages are Blue.