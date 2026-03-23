import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

// Returned to the calling AI so it can generate the brand guide itself.
// The AI has full generative capability — no need to duplicate it here.
const BRAND_GUIDE_SCHEMA = `{
  "appName": string,
  "tagline": string,
  "targetUser": string,

  // ── Core Emotional Keywords ───────────────────────────────────────────────
  // What the user must FEEL when using the app (3–5 specific adjectives).
  // These drive every visual and copy decision downstream.
  "coreEmotions": string[],

  // ── Visual Metaphors ─────────────────────────────────────────────────────
  // Real-world physical objects whose material qualities, proportions, and
  // interactions directly inspire the UI's surfaces, shapes, and motion.
  "visualMetaphors": {
    "primary": string,        // one dominant real-world object (e.g. "Japanese washi paper notebook")
    "secondary": string[],   // 3–5 supporting objects that share the same textural or spatial feel
    "designImplications": string[], // how each metaphor translates: surface texture → color/elevation style,
                                    // object proportions → border-radius, object weight → motion easing, etc.
    "searchKeywordsEn": string[]    // English search keywords for finding UI/UX reference images on Dribbble / Mobbin / Behance.
                                    // MUST be app/screen/interface oriented — e.g. "finance app dark UI",
                                    // "minimal onboarding screen", "wellness app card layout".
                                    // NEVER use generic photography terms (landscapes, people, food, nature).
  },

  // ── Anti-Goals ───────────────────────────────────────────────────────────
  // The look, feel, and emotional register this app must NEVER have.
  // These are brand-level prohibitions, not implementation patterns.
  // Example: "corporate dashboard coldness", "gamified notification spam",
  //          "glossy hyper-saturated social media energy"
  "antiGoals": string[],

  "colorDirection": {
    "mood": string,
    "backgroundSuggestion": string,
    "accentSuggestion": string,
    "avoidColors": string[]
  },
  "typography": {
    "voiceDescription": string,
    "avoid": string[]
  },

  // ── Anti-Patterns ────────────────────────────────────────────────────────
  // Specific UI/UX implementation patterns that contradict the brand.
  "antiPatterns": string[],

  "uiPrinciples": string[],
  "copyTone": {
    "style": string,
    "exampleCta": string,
    "exampleEmptyState": string,
    "avoid": string[]
  }
}`;

