//# ~/lab/agents/task_manager.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runAgentLoop } from './agent_loop.js';
import { PM_SYSTEM_PROMPT } from '../prompts/pm_system.js';
import readline from 'readline';
import { join } from 'path';
import { homedir } from 'os';
 
// ── Connect to MCP Server ──────────────────────────────────────
const transport = new StdioClientTransport({
  command: 'node',
 // args: [join(homedir(),'lab','mcp-server','server.js')]
 args: ['/workspaces/mcpAgentLab/lab/server.js']
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
rl.on('close', async () => { await mcpClient.close(); process.exit(0); });
