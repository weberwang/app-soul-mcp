import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import fetch from "node-fetch";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

interface DribbbleShot {
  id: number;
  title: string;
  description: string | null;
  images: {
    hidpi: string | null;
    normal: string;
    teaser: string;
  };
  html_url: string;
  tags: string[];
}

interface MoodBoardImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  sourceKeyword: string;
  pageUrl: string;
  source: "dribbble";
}

async function searchDribbble(
  keyword: string,
  count: number,
): Promise<MoodBoardImage[]> {
  if (!env.dribbbleAccessToken) return [];

  const resp = await fetch(
    `https://api.dribbble.com/v2/shots?q=${encodeURIComponent(keyword)}&per_page=${count}`,
    { headers: { Authorization: `Bearer ${env.dribbbleAccessToken}` } },
  );
  if (!resp.ok) return [];

  const shots = (await resp.json()) as DribbbleShot[];
  return shots.map((s) => ({
    id: String(s.id),
    url: s.images.hidpi ?? s.images.normal,
    thumbnailUrl: s.images.teaser,
    description: s.title + (s.description ? ` — ${s.description.replace(/<[^>]*>/g, "").slice(0, 120)}` : ""),
    sourceKeyword: keyword,
    pageUrl: s.html_url,
    source: "dribbble" as const,
  }));
}

export function registerMoodBoardTools(server: McpServer): void {
  server.tool(
    "search_mood_board",
    "Search Dribbble for app UI design references using keywords (e.g. from brand guide's searchKeywordsEn). Returns shot URLs and metadata to review before downloading.",
    {
      keywords: z
        .array(z.string())
        .describe(
          "Search keywords — use English terms from brand guide visualMetaphors.searchKeywordsEn",
        ),
      perKeyword: z
        .number()
        .min(1)
        .max(10)
        .default(4)
        .describe("Number of shots to fetch per keyword"),
    },
    async ({ keywords, perKeyword }) => {
      const results: MoodBoardImage[] = [];

      for (const keyword of keywords) {
        results.push(...(await searchDribbble(keyword, perKeyword)));
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No results. Check that DRIBBBLE_ACCESS_TOKEN is set. Get one at https://dribbble.com/account/applications/new",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: results.length,
                images: results.map((img) => ({
                  id: img.id,
                  source: img.source,
                  keyword: img.sourceKeyword,
                  description: img.description,
                  downloadUrl: img.url,
                  previewUrl: img.thumbnailUrl,
                  pageUrl: img.pageUrl,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "download_mood_board",
    "Download mood board reference images to a local directory. Pass the downloadUrl values from search_mood_board results.",
    {
      images: z
        .array(
          z.object({
            id: z.string(),
            downloadUrl: z.string().url(),
            description: z.string().optional(),
          }),
        )
        .describe("Images to download (from search_mood_board output)"),
      outputDir: z
        .string()
        .optional()
        .describe(
          "Local directory to save images (defaults to OUTPUT_DIR/mood_board)",
        ),
    },
    async ({ images, outputDir }) => {
      const targetDir = outputDir ?? path.join(env.outputDir, "mood_board");
      await fs.mkdir(targetDir, { recursive: true });

      const downloaded: { id: string; path: string }[] = [];
      const failed: { id: string; error: string }[] = [];

      for (const img of images) {
        const filePath = path.join(targetDir, `${img.id}.jpg`);
        try {
          const resp = await fetch(img.downloadUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const buffer = Buffer.from(await resp.arrayBuffer());
          await fs.writeFile(filePath, buffer);
          downloaded.push({ id: img.id, path: filePath });
        } catch (err) {
          failed.push({ id: img.id, error: String(err) });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                directory: targetDir,
                downloaded: downloaded.length,
                failed: failed.length,
                files: downloaded,
                errors: failed,
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
