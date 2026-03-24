import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

function detectMimeType(buffer: Buffer, filePath?: string): string {
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 6 &&
    (buffer.toString("ascii", 0, 6) === "GIF87a" ||
      buffer.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  const ext = filePath ? path.extname(filePath).toLowerCase() : "";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

// These instructions are sent alongside the image so the calling multimodal AI
// (Copilot) knows exactly what structured output to produce.
const ANALYSIS_INSTRUCTIONS = {
  palette: `Analyze the image and extract its color palette. Return a JSON object with:
- "_thought": short reasoning about why these colors matter for UI and which generic palette tropes you avoided
- "colors": array of 5 objects, each with "role" (background/surface/accent/text-secondary/text), "hex" (closest hex value), and "description" (one evocative word like "warm amber" or "dusty slate")
- "colorMood": one sentence describing the overall color temperature and feeling
Return ONLY valid JSON, no markdown.`,

  style: `Analyze this image's visual style for UI/app design inspiration. Return a JSON object with:
- "_thought": short reasoning about what makes this image feel specific rather than generic UI inspiration
- "visualMetaphors": array of 3-5 real-world objects this image evokes (e.g. "aged leather", "frosted glass")
- "styleKeywords": array of 5-8 descriptors useful as image generation keywords
- "uiPrinciples": array of 3-4 design principles this image suggests (e.g. "generous whitespace", "tactile textures")
- "antiPatterns": array of 2-3 things this aesthetic explicitly rejects
- "atmosphere": one sentence capturing the emotional tone
Return ONLY valid JSON, no markdown.`,

  figma: `Analyze this UI design screenshot to extract specifications for code generation. Return a JSON object with:
- "_thought": short reasoning about the visual hierarchy and any non-generic patterns worth preserving in code
- "layout": overall layout structure (grid, spacing, alignment)
- "colorUsage": how colors are applied (background, cards, text, accents)
- "typography": font sizes, weights, and hierarchy observed
- "components": list of UI components visible with approximate dimensions and style
- "spacing": padding and margin patterns observed
- "codeNotes": 3-5 specific implementation notes for a developer
Return ONLY valid JSON, no markdown.`,

  full: `Analyze this image comprehensively for app UI design. Return a JSON object combining:
- "_thought": short reasoning about the palette, materials, and what prevents this from feeling like stock AI-generated UI
- "palette": 5 colors with role, hex, description
- "colorMood": overall color feeling
- "styleKeywords": 5-8 generation keywords
- "visualMetaphors": 3-5 real-world objects evoked
- "atmosphere": emotional tone in one sentence
- "uiPrinciples": 3-4 implied design principles
- "suggestedPrompt": a ready-to-use image generation prompt for similar assets
Return ONLY valid JSON, no markdown.`,
};

export function registerAssetTools(server: McpServer): void {
  // read_image / read_mood_board_dir — image content is returned directly to the
  // calling multimodal model (Copilot). No intermediate AI layer needed.

  server.tool(
    "read_image",
    "Read a single image from the mood board directory and return it directly to you (the calling multimodal AI) for analysis. Use this after download_mood_board to extract palette, visual style, metaphors, and atmosphere from a reference image.",
    {
      filename: z.string().describe("Filename of the image inside OUTPUT_DIR/mood_board/ (e.g. \"abc123.jpg\")"),
      mode: z
        .enum(["palette", "style", "figma", "full"])
        .default("full")
        .describe(
          "Analysis mode: 'palette' = colors only | 'style' = visual aesthetics | 'figma' = UI screenshot for code gen | 'full' = everything",
        ),
    },
    async ({ filename, mode }) => {
      const resolvedPath = path.join(env.outputDir, "mood_board", path.basename(filename));
      try {
        await fs.access(resolvedPath);
      } catch {
        return {
          content: [{ type: "text", text: `Image not found: ${resolvedPath}` }],
        };
      }

      const imageBuffer = await fs.readFile(resolvedPath);
      return {
        content: [
          { type: "text", text: ANALYSIS_INSTRUCTIONS[mode] },
          {
            type: "image",
            data: imageBuffer.toString("base64"),
            mimeType: detectMimeType(imageBuffer, resolvedPath),
          },
        ],
      };
    },
  );

  server.tool(
    "read_mood_board_dir",
    "Read all images from OUTPUT_DIR/mood_board/ and return them directly to you (the calling multimodal AI) for analysis. Returns all images in a single response so you can synthesize a unified style profile: palette, visual metaphors, atmosphere.",
    {
      mode: z
        .enum(["palette", "style", "full"])
        .default("style")
        .describe("Analysis mode for synthesizing across all images"),
    },
    async ({ mode }) => {
      const resolvedDir = path.join(env.outputDir, "mood_board");
      let entries: string[];
      try {
        entries = await fs.readdir(resolvedDir);
      } catch {
        return {
          content: [
            { type: "text", text: `Directory not found: ${resolvedDir}` },
          ],
        };
      }

      const imageFiles = entries.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
      if (imageFiles.length === 0) {
        return {
          content: [
            { type: "text", text: "No image files found in directory." },
          ],
        };
      }

      type ContentItem =
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string };

      const contentItems: ContentItem[] = [
        {
          type: "text",
          text: `${imageFiles.length} mood board images from: ${resolvedDir}\n\n${ANALYSIS_INSTRUCTIONS[mode]}`,
        },
      ];

      for (const file of imageFiles) {
        const fullPath = path.join(resolvedDir, file);
        try {
          const buffer = await fs.readFile(fullPath);
          contentItems.push({
            type: "image",
            data: buffer.toString("base64"),
            mimeType: detectMimeType(buffer, fullPath),
          });
        } catch {
          // Skip unreadable files silently
        }
      }

      return { content: contentItems };
    },
  );
}
