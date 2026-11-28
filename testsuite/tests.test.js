// ~/lab/tests/integration/http_server.test.js
// ~/lab/tests/integration/http_server.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

let client;
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
const API_KEY = process.env.MCP_API_KEY || 'test-key-123';

// Helper factory to build transports with custom Authorization headers
function createTransport(apiKey) {
  return new SSEClientTransport(
    new URL(`${SERVER_URL}/sse`),
    {
      // Custom fetch for EventSource/SSE GET request handshake
      eventSourceInit: {
        fetch: (url, init) => {
          const headers = new Headers(init?.headers || {});
          if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
          return fetch(url, { ...init, headers });
        }
      },
      // Headers for subsequent JSON-RPC message POST requests
      requestInit: {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      }
    }
  );
}

beforeAll(async () => {
  const transport = createTransport(API_KEY);
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
  const toolNames = tools.map(t => t.name);
  expect(toolNames).toContain('add'); // Updated from 'calculate'
  expect(toolNames).toContain('system_info');
});

it('executes the add tool over HTTP transport', async () => {
  const r = await client.callTool({
    name: 'add',
    arguments: { a: 10, b: 10 } // Adjusted to match discrete parameter handlers if applicable
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
    const badTransport = createTransport('wrong-key');
    const badClient = new Client({ name: 'bad-client', version: '1.0.0' });
    
    await expect(badClient.connect(badTransport)).rejects.toThrow();
  });
});