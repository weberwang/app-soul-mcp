import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

// The JSON schema that Copilot must return. Used in the prompt below.
const DESIGN_SPEC_SCHEMA = `{
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
Generate a comprehensive UI/UX design specification as strict JSON.

Rules:
- All hex values must be specific (e.g. "#FAF8F5", never "warm white" or vague descriptions)
- Color tokens must derive from the brand guide's colorDirection + mood board palette
- Dark mode must adapt thoughtfully — not simply invert or blindly darken light values
- Every "ink" token must be verified to pass WCAG AA contrast (≥4.5:1) against its paired surface: inkPrimary on surfacePrimary, inkOnAccent on accentPrimary, navBarActiveIcon on navBarBackground, appBarInk on appBarBackground, inputInk on inputFill, etc.
- inkTertiary is for placeholders and decorative labels only — never use it for meaningful content
- inkOnImage must remain legible over a range of photo lightness values — prefer near-white with subtle shadow or a semi-transparent overlay rather than a pure color
- Status subtle backgrounds (statusSuccessSubtle, statusWarningSubtle, etc.) must be desaturated enough not to compete with the main surface; their paired "Ink" tokens must pass WCAG AA against the subtle background
- Navigation colors (navBar*, appBar*) must feel intentional and brand-aligned, not default grey; the indicator must clearly mark the active item without being jarring
- Input field tokens form a complete system: fill → border → focused → error states must all be visually distinct yet harmonious
- Framework system colors (frameworkPrimary, frameworkSurface, etc.) must be explicitly defined and harmonized with the semantic tokens above — wire them directly into the platform theme API (Flutter ThemeData/ColorScheme, Tailwind CSS variables, React Native StyleSheet). Unthemed defaults break native component consistency
- frameworkPrimary must match accentPrimary; frameworkOnPrimary must pass WCAG AA on it
- frameworkSecondary is for secondary interactive elements (outlined buttons, toggles, secondary FAB)
- frameworkSurfaceVariant governs chip/tag backgrounds and quiet container fills — harmonize with surfaceSecondary
- frameworkScrim is the modal backdrop — typically semi-transparent black; adjust opacity for dark mode
- Typography scale must reflect the brand voice; prefer readable body sizing over flashy display
- All spacing values must be multiples of the baseUnit (4 or 8)
- Motion durations and easing must match the brand's emotional register
- Component dimensions must be concrete pixel values — no "standard" or "default"
- antiPatterns must include everything from the brand guide plus any visual patterns that conflict with the brand identity
- platformNotes must address ${platform}-specific implementation details (widget names, theme APIs, ColorScheme constructor fields, etc.) and explain how to wire the framework color tokens into the platform theme
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
