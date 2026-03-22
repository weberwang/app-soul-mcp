import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { z } from "zod";
import { env } from "../lib/env.js";

type RGB = [number, number, number];

function toHex([r, g, b]: RGB): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

// Median-cut color quantization — simplified 1-level split per channel
function medianCut(pixels: RGB[], targetCount: number): RGB[] {
  if (pixels.length === 0) return [];

  const buckets: RGB[][] = [pixels];

  while (buckets.length < targetCount) {
    // Find the bucket with the greatest range across any channel
    let maxRange = -1;
    let splitIdx = 0;
    let splitChannel = 0;

    for (let bi = 0; bi < buckets.length; bi++) {
      const bucket = buckets[bi];
      for (let ch = 0; ch < 3; ch++) {
        const vals = bucket.map((p) => p[ch]);
        const range = Math.max(...vals) - Math.min(...vals);
        if (range > maxRange) {
          maxRange = range;
          splitIdx = bi;
          splitChannel = ch;
        }
      }
    }

    const bucket = buckets.splice(splitIdx, 1)[0];
    bucket.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const mid = Math.floor(bucket.length / 2);
    buckets.push(bucket.slice(0, mid), bucket.slice(mid));
  }

  return buckets.map((bucket) => {
    const avg = [0, 0, 0];
    for (const p of bucket) {
      avg[0] += p[0];
      avg[1] += p[1];
      avg[2] += p[2];
    }
    return avg.map((v) => Math.round(v / bucket.length)) as RGB;
  });
}

function assignColorRoles(colors: RGB[]): {
  role: string;
  hex: string;
  rgb: RGB;
}[] {
  // Rank by luminance (perceived brightness)
  const withLuma = colors.map((c) => ({
    rgb: c,
    hex: toHex(c),
    luma: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2],
    saturation:
      Math.max(...c) === 0
        ? 0
        : (Math.max(...c) - Math.min(...c)) / Math.max(...c),
  }));

  withLuma.sort((a, b) => b.luma - a.luma); // light → dark

  const roles = ["background", "surface", "accent", "text-secondary", "text"];
  return withLuma.map((c, i) => ({
    role: roles[i] ?? `color-${i + 1}`,
    hex: c.hex,
    rgb: c.rgb,
  }));
}

async function extractPaletteFromFile(
  imagePath: string,
  colorCount: number,
): Promise<{ role: string; hex: string; rgb: RGB }[]> {
  const { data, info } = await sharp(imagePath)
    .resize(120, 120, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: RGB[] = [];
  const step = info.channels;
  for (let i = 0; i < data.length; i += step * 3) {
    // Sample 1 in 3 pixels for performance
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // Deduplicate near-identical colors before quantization
  const deduplicated: RGB[] = [];
  for (const px of pixels) {
    if (!deduplicated.some((d) => colorDistance(d, px) < 20)) {
      deduplicated.push(px);
    }
  }

  const palette = medianCut(deduplicated, colorCount);
  return assignColorRoles(palette);
}

export function registerPaletteTools(server: McpServer): void {
  server.tool(
    "extract_palette",
    "Extract a harmonious color palette from a reference image in OUTPUT_DIR/mood_board/ using median-cut quantization. Each color is assigned a semantic role (background, surface, accent, text).",
    {
      filename: z
        .string()
        .describe("Filename of the image inside OUTPUT_DIR/mood_board/ (e.g. \"abc123.jpg\")"),
      colorCount: z
        .number()
        .min(3)
        .max(8)
        .default(5)
        .describe("Number of colors to extract (3–8, default 5)"),
    },
    async ({ filename, colorCount }) => {
      try {
        const resolvedPath = path.join(env.outputDir, "mood_board", path.basename(filename));
        await fs.access(resolvedPath);
        const palette = await extractPaletteFromFile(resolvedPath, colorCount);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sourceImage: resolvedPath,
                  palette,
                  hexOnly: palette.map((c) => c.hex),
                  cssVariables: palette
                    .map(
                      (c) =>
                        `  --color-${c.role}: ${c.hex}; /* rgb(${c.rgb.join(", ")}) */`,
                    )
                    .join("\n"),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to extract palette: ${String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "extract_palette_from_dir",
    "Extract and merge palettes from all images in OUTPUT_DIR/mood_board/. Returns a deduplicated representative palette across all reference images.",
    {
      colorCount: z
        .number()
        .min(3)
        .max(8)
        .default(5)
        .describe("Final number of colors to return"),
    },
    async ({ colorCount }) => {
      const resolvedDir = path.join(env.outputDir, "mood_board");
      const files = (await fs.readdir(resolvedDir)).filter((f) =>
        /\.(jpe?g|png|webp)$/i.test(f),
      );

      if (files.length === 0) {
        return {
          content: [
            { type: "text", text: "No image files found in directory." },
          ],
        };
      }

      const allColors: RGB[] = [];
      for (const file of files) {
        try {
          const palette = await extractPaletteFromFile(
            path.join(resolvedDir, file),
            5,
          );
          allColors.push(...palette.map((c) => c.rgb));
        } catch {
          // Skip unreadable files
        }
      }

      const merged = medianCut(allColors, colorCount);
      const palette = assignColorRoles(merged);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                processedImages: files.length,
                palette,
                hexOnly: palette.map((c) => c.hex),
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
