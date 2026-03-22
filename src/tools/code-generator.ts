import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

// Prompt templates returned to the calling AI — no internal AI call needed.
// The AI that invoked this MCP tool already has full generative capability.

const PROTOTYPE_PROMPT_TEMPLATE = `You are an expert developer. Your goal is to produce a functional prototype that validates the user experience and core flows — not a polished production app.

App Name: {APP_NAME}
Description: {DESCRIPTION}
Pages / screens to generate: {PAGES}
Tech stack: {TECH_STACK}

Requirements:
- Cover every listed screen with working navigation between them
- Use realistic placeholder content — not lorem ipsum or "TODO" text
- Interface copy must feel human and warm, not robotic or system-like
- Focus on UX flow correctness over visual polish
- Each file as a separate <file name="..."> block (name and extension appropriate for the tech stack)

Output format — wrap each output file in XML-like blocks:
<file name="filename.ext">...file content...</file>\n
Do not explain the code. Output only the file blocks.`;

const FINAL_CODE_PROMPT_TEMPLATE = `You are a senior {TECH_STACK} developer.
Follow the brand guide's anti-patterns and the design spec's antiPatterns strictly.
Use ONLY the semantic color token hex values from the design spec — no hardcoded colors elsewhere.

Generate {TECH_STACK} code for:

App Name: {APP_NAME}

Brand Guide (voice, emotion, anti-patterns):
{BRAND_GUIDE}

Design Specification (colors, typography, spacing, components, motion):
{DESIGN_SPEC}

{EXISTING_CODE_SECTION}

Requirements:
- Define all color tokens as named constants / theme variables at the top — never scatter hex values inline
- Apply typography scale tokens to every text element
- Use spacing scale values for all padding and margins — no magic numbers
- Motion durations and easing must come from the spec's motion section
- Copy tone: {COPY_TONE}
- Anti-patterns to avoid: {ANTI_PATTERNS}
- UI principles to follow: {UI_PRINCIPLES}

Wrap each output file in <file name="...">...</file> blocks.`;

interface BrandGuide {
  copyTone?: { style?: string };
  antiPatterns?: string[];
  uiPrinciples?: string[];
  [key: string]: unknown;
}

async function saveFiles(
  fileBlocks: { name: string; content: string }[],
  outputDir: string,
): Promise<string[]> {
  const saved: string[] = [];
  for (const { name, content } of fileBlocks) {
    const filePath = path.join(outputDir, name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content.trim(), "utf-8");
    saved.push(filePath);
  }
  return saved;
}

function parseFileBlocks(raw: string): { name: string; content: string }[] {
  const regex = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
  const blocks: { name: string; content: string }[] = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    blocks.push({ name: match[1], content: match[2] });
  }
  return blocks;
}

export function registerCodeTools(server: McpServer): void {
  server.tool(
    "get_prototype_prompt",
    "Returns a ready-to-use prompt for generating a functional prototype. Tech stack is caller-defined — not limited to HTML/CSS. Use this prompt yourself to generate the prototype — no nested AI call. Then pass the output to save_code_files.",
    {
      appName: z.string().describe("Name of the app"),
      description: z
        .string()
        .describe("What the app does and its key features"),
      pages: z
        .array(z.string())
        .describe(
          "Page names to generate (e.g. ['home', 'record', 'history'])",
        ),
      techStack: z
        .string()
        .describe(
          "Tech stack to use for the prototype (e.g. 'Flutter/Dart', 'React Native', 'HTML/CSS', 'SwiftUI')",
        ),
    },
    async ({ appName, description, pages, techStack }) => {
      const prompt = PROTOTYPE_PROMPT_TEMPLATE.replace("{APP_NAME}", appName)
        .replace("{DESCRIPTION}", description)
        .replace("{PAGES}", pages.join(", "))
        .replace("{TECH_STACK}", techStack);

      return { content: [{ type: "text", text: prompt }] };
    },
  );

  server.tool(
    "get_final_code_prompt",
    "Returns a ready-to-use prompt for generating production code from brand guide + palette. Use this prompt yourself to generate the code — no nested AI call. Then pass the output to save_code_files.",
    {
      appName: z.string().describe("Name of the app"),
      techStack: z
        .string()
        .describe(
          "Target tech stack (e.g. 'Flutter/Dart', 'React Native', 'HTML/CSS')",
        ),
      brandGuide: z
        .string()
        .describe(
          "Brand guide JSON string (from save_brand_guide / load_brand_guide)",
        ),
      designSpec: z
        .string()
        .describe(
          "Design spec JSON string (from save_design_spec / load_design_spec). Contains color tokens, typography scale, spacing, component dimensions, motion guidelines.",
        ),
      existingCode: z
        .string()
        .optional()
        .describe("Existing prototype code to refactor"),
    },
    async ({ appName, techStack, brandGuide, designSpec, existingCode }) => {
      let parsedGuide: BrandGuide = {};
      try {
        parsedGuide = JSON.parse(brandGuide) as BrandGuide;
      } catch {
        // Use raw string if not valid JSON
      }

      const existingCodeSection = existingCode
        ? `Existing prototype to refactor:\n\`\`\`\n${existingCode}\n\`\`\``
        : "Generate from scratch based on the brand guide and design spec.";

      const prompt = FINAL_CODE_PROMPT_TEMPLATE.replace(
        /{TECH_STACK}/g,
        techStack,
      )
        .replace("{APP_NAME}", appName)
        .replace("{BRAND_GUIDE}", JSON.stringify(parsedGuide, null, 2))
        .replace("{DESIGN_SPEC}", designSpec)
        .replace("{EXISTING_CODE_SECTION}", existingCodeSection)
        .replace(
          "{COPY_TONE}",
          parsedGuide.copyTone?.style ?? "warm, quiet, non-judgmental",
        )
        .replace(
          "{ANTI_PATTERNS}",
          (parsedGuide.antiPatterns ?? []).join("; ") || "none specified",
        )
        .replace(
          "{UI_PRINCIPLES}",
          (parsedGuide.uiPrinciples ?? []).join("; ") || "none specified",
        );

      return { content: [{ type: "text", text: prompt }] };
    },
  );

  server.tool(
    "save_code_files",
    'Parse <file name="...">...</file> blocks from AI-generated code and save each file to disk. Use after get_prototype_prompt or get_final_code_prompt generation.',
    {
      generatedOutput: z
        .string()
        .describe(
          'Raw AI output containing <file name="...">...</file> blocks',
        ),
      outputDir: z
        .string()
        .optional()
        .describe("Directory to save files (default: OUTPUT_DIR/code)"),
    },
    async ({ generatedOutput, outputDir }) => {
      const targetDir = outputDir ?? path.join(env.outputDir, "code");
      const blocks = parseFileBlocks(generatedOutput);

      if (blocks.length === 0) {
        // Save as single file if no blocks found
        const fallbackPath = path.join(targetDir, "output.txt");
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(fallbackPath, generatedOutput, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  note: "No <file> blocks found — saved raw output.",
                  path: fallbackPath,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const savedFiles = await saveFiles(blocks, targetDir);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                outputDirectory: targetDir,
                filesGenerated: savedFiles,
                previewFile: savedFiles.find((f) => f.endsWith("index.html")),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
