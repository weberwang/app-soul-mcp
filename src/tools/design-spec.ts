import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

// The JSON schema that Copilot must return. Used in the prompt below.
const DESIGN_SPEC_SCHEMA = `{
  "_thought": "string, // Record your step-by-step reasoning (Phase 1) here. Calculate contrast ratios and explain your tinted neutrals. BAN pure grey/black/white.",
  "colorTokens": {
    "light": {
      // ── Surfaces ──────────────────────────────────────────────────────────
      "surfacePrimary":        string,  // main app background (scaffold)
      "surfaceSecondary":      string,  // cards, list items, elevated panels
      "surfaceTertiary":       string,  // nested cards, inner panels
      "surfaceTint":           string,  // modal scrims, overlay tints
      "surfaceInverse":        string,  // tooltip / snackbar background (dark on light)

      // ── Text / Ink ────────────────────────────────────────────────────────
      "inkPrimary":            string,  // headlines, body copy on surfacePrimary
      "inkSecondary":          string,  // captions, metadata, helper text
      "inkTertiary":           string,  // placeholder text, very muted labels
      "inkDisabled":           string,  // disabled text and icons
      "inkOnAccent":           string,  // text/icons placed directly on accentPrimary
      "inkOnSurfaceInverse":   string,  // text on surfaceInverse (tooltip / snackbar)
      "inkLink":               string,  // hyperlinks, tappable inline text
      "inkOnImage":            string,  // text overlaid on photos/cards with image bg

      // ── Accent / Interactive ──────────────────────────────────────────────
      "accentPrimary":         string,  // main CTA, active tabs, selected state
      "accentSecondary":       string,  // secondary actions, toggle on-state
      "accentSubtle":          string,  // soft ~15% tint of accentPrimary (highlight bg)

      // ── Borders & Separators ──────────────────────────────────────────────
      "borderSubtle":          string,  // list dividers, card outlines
      "borderStrong":          string,  // focused input rings, emphasized separators
      "borderInteractive":     string,  // unfocused input border

      // ── Status ────────────────────────────────────────────────────────────
      "statusSuccess":         string,
      "statusSuccessSubtle":   string,  // success badge / tag background
      "statusSuccessInk":      string,  // text on statusSuccessSubtle
      "statusWarning":         string,
      "statusWarningSubtle":   string,
      "statusWarningInk":      string,
      "statusError":           string,
      "statusErrorSubtle":     string,
      "statusErrorInk":        string,
      "statusInfo":            string,
      "statusInfoSubtle":      string,
      "statusInfoInk":         string,

      // ── Navigation ────────────────────────────────────────────────────────
      "navBarBackground":      string,  // bottom nav / tab bar background
      "navBarActiveIcon":      string,  // selected tab icon + label
      "navBarInactiveIcon":    string,  // unselected tab icons
      "navBarIndicator":       string,  // active tab pill / underline
      "appBarBackground":      string,  // top app bar / header background
      "appBarInk":             string,  // title and icons in app bar

      // ── Input & Form ──────────────────────────────────────────────────────
      "inputFill":             string,  // text field background
      "inputFillFocused":      string,  // focused state fill
      "inputInk":              string,  // typed text color
      "inputPlaceholder":      string,  // placeholder text
      "inputBorder":           string,  // default border
      "inputBorderFocused":    string,  // focused border (usually accentPrimary)
      "inputBorderError":      string,  // error state border
      "inputLabelActive":      string,  // floating label when focused

      // ── Framework System Colors ───────────────────────────────────────────
      "frameworkPrimary":            string,  // Flutter ColorScheme.primary / CSS --color-primary
      "frameworkOnPrimary":          string,  // text/icons on frameworkPrimary
      "frameworkPrimaryContainer":   string,  // tonal container / secondary brand surface
      "frameworkOnPrimaryContainer": string,
      "frameworkSecondary":          string,  // secondary brand hue (FAB alt, toggles)
      "frameworkOnSecondary":        string,
      "frameworkSurface":            string,  // default scaffold / page background
      "frameworkOnSurface":          string,  // default body text
      "frameworkSurfaceVariant":     string,  // input fills, chips, quiet containers
      "frameworkOnSurfaceVariant":   string,
      "frameworkOutline":            string,  // default border / divider
      "frameworkOutlineVariant":     string,  // subtle dividers inside cards
      "frameworkError":              string,
      "frameworkOnError":            string,
      "frameworkScrim":              string   // modal backdrop
    },
    "dark": {
      "surfacePrimary":        string,
      "surfaceSecondary":      string,
      "surfaceTertiary":       string,
      "surfaceTint":           string,
      "surfaceInverse":        string,
      "inkPrimary":            string,
      "inkSecondary":          string,
      "inkTertiary":           string,
      "inkDisabled":           string,
      "inkOnAccent":           string,
      "inkOnSurfaceInverse":   string,
      "inkLink":               string,
      "inkOnImage":            string,
      "accentPrimary":         string,
      "accentSecondary":       string,
      "accentSubtle":          string,
      "borderSubtle":          string,
      "borderStrong":          string,
      "borderInteractive":     string,
      "statusSuccess":         string,
      "statusSuccessSubtle":   string,
      "statusSuccessInk":      string,
      "statusWarning":         string,
      "statusWarningSubtle":   string,
      "statusWarningInk":      string,
      "statusError":           string,
      "statusErrorSubtle":     string,
      "statusErrorInk":        string,
      "statusInfo":            string,
      "statusInfoSubtle":      string,
      "statusInfoInk":         string,
      "navBarBackground":      string,
      "navBarActiveIcon":      string,
      "navBarInactiveIcon":    string,
      "navBarIndicator":       string,
      "appBarBackground":      string,
      "appBarInk":             string,
      "inputFill":             string,
      "inputFillFocused":      string,
      "inputInk":              string,
      "inputPlaceholder":      string,
      "inputBorder":           string,
      "inputBorderFocused":    string,
      "inputBorderError":      string,
      "inputLabelActive":      string,
      "frameworkPrimary":            string,
      "frameworkOnPrimary":          string,
      "frameworkPrimaryContainer":   string,
      "frameworkOnPrimaryContainer": string,
      "frameworkSecondary":          string,
      "frameworkOnSecondary":        string,
      "frameworkSurface":            string,
      "frameworkOnSurface":          string,
      "frameworkSurfaceVariant":     string,
      "frameworkOnSurfaceVariant":   string,
      "frameworkOutline":            string,
      "frameworkOutlineVariant":     string,
      "frameworkError":              string,
      "frameworkOnError":            string,
      "frameworkScrim":              string
    }
  },
  "typography": {
    "fontFamilies": {
      "display": string,   // headline font stack
      "body":    string,   // body text stack
      "mono":    string    // monospace stack for code/timestamps
    },
    "scale": [
      {
        "token":         string,  // e.g. "displayLarge", "bodyMedium", "labelSmall"
        "sizePx":        number,
        "weight":        number,
        "lineHeight":    number,  // multiplier, e.g. 1.5
        "letterSpacing": number,  // em units
        "usage":         string   // one-line description of where to use this token
      }
    ]
  },
  "spacing": {
    "baseUnit": number,           // 4 or 8
    "scale": {
      "xs":  number,
      "sm":  number,
      "md":  number,
      "lg":  number,
      "xl":  number,
      "2xl": number,
      "3xl": number
    }
  },
  "borderRadius": {
    "sm":   number,   // row-level elements, chips
    "md":   number,   // input fields, small cards
    "lg":   number,   // main cards, bottom sheets
    "xl":   number,   // large surfaces, dialogs
    "full": number    // pills, avatars
  },
  "motion": {
    "durationFast":    number,    // ms — micro interactions (icon state, ripple)
    "durationDefault": number,    // ms — standard transitions
    "durationSlow":    number,    // ms — page-level transitions, reveal
    "easing":          string,    // CSS cubic-bezier or Flutter Curves name
    "principles":      string[]   // 3-5 motion design guidelines
  },
  "components": {
    "button": {
      "height":         number,
      "radius":         number,
      "labelTypography": string,  // typography token name
      "paddingH":       number,
      "notes":          string
    },
    "card": {
      "padding": number,
      "radius":  number,
      "elevation": string,        // "none" / "low" / "medium" description
      "notes":   string
    },
    "inputField": {
      "height": number,
      "radius": number,
      "notes":  string
    },
    "listTile": {
      "paddingV": number,
      "paddingH": number,
      "divider":  string          // "none" / "subtle line" / etc.
    },
    "bottomSheet": {
      "topRadius": number,
      "notes":     string
    }
  },
  "patterns": {
    "emptyState":      string,    // visual and copy approach
    "loadingState":    string,    // shimmer / skeleton / fade approach
    "errorState":      string,    // how to present errors without alarm
    "successFeedback": string     // how to confirm actions (no SnackBar / Toast)
  },
  "accessibility": {
    "minimumContrastRatio":  number,  // WCAG AA = 4.5
    "minimumTapTargetPx":    number,  // 44 recommended
    "notes":                 string[]
  },
  "antiPatterns": string[],
  "platformNotes": string
}`;

