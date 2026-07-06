import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { requireApiKey } from './middleware/auth.js';
import { globalLimiter } from './middleware/ratelimit.js';
import { registerComputeTools }    from './tools/compute.js';
import { registerFilesystemTools } from './tools/filesystem.js';
import { registerDatabaseTools }   from './tools/database.js';
import { registerWebTools }        from './tools/web.js';
import { registerSystemTools }     from './tools/system.js';
 
const app = express();
app.use(cors());
app.use(express.json());
app.use(globalLimiter);
 
// Health check (no auth required)
app.get('/health', (_, res) => res.json({ status:'ok', ts:new Date().toISOString() }));
 // Session store: one McpServer instance per active SSE connection
const sessions = new Map();
 
// SSE endpoint: client connects here first
app.get('/sse', requireApiKey, (req, res) => {
  const server = new McpServer({ name:'mcp-lab-server', version:'1.0.0' });
  registerComputeTools(server);
  registerFilesystemTools(server);
  registerDatabaseTools(server);
  registerWebTools(server);
  registerSystemTools(server);
 
  const transport = new SSEServerTransport('/messages', res);
  sessions.set(transport.sessionId, transport);
 
  server.connect(transport);
 
  req.on('close', () => {
    sessions.delete(transport.sessionId);
    console.error(`Session closed: ${transport.sessionId}`);
  });
});
 
// Message endpoint: client posts JSON-RPC here
app.post('/messages', requireApiKey, (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sessions.get(sessionId);
  if (!transport) return res.status(404).json({ error:'Session not found' });
  transport.handlePostMessage(req, res);
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.error(`HTTP MCP Server listening on :${PORT}`));
