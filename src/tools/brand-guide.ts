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
  "coreEmotions": string[],                  // 3–5 emotional keywords
  "visualMetaphors": {
    "primary": string,                       // main real-world object metaphor
    "secondary": string[],                   // 3–5 supporting objects
    "searchKeywordsEn": string[]             // English keywords for Unsplash/Pexels
  },
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
      coreEmotion: z.string().describe("Primary emotion users should feel"),
    },
    async ({ appName, productDescription, targetUser, coreEmotion }) => {
      const prompt = `You are a senior product brand strategist. Generate a brand guide as strict JSON for the following product.

App Name: ${appName}
Description: ${productDescription}
Target User: ${targetUser}
Core Emotion to Evoke: ${coreEmotion}

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