export function registerDesignSpecTools(server: McpServer): void {
  server.tool(
    "get_design_spec_prompt",
    "Returns a ready-to-use prompt for generating a comprehensive UI/UX design specification. The spec covers semantic color tokens (light + dark), typography scale, spacing system, component dimensions, motion guidelines, state patterns, and accessibility requirements — everything needed to guide implementation of the presentation layer.",
    {
      appName: z.string().describe("Name of the app"),
      platform: z
        .string()
        .default("Flutter/Dart")
        .describe(
          "Target platform (e.g. 'Flutter/Dart', 'React Native', 'Web/CSS')",
        ),
      brandGuide: z
        .string()
        .describe(
          "Brand guide JSON string (from save_brand_guide / load_brand_guide)",
        ),
      moodBoardAnalysis: z
        .string()
        .default("")
        .describe(
          "Visual analysis from the mood board — extracted palette, visual metaphors, atmosphere. Leave empty if skipped.",
        ),
    },
    async ({ appName, platform, brandGuide, moodBoardAnalysis }) => {
      const moodSection = moodBoardAnalysis.trim()
        ? `Mood Board Visual Analysis (extracted from reference images):\n${moodBoardAnalysis}\n`
        : "";

      const prompt = `You are a senior UI/UX design systems engineer creating a production-ready design specification.

App: ${appName}
Platform: ${platform}

Brand Guide:
${brandGuide}

${moodSection}
## Phase 1 — Establish the Color System Foundation

Before filling any token, design the complete color system as a whole. A color system is not a list of hex values — it is a set of intentional relationships that must hold across every screen, every state, and both themes simultaneously.

Work through these layers in order:

**1. Source palette (3–5 hues)**
Derive from brand guide colorDirection + mood board. Identify:
- Brand hue (becomes accent / primary)
- Neutral family (drives all surfaces and ink)
- Supporting hue(s) for secondary actions and status

**2. Tonal scales**
For each hue, build a tonal scale (10 steps, ~5%–95% lightness). These become your token pool.

**3. Theme pairing**
Assign tones to roles such that the SAME role token looks correct in BOTH themes:
- Light theme: surfaces are high-lightness tones; ink is low-lightness
- Dark theme: surfaces are low-lightness tones; ink is high-lightness
- Accent stays recognisably the same brand hue in both themes — adjust lightness, not hue
- Do NOT invert the palette mechanically — dark mode is a re-assignment of tones, not a flip

**4. Contrast verification (mental check before assigning)**
Every ink-on-surface pair must pass WCAG AA (≥4.5:1 for text, ≥3:1 for large text/UI elements):
- inkPrimary on surfacePrimary
- inkSecondary on surfacePrimary and surfaceSecondary
- inkOnAccent on accentPrimary
- navBarActiveIcon on navBarBackground
- appBarInk on appBarBackground
- inputInk on inputFill
- every statusXxxInk on its statusXxxSubtle background
- frameworkOnPrimary on frameworkPrimary

**5. Harmony check — imagine a typical screen**
Picture the main list screen: app bar, list of cards, bottom nav, one accent button.
All these surfaces and text colors appear together. Ask: do they form a coherent, brand-true visual field? No single element should feel like it belongs to a different app.

**6. State coherence**
Interactive states (hover, pressed, focused, disabled) must feel like the same element shifting — never a different color entirely. Disabled is always inkDisabled regardless of the surface.

Write all of Phase 1 explicitly into the \`_thought\` field in the root of the JSON schema. Do not write anything outside the JSON.

## Phase 2 — Output the Design Specification

Generate a comprehensive UI/UX design specification as strict JSON.

Color token rules:
- **TINTED NEUTRALS ONLY:** Pure grey (#333333, #666666, #CCCCCC) is STRICTLY PROHIBITED. All neutral / surface / ink colors must be tinted with the main brand hue (e.g. #2C2D30 instead of #333333, or #F5F5F4 instead of #F0F0F0).
- **NO PURE WHITE/BLACK:** Never use exactly #FFFFFF or #000000. Off-white and off-black are required to remove the default digital harshness.
- All hex values must be specific (e.g. "#FAF8F5").
- Dark mode surfaces: use dark neutrals with subtle warmth or tint matching the brand hue — avoid flat #121212.
- inkTertiary is for placeholder / decorative labels only — never for meaningful content.
- inkOnImage: prefer near-white (#FFFFFF or near) — it must survive both light and dark photo backgrounds
- Status subtle backgrounds must be low-saturation tints; their Ink tokens must pass WCAG AA on them
- navBar* and appBar* must be intentional brand colors, not default grey
- Input tokens form a complete state machine: default → focused → error — all three visually distinct yet from the same tonal family
- Framework system colors map 1:1 to platform theme API fields — every field must be filled; no field may be left as a framework default
- frameworkPrimary = accentPrimary; frameworkSurface = surfacePrimary
- frameworkScrim: semi-transparent overlay, e.g. "rgba(0,0,0,0.5)" — adjust for dark mode

Other rules:
- Typography scale must reflect the brand voice; prefer readable body sizing over flashy display
- All spacing values must be multiples of the baseUnit (4 or 8)
- Motion durations and easing must match the brand's emotional register
- Component dimensions must be concrete pixel values — no "standard" or "default"
- antiPatterns must include everything from the brand guide plus visual patterns that conflict with the brand identity
- platformNotes must address ${platform}-specific theme API details (widget names, ColorScheme fields, etc.) and explain how to wire every framework token into the theme
- patterns.successFeedback must NOT use SnackBar, Toast, or alert dialogs — describe a subtle in-context approach

Return ONLY valid JSON matching this exact schema — no markdown fences, no extra text:
${DESIGN_SPEC_SCHEMA}`;

      return { content: [{ type: "text", text: prompt }] };
    },
  );

  server.tool(
    "save_design_spec",
    "Save a UI/UX design specification JSON to disk so it can be loaded by get_final_code_prompt as implementation guidance.",
    {
      designSpecJson: z
        .string()
        .describe("The design spec as a JSON string (from AI generation)"),
      outputPath: z
        .string()
        .optional()
        .describe(
          "File path to save to (default: OUTPUT_DIR/design-spec.json)",
        ),
    },
    async ({ designSpecJson, outputPath }) => {
      const filePath =
        outputPath ?? path.join(env.outputDir, "design-spec.json");
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      let parsed: unknown;
      try {
        parsed = JSON.parse(designSpecJson);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: "Invalid JSON — design spec not saved. Fix the JSON and try again.",
            },
          ],
        };
      }

      await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), "utf-8");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ saved: true, path: filePath }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "load_design_spec",
    "Load a previously saved design spec from disk. Use the result as the designSpec input to get_final_code_prompt.",
    {
      inputPath: z
        .string()
        .optional()
        .describe(
          "File path to read from (default: OUTPUT_DIR/design-spec.json)",
        ),
    },
    async ({ inputPath }) => {
      const filePath =
        inputPath ?? path.join(env.outputDir, "design-spec.json");
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        return { content: [{ type: "text", text: raw }] };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Design spec not found at ${filePath}. Run get_design_spec_prompt first.`,
            },
          ],
        };
      }
    },
  );
}
