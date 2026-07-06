
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
 
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
const API_KEY    = process.env.MCP_API_KEY    || 'your-api-key';
 
const transport = new SSEClientTransport(
  new URL(`${SERVER_URL}/sse`),
  { headers: { Authorization: `Bearer ${API_KEY}` } }
);
 
const client = new Client({ name:'http-client', version:'1.0.0' });
await client.connect(transport);
console.log('Connected to HTTP MCP Server');
 
const { tools } = await client.listTools();
console.log('Available tools:', tools.map(t=>t.name).join(', '));
 
// Example tool call
const result = await client.callTool({
  name: 'system_info', arguments: {}
});
console.log(result.content[0].text);
await client.close();
