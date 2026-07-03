// Drives mcp-lab-server over stdio and computes the volume of a
// regular tetrahedron with edge length 5 — every arithmetic step
// runs through the server's compute tools (multiply, sqrt, divide).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/workspaces/mcpAgentLab/lab/server.js'],
});

const client = new Client({ name: 'tetra-client', version: '1.0.0' });
await client.connect(transport);

const tools = (await client.listTools()).tools.map(t => t.name);
console.log('Tools available on server:', tools.join(', '));

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) throw new Error(res.content[0].text);
  return Number(res.content[0].text.replace('Result:', '').trim());
};

const a = 5;

// V = a³ / (6 · √2)
const aSq     = await call('multiply', { a, b: a });         // 25
const aCubed  = await call('multiply', { a: aSq, b: a });    // 125
const root2   = await call('sqrt',     { a: 2 });            // √2
const denom   = await call('multiply', { a: 6, b: root2 });  // 6√2
const volume  = await call('divide',   { a: aCubed, b: denom });

console.log(`a*a      = ${aSq}       (multiply)`);
console.log(`a*a*a    = ${aCubed}      (multiply)`);
console.log(`sqrt(2)  = ${root2}  (sqrt)`);
console.log(`6*sqrt2  = ${denom}  (multiply)`);
console.log(`Volume   = ${volume}  (divide)`);

await client.close();
