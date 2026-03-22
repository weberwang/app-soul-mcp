import fs from "fs/promises";
import fetch from "node-fetch";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";
export function registerMoodBoardTools(server) {
    server.tool("download_mood_board", "Download mood board reference images to a local directory from a list of URLs. URLs are typically extracted by an external browser/crawler MCP (e.g. Playwright MCP) browsing Dribbble, Mobbin, Figma Community, etc.", {
        images: z
            .array(z.object({
            id: z.string().describe("Unique identifier for the image (used as filename)"),
            downloadUrl: z.string().url().describe("Direct image URL to download"),
            description: z.string().optional().describe("Optional label for this image"),
        }))
            .describe("Images to download — pass URLs extracted from any design reference site"),
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
            const ext = img.downloadUrl.split("?")[0].split(".").pop()?.toLowerCase();
            const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "") ? ext : "jpg";
            const filePath = path.join(targetDir, `${img.id}.${safeExt}`);
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