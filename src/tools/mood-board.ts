import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import fetch from "node-fetch";
import path from "path";
import { z } from "zod";
import { env } from "../lib/env.js";

function extensionFromMimeType(contentType: string | null): string | null {
  const mimeType = contentType?.split(";")[0].trim().toLowerCase();
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return null;
}

function extensionFromBuffer(buffer: Buffer): string | null {
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
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
    return "png";
  }

  if (
    buffer.length >= 6 &&
    (buffer.toString("ascii", 0, 6) === "GIF87a" ||
      buffer.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "gif";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }

  return null;
}

function extensionFromUrl(url: string): string | null {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "")
    ? ext === "jpeg"
      ? "jpg"
      : ext ?? null
    : null;
}

export function registerMoodBoardTools(server: McpServer): void {
  server.tool(
    "download_mood_board",
    "Download mood board reference images to a local directory from a list of URLs. URLs are typically extracted by an external browser/crawler MCP (e.g. Playwright MCP) browsing Dribbble, Mobbin, Figma Community, etc.",
    {
      images: z
        .array(
          z.object({
            id: z.string().describe("Unique identifier for the image (used as filename)"),
            downloadUrl: z.string().url().describe("Direct image URL to download"),
            description: z.string().optional().describe("Optional label for this image"),
          }),
        )
        .describe("Images to download — pass URLs extracted from any design reference site"),
    },
    async ({ images }) => {
      const targetDir = path.join(env.outputDir, "mood_board");
      await fs.mkdir(targetDir, { recursive: true });

      const downloaded: { id: string; path: string }[] = [];
      const failed: { id: string; error: string }[] = [];

      for (const img of images) {
        try {
          const resp = await fetch(img.downloadUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const buffer = Buffer.from(await resp.arrayBuffer());
          const safeExt =
            extensionFromMimeType(resp.headers.get("content-type")) ??
            extensionFromBuffer(buffer) ??
            extensionFromUrl(img.downloadUrl) ??
            "jpg";
          const filePath = path.join(targetDir, `${img.id}.${safeExt}`);
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
