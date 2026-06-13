//# Add to server.js imports:
import { registerDatabaseTools } from './tools/database.js';
 

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerComputeTools } from './tools/compute.js';
import { registerFilesystemTools } from './tools/filesystem.js';
import { registerWebTools } from './tools/web.js';
import { registerSystemTools } from './tools/system.js';
import { sanitizeInput } from '../utils/sanitize.js'



// 1. Initialize the MCP Server
const server = new McpServer({
    name: 'mcp-lab-server',
    version: '1.0.0',
    // Define server capabilities
    capabilities: { 
        tools: {}, 
        resources: {}, 
        prompts: {} 
    }
});

// 2. Register all tool modules
registerComputeTools(server);
registerFilesystemTools(server);
registerWebTools(server);
registerSystemTools(server);
registerDatabaseTools(server);

/**
 * 3. Connect using Standard Input/Output (stdio)
 * This is the standard transport for local LLM clients like Claude Desktop.
 */

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  // Sanitize all string arguments before anything else runs
  const cleanArgs = Object.fromEntries(
    Object.entries(args).map(([k, v]) =>
      [k, typeof v === 'string' ? sanitizeInput(v) : v]
    )
  )

  // From here on use cleanArgs instead of args
  if (name === 'compute') {
    return handleCompute(cleanArgs)
  }
  
  if (name === 'web_search') {
    return handleWebSearch(cleanArgs)
  }
  
  // etc
})
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        // Log to stderr because stdout is reserved for MCP JSON-RPC messages
        process.stderr.write('MCP Lab Server v1.0.0 running on stdio\n');
    } catch (error) {
        process.stderr.write(`Failed to start MCP server: ${error.message}\n`);
        process.exit(1);
    }
}

main();
