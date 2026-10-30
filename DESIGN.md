# DESIGN.md - Personal Finance Dashboard (Revolut & Stripe Inspired)

> Design System specification for AI coding agents and frontend implementation.
> Inspired by the precision, typography, and visual hierarchy of **Revolut** and **Stripe**.

---

## 1. Brand & Design Philosophy
- **Core Character**: Premium Digital Banking & Fintech Precision.
- **Visual Rhythm**: High breathing room, crisp 1px hairline borders, generous white space, and authoritative data hierarchy.
- **Density**: High clarity with balanced density; data points feel grounded, not crowded.

---

## 2. Design Tokens

### 2.1 Color Palette

**Source of truth: [`src/theme/tokens.ts`](src/theme/tokens.ts).** It feeds both `tailwind.config.ts`
(utility classes) and Recharts (raw hex). Components must not hard-code hex values — add a token instead.

| Role | Token / class | Value |
|---|---|---|
| Page background (warm cream) | `bg-canvas` | `#FBF9F5` |
| Card surface / hover | `bg-surface`, `hover:bg-surface-hover` | `#FFFFFF` / `#F5F2EB` |
| Hairline border | `border-line` | `#ECE7DE` |
| Text primary / secondary / caption | `text-ink`, `text-ink-muted`, `text-ink-subtle` | `#0F172A` / `#64748B` / `#94A3B8` |
| Primary (teal) | `bg-primary`, `primary-strong`, `primary-deep`, `primary-soft` | `#0D9488` / `#0F766E` / `#042F2E` / `#2DD4BF` |
| Gold accent (sidebar active, highlights) | `gold`, `gold-strong`, `gold-deep` | `#E5A93C` / `#D4982E` / `#B87C1E` |
| Dark sidebar & dark cards | `bg-night`, `night-raised`, `night-card`, `night-line` | `#111A18` / `#182622` / `#14201D` / `#233530` |
| Warning (large amounts, averages) | `palette.warning` / `amber-500` | `#F59E0B` |
| Over budget | `rose-600` / `rose-500` | `#E11D48` |

### 2.2 Category Color Mapping
Use `categoryColor(category)` from `src/theme/tokens.ts` for chart fills and dots.
- **生活**: `#0D9488` (Teal) · **家用**: `#2563EB` (Blue) · **社交**: `#EC4899` (Pink) · **娛樂**: `#D97706` (Amber 600) · **雜支**: `#4A3AA7` (Deep violet)
- Stacked charts always use this fixed order bottom → top. The set passes the dataviz palette validator for adjacent pairs
  (lightness band, chroma floor, CVD separation, 3:1 contrast); identity is also carried by legends, labels and tooltips.

### 2.2b Budgets
- Per-category monthly budgets come from the 「預算設定」 sheet (GAS `setupBudgetSheet()` creates it).
- Categories without a budget fall back to a reference split of the six-month average and are labelled 「參考」.
- Over-budget states always carry text (「超支 120%」), never color alone.

### 2.2c Mobile first screen
On `< sm` the dashboard opens with `MonthOverviewCard`: spent this month, budget remaining
(with daily allowance for the current month), and the five most recent records.

### 2.3 Typography
- **Primary Font**: `Plus Jakarta Sans` (Latin and digits, the only web font) → system Traditional Chinese UI font:
  `PingFang TC` (Apple) · `Noto Sans TC` / `Noto Sans CJK TC` (local / Android) · `Microsoft JhengHei UI` (Windows).
  Defined once as Tailwind `fontFamily.sans`; no CJK web font is downloaded.
- **Number Treatment**: `tabular-nums` (`font-variant-numeric: tabular-nums`) for jitter-free alignment.
- **Tracking**:
  - Display Numbers: `-0.03em` (`tracking-tight`)
  - Headings: `-0.015em`
  - Labels & Eyebrows: `0.05em` (`tracking-wider`, uppercase)

### 2.4 Surface & Elevation
- **Card Shadow**: `0 1px 3px 0 rgba(0,0,0,0.03), 0 6px 16px -4px rgba(15,23,42,0.04)`
- **Hover Elevation**: `0 8px 24px -4px rgba(15,23,42,0.08), 0 2px 6px -1px rgba(0,0,0,0.02)`
- **Border**: `1px solid rgba(226, 232, 240, 0.9)`
- **Border Radius**:
  - Metric Cards: `24px` (`rounded-3xl`)
  - Container / Charts: `24px` (`rounded-3xl`)
  - Pills & Badges: `9999px` (`rounded-full`)
  - Buttons & Inputs: `12px` (`rounded-xl`)

---

## 3. Micro-interactions
- **Active state**: `active:scale-[0.98]` on buttons and actionable cards.
- **Live Beacon**: Pulsing green dot with `box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2)`.
- **Chart Tooltip**: Glassmorphism (`backdrop-blur-md bg-slate-900/90 text-white border border-white/10 rounded-2xl`).
