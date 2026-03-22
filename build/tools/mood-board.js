import fs from "fs/promises";
import fetch from "node-fetch";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";
async function searchUnsplash(keyword, count) {
    if (!env.unsplashAccessKey)
        return [];
    const resp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${count}&orientation=squarish`, { headers: { Authorization: `Client-ID ${env.unsplashAccessKey}` } });
    if (!resp.ok)
        return [];
    const data = (await resp.json());
    return data.results.map((p) => ({
        id: p.id,
        url: p.urls.regular,
        thumbnailUrl: p.urls.small,
        description: p.description ?? p.alt_description ?? keyword,
        sourceKeyword: keyword,
        pageUrl: p.links.html,
        source: "unsplash",
    }));
}
export function registerMoodBoardTools(server) {
    server.tool("search_mood_board", "Search Unsplash for reference images using keywords (e.g. from brand guide's searchKeywordsEn). Returns image URLs and metadata to review before downloading.", {
        keywords: z
            .array(z.string())
            .describe("Search keywords — use English terms from brand guide visualMetaphors.searchKeywordsEn"),
        perKeyword: z
            .number()
            .min(1)
            .max(10)
            .default(4)
            .describe("Number of images to fetch per keyword"),
    }, async ({ keywords, perKeyword }) => {
        const results = [];
        for (const keyword of keywords) {
            results.push(...(await searchUnsplash(keyword, perKeyword)));
        }
        if (results.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No results. Check that UNSPLASH_ACCESS_KEY is set in .env",
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
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
                    }, null, 2),
                },
            ],
        };
    });
    server.tool("download_mood_board", "Download mood board reference images to a local directory. Pass the downloadUrl values from search_mood_board results.", {
        images: z
            .array(z.object({
            id: z.string(),
            downloadUrl: z.string().url(),
            description: z.string().optional(),
        }))
            .describe("Images to download (from search_mood_board output)"),
        outputDir: z
            .string()
            .optional()
            .describe("Local directory to save images (defaults to OUTPUT_DIR/mood_board)"),
    }, async ({ images, outputDir }) => {
        const targetDir = outputDir ?? path.join(env.outputDir, "mood_board");
        await fs.mkdir(targetDir, { recursive: true });
        const downloaded = [];
        const failed = [];
        for (const img of images) {
            const filePath = path.join(targetDir, `${img.id}.jpg`);
            try {
                const resp = await fetch(img.downloadUrl);
                if (!resp.ok)
                    throw new Error(`HTTP ${resp.status}`);
                const buffer = Buffer.from(await resp.arrayBuffer());
                await fs.writeFile(filePath, buffer);
                downloaded.push({ id: img.id, path: filePath });
            }
            catch (err) {
                failed.push({ id: img.id, error: String(err) });
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        directory: targetDir,
                        downloaded: downloaded.length,
                        failed: failed.length,
                        files: downloaded,
                        errors: failed,
                    }, null, 2),
                },
            ],
        };
    });
}
//# sourceMappingURL=mood-board.js.map