# app-soul-mcp

> GitHub: https://github.com/weberwang/app-soul-mcp

A generic MCP server implementing the **App Soul Injection** workflow — go from a product idea to a designed, brand-accurate app without AI slop.

## Tools

| Tool                       | Step | Description                                                                                                          |
| -------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| `get_brand_guide_prompt`   | 2    | Returns a prompt — calling AI generates the brand guide JSON itself                                                  |
| `save_brand_guide`         | 2    | Save AI-generated brand guide to disk                                                                                |
| `load_brand_guide`         | 2    | Load a previously saved brand guide                                                                                  |
| `search_mood_board`        | 3    | Search Unsplash by keywords                                                                                          |
| `download_mood_board`      | 3    | Download mood board images to local dir                                                                              |
| `read_image`               | 4    | Return one image to the calling multimodal AI (Copilot) for palette, style, and metaphor analysis                    |
| `read_mood_board_dir`      | 4    | Return all images in a dir to the calling multimodal AI for unified style synthesis                                  |
| `extract_palette`          | 4    | Pixel-level hex extraction (no AI required, works offline)                                                           |
| `extract_palette_from_dir` | 4    | Pixel-level extraction across a directory (no AI required, works offline)                                            |
| `get_design_spec_prompt`   | 4    | Returns a prompt — calling AI generates the full design spec (color tokens, typography, spacing, components, motion) |
| `save_design_spec`         | 4    | Save AI-generated design spec to disk                                                                                |
| `load_design_spec`         | 4    | Load a previously saved design spec                                                                                  |

## Setup

No local install required — run directly from GitHub via `npx`:

```bash
npx github:weberwang/app-soul-mcp
```

Or clone and build locally:

```bash
git clone https://github.com/weberwang/app-soul-mcp.git
cd app-soul-mcp
npm install
npm run build
```

## Required Environment

This server makes **zero external AI API calls**. All text generation and image analysis are handled by the calling AI (Copilot). `read_image` and `read_mood_board_dir` return raw image data to Copilot, which analyzes them directly using its own vision model.

| Variable              | Required | Purpose                            |
| --------------------- | -------- | ---------------------------------- |
| `UNSPLASH_ACCESS_KEY` | Required | Mood board image search            |
| `OUTPUT_DIR`          | Optional | Download dir (default: `./output`) |

`extract_palette` / `extract_palette_from_dir` are available as a pixel-level fallback when vision analysis is not needed.

## VS Code MCP Config

Add to `.vscode/mcp.json`. VS Code will prompt you for the Unsplash key on first use and cache it per workspace — no `.env` file needed.

```json
{
  "inputs": [
    {
      "id": "unsplashKey",
      "type": "promptString",
      "description": "Unsplash Access Key (https://unsplash.com/developers)",
      "password": false
    }
  ],
  "servers": {
    "app-soul": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:weberwang/app-soul-mcp"],
      "env": {
        "UNSPLASH_ACCESS_KEY": "${input:unsplashKey}",
        "OUTPUT_DIR": "${workspaceFolder}/output"
      }
    }
  }
}
```

If you cloned the repo locally, use `node` instead:

```json
"command": "node",
"args": ["/path/to/app-soul-mcp/build/index.js"]
```

## Workflow Order

```
get_brand_guide_prompt → [Copilot generates brand guide] → save_brand_guide
  ↓  Step 2: brand soul

search_mood_board → download_mood_board
  ↓  Step 3: visual inspiration (or manually download from cosmos.so)

read_mood_board_dir → [Copilot analyzes images]     ← vision model required
  or: extract_palette_from_dir                       ← pixel fallback, no AI
  ↓  Step 4: visual extraction

get_design_spec_prompt → [Copilot generates spec] → save_design_spec
     Output: color tokens (light+dark), typography scale, spacing system,
             component dimensions, motion guidelines, accessibility rules
```
