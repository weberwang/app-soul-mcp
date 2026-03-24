# app-soul-mcp

> GitHub: https://github.com/weberwang/app-soul-mcp

A generic MCP server implementing the **App Soul Injection** workflow — go from a product idea to a designed, brand-accurate app without AI slop.

## Tools

| Tool                       | Step | Description                                                                                                          |
| -------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| `get_brand_guide_prompt`   | 2    | Returns a prompt — calling AI generates the brand guide JSON itself                                                  |
| `save_brand_guide`         | 2    | Save AI-generated brand guide to disk                                                                                |
| `load_brand_guide`         | 2    | Load a previously saved brand guide                                                                                  |
| `download_mood_board`      | 3    | Download images to local dir from URLs extracted by Playwright MCP                                                   |
| `read_image`               | 4    | Return one image to the calling multimodal AI (Copilot) for palette, style, and metaphor analysis                    |
| `read_mood_board_dir`      | 4    | Return all images in a dir to the calling multimodal AI for unified style synthesis                                  |
| `extract_palette`          | 4    | Pixel-level hex extraction (no AI required, works offline)                                                           |
| `extract_palette_from_dir` | 4    | Pixel-level extraction across a directory (no AI required, works offline)                                            |
| `get_design_spec_prompt`   | 4    | Returns a prompt — calling AI generates the full design spec (color tokens, typography, spacing, components, motion) |
| `save_design_spec`         | 4    | Save AI-generated design spec to disk                                                                                |
| `load_design_spec`         | 4    | Load a previously saved design spec                                                                                  |
| `get_prototype_prompt`     | 5    | Returns a prompt for generating a functional prototype in the caller-chosen tech stack                               |
| `get_final_code_prompt`    | 5    | Returns a prompt for generating final implementation code from brand guide + design spec                             |
| `save_code_files`          | 5    | Saves AI-generated files from `<code_file>` blocks (legacy `<file>` also supported)                                 |
| `review_ui_screenshot`     | 6    | Returns a rendered UI screenshot to the calling multimodal AI with a structured visual review prompt                |
| `review_ui_screenshot_dir` | 6    | Returns all screenshots in a directory for multi-screen flow review and consistency checks                           |
| `save_ui_review`           | 6    | Saves structured review JSON for later refinement                                                                    |
| `load_ui_review`           | 6    | Loads a previously saved UI review                                                                                   |

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

This server makes **zero external API calls** — no third-party API keys required.

| Variable     | Required | Purpose                            |
| ------------ | -------- | ---------------------------------- |
| `OUTPUT_DIR` | Optional | Download dir (default: `./output`) |

`extract_palette` / `extract_palette_from_dir` are available as a pixel-level fallback when vision analysis is not needed.

Generated JSON can be wrapped in markdown fences and the save tools will strip them before validation.
`save_brand_guide` and `save_design_spec` now perform structural validation before writing files to disk.

## VS Code MCP Config

Add to `.vscode/mcp.json`. No API keys required.

```json
{
  "servers": {
    "app-soul": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:weberwang/app-soul-mcp"],
      "env": {
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

## Mood Board — Playwright MCP Integration

For gathering App UI design references, use **Playwright MCP** (built into VS Code) alongside this server. Copilot orchestrates both:

```
[Playwright MCP]  browser_navigate(dribbble.com/search?q=...)  
                  browser_snapshot() → extract image URLs  
                        ↓  
[app-soul-mcp]    download_mood_board(urls)  → save to OUTPUT_DIR/mood_board/  
                  read_mood_board_dir()      → Copilot vision analysis  
```

Recommended sources: **Dribbble**, **Mobbin**, **Figma Community** — any site Playwright can browse.
No API keys needed for any of them.

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

get_prototype_prompt or get_final_code_prompt → [Copilot generates code] → save_code_files
  ↓  Step 5: implementation

render app / capture screenshot → review_ui_screenshot → [Copilot returns structured critique JSON]
  ↓  Step 6: visual review and refinement loop

multiple screenshots / flow captures → review_ui_screenshot_dir → save_ui_review
  ↓  Step 6b: multi-screen consistency review
```

## Output Protocols

- Brand guide and design spec prompts use an `_thought` field so reasoning stays inside valid JSON.
- Code generation prompts expect files wrapped in `<code_file name="...">...</code_file>` blocks.
- `save_code_files` remains backward-compatible with legacy `<file name="...">...</file>` blocks.
- `review_ui_screenshot` is designed for render-review loops: feed its JSON critique back into later code or design prompts.
- `save_ui_review` validates the review JSON structure before saving, so screenshot critique can become a reusable refinement artifact.
