#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "dotenv/config";
import { registerAssetTools } from "./tools/asset-generator.js";
import { registerBrandGuideTools } from "./tools/brand-guide.js";
import { registerCodeTools } from "./tools/code-generator.js";
import { registerDesignSpecTools } from "./tools/design-spec.js";
import { registerMoodBoardTools } from "./tools/mood-board.js";
import { registerPaletteTools } from "./tools/palette.js";

const server = new McpServer({
  name: "app-soul-mcp",
  version: "1.1.0",
});

registerBrandGuideTools(server);
registerMoodBoardTools(server);
registerPaletteTools(server);
registerAssetTools(server);
registerDesignSpecTools(server);
registerCodeTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
