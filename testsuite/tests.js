// ~/lab/tests/integration/http_server.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let client;
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
const API_KEY = process.env.MCP_API_KEY || 'test-key-123';

beforeAll(async () => {
  // Initialize the SSE client transport with the required Authorization header
  const transport = new SSEClientTransport(
    new URL(`${SERVER_URL}/sse`),
    { 
      headers: { 
        Authorization: `Bearer ${API_KEY}` 
      } 
    }
  );

  client = new Client({ name: 'http-integration-test-client', version: '1.0.0' });
  await client.connect(transport);
});

afterAll(async () => {
  if (client) {
    await client.close();
  }
});

describe('HTTP MCP Server Integration Tests', () => {
  
  it('successfully lists available tools from the HTTP server', async () => {
    const { tools } = await client.listTools();
    expect(tools).toBeDefined();
    expect(tools.length).toBeGreaterThan(0);
    
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('system_info');
  });

  it('executes the calculate tool over HTTP transport', async () => {
    const r = await client.callTool({
      name: 'calculate',
      arguments: { expression: '10 + 5 * 2' }
    });
    
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain('20');
  });

  it('executes the system_info tool over HTTP transport', async () => {
    const r = await client.callTool({
      name: 'system_info',
      arguments: {}
    });
    
    expect(r.isError).toBeFalsy();
    const info = JSON.parse(r.content[0].text);
    expect(info.platform).toBeDefined();
    expect(info.node).toBeDefined();
  });

  it('handles unauthorized requests when API key is missing or invalid', async () => {
    const badTransport = new SSEClientTransport(
      new URL(`${SERVER_URL}/sse`),
      { headers: { Authorization: 'Bearer wrong-key' } }
    );
    
    const badClient = new Client({ name: 'bad-client', version: '1.0.0' });
    
    await expect(badClient.connect(badTransport)).rejects.toThrow();
  });
});