import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

const reviewIssueSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  category: z.enum([
    "brand",
    "layout",
    "contrast",
    "typography",
    "color",
    "motion",
    "copy",
    "genericness",
  ]),
  problem: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
  fix: z.string().trim().min(1),
});

const reviewResultSchema = z.object({
  _thought: z.string().trim().min(1),
  score: z.number().min(0).max(100),
  verdict: z.enum(["pass", "revise"]),
  strengths: z.array(z.string().trim().min(1)).min(1),
  issues: z.array(reviewIssueSchema),
  antiPatternDrift: z.array(z.string().trim().min(1)),
  nextPromptAddendum: z.array(z.string().trim().min(1)).min(1),
});

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

function stripMarkdownCodeFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
}

function resolveScreenshotPath(screenshotPath: string): string {
  if (path.isAbsolute(screenshotPath)) {
    return screenshotPath;
  }

  return path.join(env.outputDir, screenshotPath);
}

function resolveReviewPath(reviewPath: string): string {
  if (path.isAbsolute(reviewPath)) {
    return reviewPath;
  }

  return path.join(env.outputDir, reviewPath);
}

function buildReviewPrompt(
  reviewFocus: "overall" | "brand" | "layout" | "contrast" | "copy",
  brandGuide: string,
  designSpec: string,
  screenshotLabel: string,
): string {
  return `You are performing a strict UI review of a rendered product screenshot.

Screenshot: ${screenshotLabel}
Primary review focus: ${reviewFocus}

Brand Guide:
${brandGuide}

Design Specification:
${designSpec}

Review the screenshot and return ONLY valid JSON with this shape:
{
  "_thought": "short reasoning about the strongest signals and the most important violations",
  "score": number, // 0-100 overall quality score
  "verdict": "pass" | "revise",
  "strengths": ["string"],
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "category": "brand" | "layout" | "contrast" | "typography" | "color" | "motion" | "copy" | "genericness",
      "problem": "string",
      "evidence": "string",
      "fix": "string"
    }
  ],
  "antiPatternDrift": ["string"],
  "nextPromptAddendum": ["string"]
}

Rules:
- Be specific and visual. Reference spacing, hierarchy, density, color temperature, typography character, and whether the UI feels generic.
- Use "genericness" issues when the screen resembles a stock dashboard, starter template, default mobile kit, or bland AI-generated product page.
- If brand guide or design spec is missing, still review the screenshot against clarity, hierarchy, and originality.
- nextPromptAddendum must contain direct, reusable instructions that can be fed back into code generation or design refinement.
- Return only JSON with no markdown.`;
}

async function loadScreenshot(resolvedPath: string): Promise<Buffer> {
  await fs.access(resolvedPath);
  return fs.readFile(resolvedPath);
}

