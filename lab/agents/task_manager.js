
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import readline from 'readline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runAgentLoop } from './mcp_agent.js'; 
import { PM_SYSTEM_PROMPT } from '../prompts/pm_system.js';

// ── Connect cleanly using inherited environment streams ──────────
const transport = new StdioClientTransport({
  command: 'node',
  args: [resolve(dirname(fileURLToPath(import.meta.url)), '../server.js')],
  // 🛡️ Explicitly detach all terminal configuration from this channel
  spawnOptions: { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
});

const mcpClient = new Client(
  { name: 'task-manager', version: '1.0.0' },
  { capabilities: {} }
);

await mcpClient.connect(transport);
console.log('✅ Connected to MCP Server.');

// ── Load & format tools for Anthropic SDK ─────────────────────
const { tools: rawTools } = await mcpClient.listTools();
const tools = rawTools.map(t => ({
  name:         t.name,
  description:  t.description,
  input_schema: t.inputSchema,   // Anthropic expects input_schema, not inputSchema
}));
console.log(`✅ Loaded ${tools.length} tools: ${tools.map(t => t.name).join(', ')}\n`);

// ── Tool executor: routes Claude's calls to MCP server ─────────
async function toolExecutor(name, input) {
  const result = await mcpClient.callTool({ name, arguments: input });
  return result.content.map(c => c.text).join('\n');
}

// ── Interactive REPL ───────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('🚀 Autonomous Project Manager ready.');
console.log('Type your instruction. Press Ctrl+C to exit.\n');

function prompt() {
  rl.question('You: ', async (input) => {
    if (!input.trim()) { prompt(); return; }

    console.log('\nAgent is thinking...');

    const res = await runAgentLoop({
      systemPrompt: PM_SYSTEM_PROMPT,
      userMessage:  input.trim(),
      tools,
      toolExecutor,
      maxIterations: 25,
      onToolCall: (name, inp, result) => {
        console.log(`   [Tool: ${name}] => ${String(result).slice(0, 100)}`);
      },
    });

    console.log(`\nAgent: ${res.result}`);
    console.log(`(${res.iterations} iteration${res.iterations !== 1 ? 's' : ''})\n`);
    prompt();
  });
}

prompt();
rl.on('close', async () => {
  await mcpClient.close();
  process.exit(0);
});