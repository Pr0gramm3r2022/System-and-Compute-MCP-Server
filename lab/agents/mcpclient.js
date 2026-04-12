//
//# ~/lab/agents/mcp_agent.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runAgentLoop } from './agent_loop.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
 
// Connect to MCP server
const transport = new StdioClientTransport({
  command: 'node',
  args: [join(homedir(),'lab','mcp-server','server.js')]
});
const mcpClient = new Client({ name:'mcp-agent', version:'1.0.0' });
await mcpClient.connect(transport);
 
// Get tool list from MCP server
const { tools: rawTools } = await mcpClient.listTools();
const tools = rawTools.map(t => ({
  name:         t.name,
  description:  t.description,
  input_schema: t.inputSchema
}));
 
// Tool executor: routes calls to MCP server
async function toolExecutor(name, input) {
  const result = await mcpClient.callTool({ name, arguments: input });
  return result.content.map(c => c.text).join('\n');
}
 
// Load project context from CLAUDE.md
const context = readFileSync(join(homedir(),'lab','CLAUDE.md'), 'utf8');

const systemPrompt = `You are an expert AI engineer assistant.\n\n${context}`;
 
// Run a task
const userMessage = process.argv[2] || 'List all files in the lab directory and summarize what you find.';
console.log(`Task: ${userMessage}\n`);
 
const result = await runAgentLoop({
  systemPrompt,
  userMessage,
  tools,
  toolExecutor,
  onToolCall: (name, input, res) => {
    console.log(`  [${name}] ${JSON.stringify(input).slice(0,60)}`);
    console.log(`  => ${String(res).slice(0,120)}\n`);
  }
});
 
console.log(`\nResult (${result.iterations} iterations):`);
console.log(result.result);
 
await mcpClient.close();