export function registerUiReviewTools(server: McpServer): void {
  server.tool(
    "review_ui_screenshot",
    "Read a rendered UI screenshot and return it directly to the calling multimodal AI with a structured review prompt. Use this after generating and rendering code to critique visual quality, brand alignment, hierarchy, density, and anti-pattern drift.",
    {
      screenshotPath: z
        .string()
        .describe(
          "Screenshot path. Absolute paths are allowed; relative paths are resolved from OUTPUT_DIR.",
        ),
      brandGuide: z
        .string()
        .default("")
        .describe("Optional brand guide JSON string to review against."),
      designSpec: z
        .string()
        .default("")
        .describe("Optional design spec JSON string to review against."),
      reviewFocus: z
        .enum(["overall", "brand", "layout", "contrast", "copy"])
        .default("overall")
        .describe("Primary review focus."),
    },
    async ({ screenshotPath, brandGuide, designSpec, reviewFocus }) => {
      const resolvedPath = resolveScreenshotPath(screenshotPath);
      try {
        await fs.access(resolvedPath);
      } catch {
        return {
          content: [{ type: "text", text: `Screenshot not found: ${resolvedPath}` }],
        };
      }

      const imageBuffer = await loadScreenshot(resolvedPath);
      const cleanBrandGuide = brandGuide.trim()
        ? stripMarkdownCodeFence(brandGuide)
        : "Not provided.";
      const cleanDesignSpec = designSpec.trim()
        ? stripMarkdownCodeFence(designSpec)
        : "Not provided.";

      const reviewPrompt = buildReviewPrompt(
        reviewFocus,
        cleanBrandGuide,
        cleanDesignSpec,
        path.basename(resolvedPath),
      );

      return {
        content: [
          { type: "text", text: reviewPrompt },
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
    "review_ui_screenshot_dir",
    "Read all screenshots from a directory and return them to the calling multimodal AI with a structured review prompt for flow-level comparison. Use this for multi-screen review after rendering a prototype or app flow.",
    {
      screenshotDir: z
        .string()
        .describe(
          "Directory containing screenshots. Absolute paths are allowed; relative paths are resolved from OUTPUT_DIR.",
        ),
      brandGuide: z
        .string()
        .default("")
        .describe("Optional brand guide JSON string to review against."),
      designSpec: z
        .string()
        .default("")
        .describe("Optional design spec JSON string to review against."),
      reviewFocus: z
        .enum(["overall", "brand", "layout", "contrast", "copy"])
        .default("overall")
        .describe("Primary review focus."),
    },
    async ({ screenshotDir, brandGuide, designSpec, reviewFocus }) => {
      const resolvedDir = resolveScreenshotPath(screenshotDir);
      let entries: string[];
      try {
        entries = await fs.readdir(resolvedDir);
      } catch {
        return {
          content: [{ type: "text", text: `Directory not found: ${resolvedDir}` }],
        };
      }

      const screenshotFiles = entries.filter((entry) => /\.(png|jpe?g|webp|gif)$/i.test(entry));
      if (screenshotFiles.length === 0) {
        return {
          content: [{ type: "text", text: "No screenshot files found in directory." }],
        };
      }

      const cleanBrandGuide = brandGuide.trim()
        ? stripMarkdownCodeFence(brandGuide)
        : "Not provided.";
      const cleanDesignSpec = designSpec.trim()
        ? stripMarkdownCodeFence(designSpec)
        : "Not provided.";

      const reviewPrompt = `${buildReviewPrompt(reviewFocus, cleanBrandGuide, cleanDesignSpec, path.basename(resolvedDir))}

Additional rules for multi-screen review:
- Compare consistency across screens: spacing rhythm, component reuse, type hierarchy, tone of copy, and navigation cohesion.
- Call out any screen that feels visually off-brand relative to the others.
- Mention if the flow drifts between multiple UI styles.`;

      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        {
          type: "text",
          text: `${screenshotFiles.length} screenshots from ${resolvedDir}\n\n${reviewPrompt}`,
        },
      ];

      for (const file of screenshotFiles) {
        const fullPath = path.join(resolvedDir, file);
        try {
          const buffer = await loadScreenshot(fullPath);
          content.push({
            type: "image",
            data: buffer.toString("base64"),
            mimeType: detectMimeType(buffer, fullPath),
          });
        } catch {
          // Skip unreadable files silently
        }
      }

      return { content };
    },
  );

  server.tool(
    "save_ui_review",
    "Save a structured UI review JSON result to disk so it can be reused in later design or code refinement steps.",
    {
      reviewJson: z.string().describe("Structured UI review JSON string generated from review_ui_screenshot or review_ui_screenshot_dir."),
      outputPath: z
        .string()
        .optional()
        .describe("File path to save to (default: OUTPUT_DIR/ui-review.json)"),
    },
    async ({ reviewJson, outputPath }) => {
      const targetPath = resolveReviewPath(outputPath ?? "ui-review.json");
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripMarkdownCodeFence(reviewJson));
      } catch {
        return {
          content: [{ type: "text", text: "Invalid JSON — UI review not saved." }],
        };
      }

      const validation = reviewResultSchema.safeParse(parsed);
      if (!validation.success) {
        return {
          content: [
            {
              type: "text",
              text: `UI review failed validation:\n${validation.error.issues
                .map((issue) => `- ${issue.path.join(".") || "root"}: ${issue.message}`)
                .join("\n")}`,
            },
          ],
        };
      }

      await fs.writeFile(targetPath, JSON.stringify(validation.data, null, 2), "utf-8");
      return {
        content: [{ type: "text", text: JSON.stringify({ saved: true, path: targetPath }, null, 2) }],
      };
    },
  );

  server.tool(
    "load_ui_review",
    "Load a previously saved UI review JSON from disk.",
    {
      inputPath: z
        .string()
        .optional()
        .describe("File path to read from (default: OUTPUT_DIR/ui-review.json)"),
    },
    async ({ inputPath }) => {
      const targetPath = resolveReviewPath(inputPath ?? "ui-review.json");
      try {
        const raw = await fs.readFile(targetPath, "utf-8");
        return { content: [{ type: "text", text: raw }] };
      } catch {
        return {
          content: [{ type: "text", text: `UI review not found at ${targetPath}.` }],
        };
      }
    },
  );
}