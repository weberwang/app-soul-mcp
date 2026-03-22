import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

// The JSON schema that Copilot must return. Used in the prompt below.
const DESIGN_SPEC_SCHEMA = `{
  "colorTokens": {
    "light": {
      "surfacePrimary":   string,  // main app background
      "surfaceSecondary": string,  // cards, elevated surfaces
      "surfaceTint":      string,  // subtle overlays, modal scrims
      "inkPrimary":       string,  // primary text
      "inkSecondary":     string,  // secondary / muted text
      "inkDisabled":      string,  // disabled text and icons
      "accentPrimary":    string,  // main CTA, interactive highlight — maps to frameworkPrimary
      "accentSubtle":     string,  // soft ~15% version of accent
      "borderSubtle":     string,  // dividers and borders
      "statusSuccess":    string,
      "statusWarning":    string,
      "statusError":      string,
      "frameworkPrimary":            string,  // platform theme primary (Flutter ColorScheme.primary / CSS --color-primary)
      "frameworkOnPrimary":          string,  // text/icons on frameworkPrimary (must pass WCAG AA contrast)
      "frameworkPrimaryContainer":   string,  // tonal container surface (Flutter) / secondary brand surface
      "frameworkOnPrimaryContainer": string,  // content on top of frameworkPrimaryContainer
      "frameworkSurface":            string,  // default scaffold/page background fed to theme
      "frameworkOnSurface":          string,  // default body text color fed to theme
      "frameworkSurfaceVariant":     string,  // input fills, chip/tag backgrounds, quiet containers
      "frameworkOnSurfaceVariant":   string,  // text inside surface variant components
      "frameworkOutline":            string   // default border / divider color fed to theme
    },
    "dark": {
      "surfacePrimary":   string,
      "surfaceSecondary": string,
      "surfaceTint":      string,
      "inkPrimary":       string,
      "inkSecondary":     string,
      "inkDisabled":      string,
      "accentPrimary":    string,
      "accentSubtle":     string,
      "borderSubtle":     string,
      "statusSuccess":    string,
      "statusWarning":    string,
      "statusError":      string,
      "frameworkPrimary":            string,
      "frameworkOnPrimary":          string,
      "frameworkPrimaryContainer":   string,
      "frameworkOnPrimaryContainer": string,
      "frameworkSurface":            string,
      "frameworkOnSurface":          string,
      "frameworkSurfaceVariant":     string,
      "frameworkOnSurfaceVariant":   string,
      "frameworkOutline":            string
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
- Framework system colors (frameworkPrimary, frameworkSurface, etc.) must be explicitly defined and harmonized with the semantic tokens — they are the values you will pass directly to the platform's theme API (e.g. Flutter ThemeData/ColorScheme, Tailwind CSS variables, React Native StyleSheet). Do not leave them as defaults; unthemed framework defaults will break the visual consistency of native components (buttons, text fields, bottom sheets, chips, dialogs, etc.)
- The frameworkPrimary color determines the appearance of default interactive components (filled buttons, FABs, selection states, progress indicators) — choose it carefully to match accentPrimary while ensuring sufficient contrast on frameworkOnPrimary
- frameworkSurfaceVariant governs input field fills, chip backgrounds, and similar quiet container surfaces — it must feel at home alongside surfaceSecondary
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
