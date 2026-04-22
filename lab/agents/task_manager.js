//# ~/lab/agents/task_manager.js
/*import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runAgentLoop } from './agent_loop.js';
import { PM_SYSTEM_PROMPT } from './prompts/pm_system.js';
import readline from 'readline';
import { join } from 'path';
import { homedir } from 'os';
 
// ── Connect to MCP Server ──────────────────────────────────────
const transport = new StdioClientTransport({
  command: 'node',
  args: [join(homedir(),'lab','mcp-server','server.js')]
});
const mcpClient = new Client({ name:'task-manager', version:'1.0.0' });
await mcpClient.connect(transport);
console.log('Connected to MCP Server.');
 
// ── Load tool list ─────────────────────────────────────────────
const { tools: rawTools } = await mcpClient.listTools();
const tools = rawTools.map(t=>({ name:t.name, description:t.description, input_schema:t.inputSchema }));
console.log(`Loaded ${tools.length} tools: ${tools.map(t=>t.name).join(', ')}\n`);
 
// ── Tool executor ──────────────────────────────────────────────
async function toolExecutor(name, input) {
  const r = await mcpClient.callTool({ name, arguments: input });
  return r.content.map(c=>c.text).join('\n');
}
 
// ── Interactive REPL ───────────────────────────────────────────
const rl = readline.createInterface({ input:process.stdin, output:process.stdout });
console.log('Autonomous Project Manager ready.');
console.log('Type your instruction. Press Ctrl+C to exit.\n');
 
function prompt() {
  rl.question('You: ', async (input) => {
    if (!input.trim()) { prompt(); return; }
 
    console.log('');
    const res = await runAgentLoop({
      systemPrompt: PM_SYSTEM_PROMPT,
      userMessage:  input.trim(),
      tools,
      toolExecutor,
      maxIterations: 25,
      onToolCall: (name, inp, result) => {
        console.log(`  [Tool: ${name}] => ${String(result).slice(0,100)}`);
    }
    });
 
    console.log(`\nAgent: ${res.result}`);
    console.log(`(${res.iterations} iterations)\n`);
    prompt();
  });
}
 
prompt();
rl.on('close', async () => { await mcpClient.close(); process.exit(0); });*/


// lab/agents/task_manager.js

/*import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PM_SYSTEM_PROMPT } from '../prompts/pm_system.js'; // 

// Dynamically resolve paths to avoid "Module Not Found" errors [cite: 131]
const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../server.js'); 

async function main() {
    // 1. Initialize Transport pointing to the absolute path of your server [cite: 132-135]
    const transport = new StdioClientTransport({
        command: 'node',
        args: [SERVER_PATH], 
    });

    // 2. Initialize the MCP Client
    const client = new Client({
        name: "task-manager", //name was task-manager-agent
        version: "1.0.0"
    }, {
        capabilities: {
            tools: {}
        }
    });

    try {
        // 3. Connect to the Server
        await client.connect(transport);
        console.log('✅ Connected to MCP Server.'); // [cite: 249]
        
        // 4. List available tools to verify connection [cite: 243]
        const { tools } = await client.listTools();
        console.log(`✅ Loaded ${tools.length} tools.`);
        console.log('🚀 Autonomous Project Manager ready.'); // [cite: 251]
        
        // Note: You would add your agent loop logic here
        
    } catch (error) {
        // Handle Issue 6: Cascade errors [cite: 148, 166]
        console.error('❌ Failed to connect to MCP Server.');
        console.error('Tip: Run "node ../server.js" directly to see if the server is crashing.');
        process.exit(1);
    }
}

main();*/

// lab/agents/task_manager.js
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// 1. Resolve paths OUTSIDE the function so they are global [cite: 608-609]
const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../server.js'); 

async function main() {
  try {
    // 2. Initialize transport inside the function [cite: 278]
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH], // Points to /workspaces/mcpAgentLab/lab/server.js
    });

    const client = new Client({ name: 'task-manager', version: '1.0.0' });

    // 3. Establish the connection [cite: 278, 561]
    await client.connect(transport);
    console.log('✅ Connected to MCP Server.');

    // ... your REPL or agent loop logic goes here ...

  } catch (error) {
    // Handle Issue 6: Cascade errors [cite: 625-626, 644]
    console.error('❌ Connection failed. Ensure server.js is in the lab root.');
    process.exit(1);
  }
}

main(); // Don't forget to actually call the function!