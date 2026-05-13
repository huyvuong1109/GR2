---
name: Premium Financial Analytics System
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#adc6ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#00163a'
  on-tertiary-container: '#357df1'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  data-point-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

The brand personality is authoritative yet approachable, designed to instill a sense of calm confidence in long-term value investors. This design system moves away from the frantic "day-trader" aesthetic, instead embracing a **High-End Sophisticated** style that prioritizes clarity, depth, and prestige.

The visual direction utilizes **Glassmorphism** to create a sense of multi-layered intelligence. By using semi-transparent surfaces and blurred backgrounds, the UI suggests a window into complex data that has been refined into actionable insights. The style is professional and "Architectural," using precise lines and intentional whitespace to communicate institutional-grade reliability. Every interaction should feel deliberate and high-value, reinforcing the user's trust in the platform's analytical integrity.

## Colors

This design system supports two distinct themes: **Midnight** (Default) and **Clean Light**.

### Midnight Theme
- **Base:** Deep Navy (`#0F172A`) and Slate (`#1E293B`) form the foundational layers.
- **Accents:** Emerald (`#10B981`) is reserved strictly for growth, positive trends, and "Buy" signals. A sophisticated Blue (`#3B82F6`) is used for primary actions and interactive elements.
- **Surface:** Glass layers use a 60% opacity version of the slate background with a high saturation backdrop blur.

### Clean Light Theme
- **Base:** Ultra-clean White (`#FFFFFF`) with soft grey borders (`#E2E8F0`).
- **Accents:** The same Emerald and Blue accents are applied but with higher saturation to ensure contrast against the bright background.

### Semantic Tones
- **Success:** Emerald 500 for growth metrics.
- **Caution:** Amber 500 for market volatility.
- **Alert:** Rose 500 for loss or risk-heavy data points.

## Typography

The typography strategy focuses on a high-contrast hierarchy to make complex data readable at a glance. 

**Manrope** is used for headlines and display elements to provide a modern, balanced, and refined feel. **Inter** is utilized for body text and data points due to its exceptional legibility and systematic performance.

For financial figures and "Data Points," we employ a higher weight and slight letter spacing to ensure that numbers are the most prominent elements on the page. Labels use uppercase styling with increased tracking to create a clear distinction between structural metadata and content.

## Layout & Spacing

The system employs a **12-column fixed grid** for desktop, centered within the viewport to maintain a premium "editorial" feel. 

### Spacing Rhythm
- **The 8px Rule:** All padding and margins are increments of 8px (8, 16, 24, 32, 48, 64).
- **Gaps:** Use 24px gutters between analytics cards to allow the "Glass" effects to have breathing room.
- **Margins:** Large 64px outer margins on desktop create a focused, centered workspace.

### Responsive Behavior
- **Desktop (1440px+):** 12 columns, 64px margins.
- **Tablet (768px - 1439px):** 8 columns, 32px margins.
- **Mobile (< 767px):** 4 columns, 20px margins. Analytics cards stack vertically.

## Elevation & Depth

Depth is the primary differentiator of this design system. It is achieved through a combination of three techniques:

1.  **Multi-Layered Shadows:** Instead of a single shadow, components use a "Global Ambient" shadow (large blur, low opacity) and a "Contact" shadow (small blur, slightly higher opacity) to create a realistic floating effect.
2.  **Glassmorphism:** Foreground cards use `backdrop-filter: blur(20px)` with a 1px "Inner Border" (semi-transparent white or slate) to simulate the edge of a glass pane.
3.  **Subtle Gradients:** Backgrounds are never flat. A radial gradient should emanate from the top-left corner (Primary Blue) to the bottom-right (Midnight Navy) to provide a sense of atmospheric light.

## Shapes

The shape language is **Rounded**, striking a balance between the clinical sharpness of legacy finance tools and the overly-round friendliness of consumer apps.

- **Standard Cards:** 1rem (16px) corner radius.
- **Buttons & Inputs:** 0.5rem (8px) corner radius.
- **Small Tags/Chips:** Full pill-shape for high contrast against rectangular data grids.

Crisp, 1px borders are mandatory for all shaped elements to maintain a "high-definition" look, especially when using glass effects.

## Components

### Floating Cards
The cornerstone of the UI. Cards must have a 1px border (`#FFFFFF10` in dark mode) and a multi-layered shadow. They should appear to float at different "altitudes" depending on their importance.

### Buttons
- **Primary:** Solid Blue gradient with a subtle inner glow. 
- **Secondary:** Ghost style with a blurred background and a 1px border.
- **Tertiary:** Text-only with an emerald hover state for growth-related actions.

### Data Visualization
- **Line Charts:** Use "Emerald" for the stroke with a soft gradient fill beneath the line.
- **Tooltips:** Must use the Glassmorphism style with a heavy backdrop blur to ensure legibility over complex charts.

### Input Fields
Sophisticated, dark-themed inputs with a 1px slate border that glows Blue on focus. Labels sit strictly above the field in the `label-sm` typography style.

### Portfolio Lists
High-density rows with subtle dividers. Each row should have a hover state that slightly increases its "altitude" using a stronger shadow and a 5% increase in background opacity.