export function registerBrandGuideTools(server: McpServer): void {
  server.tool(
    "get_brand_guide_prompt",
    "Returns the brand guide JSON schema and a ready-to-use prompt. Call this first, then use the prompt yourself to generate the brand guide — no internal AI call needed.",
    {
      appName: z.string().describe("Name of the app"),
      productDescription: z
        .string()
        .describe("What the app does (2–4 sentences)"),
      targetUser: z.string().describe("Who the target user is"),
      coreEmotion: z
        .string()
        .describe(
          "Primary emotion(s) users should feel — one phrase or several comma-separated keywords",
        ),
      visualMetaphorsHint: z
        .string()
        .optional()
        .describe(
          "Optional: real-world objects, materials, or spaces that could inspire the UI (e.g. 'aged leather notebook, warm candlelight'). Leave empty to let the AI derive them.",
        ),
      antiGoalsHint: z
        .string()
        .optional()
        .describe(
          "Optional: the look/feel this app must NEVER have (e.g. 'cold corporate SaaS dashboard, hyper-saturated social media feed'). Leave empty to let the AI derive them.",
        ),
    },
    async ({ appName, productDescription, targetUser, coreEmotion, visualMetaphorsHint, antiGoalsHint }) => {
      const metaphorSection = visualMetaphorsHint?.trim()
        ? `Known Visual Metaphor Hints (use as anchors, expand on them): ${visualMetaphorsHint}`
        : `Visual Metaphor Hints: none provided — derive from the product description and target user.`;

      const antiGoalSection = antiGoalsHint?.trim()
        ? `Known Anti-Goal Hints (must be reflected in antiGoals field): ${antiGoalsHint}`
        : `Anti-Goal Hints: none provided — derive from the product description and what would feel wrong for this audience.`;

      const prompt = `You are a senior product brand strategist and design systems thinker.
Generate a brand guide as strict JSON for the following product.

App Name: ${appName}
Description: ${productDescription}
Target User: ${targetUser}
Core Emotion to Evoke: ${coreEmotion}
${metaphorSection}
${antiGoalSection}

## Reasoning Instructions

Work through these three areas explicitly in your thinking before producing JSON:

**1. Core Emotional Keywords**
Identify 3–5 precise emotional adjectives that describe the user's ideal experience.
Be specific: not "good" but "quietly confident"; not "fast" but "effortlessly frictionless".
These keywords must be strong enough to act as a filter: if a design decision contradicts any keyword, that decision is wrong.

**2. Visual Metaphors**
Choose real-world physical objects, materials, or spaces whose sensory qualities directly inspire the UI.
For each metaphor, articulate the design implication:
- Surface quality (e.g. matte paper → low-gloss flat surfaces, no harsh drop shadows)
- Proportions (e.g. slim pocket notebook → compact cards, tight spacing)
- Weight and movement (e.g. smooth river stone → slow, organic motion curves)
- Light interaction (e.g. frosted glass → translucent overlays, diffused light)
The metaphors must be consistent with coreEmotions and coherent with each other — they should feel like they belong to the same physical world.

For searchKeywordsEn, generate 6–10 English phrases specifically for finding UI/UX design references on sites like Dribbble, Mobbin, Behance, and Figma Community. Every keyword must describe a screen, interface, or design pattern — never a real-world scene, person, landscape, or object photograph. Structure them as:
- "[adjective] [app-type] [platform/medium]" — e.g. "minimal finance app iOS"
- "[style] [screen-type] design" — e.g. "frosted glass onboarding screen"
- "[emotion/mood] [UI element]" — e.g. "calm dashboard card layout"
Bad keywords (will return wrong content): "washi paper texture", "mountain lake", "cozy coffee shop", "woman using phone".
Good keywords (will return design references): "soft pastel wellness app", "clean budgeting dashboard dark mode", "organic card UI mobile".

**3. Anti-Goals**
Define what the app must NEVER feel like — the brand's negative space.
Anti-goals are not about specific widgets; they are about atmosphere and emotional register.
Examples of well-written anti-goals:
- "Cold, data-centric dashboard that prioritises density over breath"
- "Gamified reward loop that manufactures urgency"
- "Glossy consumer app with hyper-saturated hero images"
Anti-goals must be specific enough to rule out real design directions.
Then derive antiPatterns as specific UI/UX implementations that would produce those anti-goal atmospheres.

Only after reasoning through all three, output the JSON.

Return ONLY valid JSON matching this schema — no markdown fences, no extra text:
${BRAND_GUIDE_SCHEMA}`;

      return {
        content: [{ type: "text", text: prompt }],
      };
    },
  );

  server.tool(
    "save_brand_guide",
    "Save a brand guide JSON to a local file so it can be referenced by later steps (palette extraction, code generation, etc.).",
    {
      brandGuideJson: z.string().describe("The brand guide as a JSON string"),
      outputPath: z
        .string()
        .optional()
        .describe(
          "File path to save to (default: OUTPUT_DIR/brand-guide.json)",
        ),
    },
    async ({ brandGuideJson, outputPath }) => {
      const targetPath =
        outputPath ?? path.join(env.outputDir, "brand-guide.json");
      await fs.mkdir(path.dirname(path.resolve(targetPath)), {
        recursive: true,
      });

      // Validate JSON before saving
      let parsed: unknown;
      try {
        parsed = JSON.parse(brandGuideJson);
      } catch {
        return {
          content: [
            { type: "text", text: "Invalid JSON — brand guide not saved." },
          ],
        };
      }

      const normalized = JSON.stringify(parsed, null, 2);
      await fs.writeFile(path.resolve(targetPath), normalized, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { saved: true, path: path.resolve(targetPath) },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "load_brand_guide",
    "Load a previously saved brand guide JSON from disk.",
    {
      filePath: z
        .string()
        .optional()
        .describe(
          "Path to brand guide JSON (default: OUTPUT_DIR/brand-guide.json)",
        ),
    },
    async ({ filePath }) => {
      const targetPath =
        filePath ?? path.join(env.outputDir, "brand-guide.json");
      try {
        const content = await fs.readFile(path.resolve(targetPath), "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch {
        return {
          content: [{ type: "text", text: `Not found: ${targetPath}` }],
        };
      }
    },
  );
}
