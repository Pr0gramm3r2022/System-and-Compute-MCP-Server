//import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requireAuth } from '../middleware/auth.js';
import { protectedResourceMetadata } from '../middleware/oauth.js';
import { globalLimiter } from '../middleware/ratelimit.js';
import { registerComputeTools }    from '../lab/tools/compute.js';
import { registerFilesystemTools } from '../lab/tools/filesystem.js';
import { registerDatabaseTools }   from '../lab/tools/database.js';
import { registerWebTools }        from '../lab/tools/web.js';
import { registerSystemTools }     from '../lab/tools/system.js';
//rewrote file paths using grep
//dotenv.config();
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
 
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req.ip)
  //need an api key 
}); 
 
const app = express();
// Behind a proxy (dev container / Codespaces forwarder), so trust the
// X-Forwarded-For header for accurate client IPs in rate limiting.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(globalLimiter);
  
// Root helper route
app.get('/', (_, res) => res.json({
  status: 'ok',
  message: 'HTTP MCP Server is running',
  routes: [
    '/health',
    '/mcp (POST, Streamable HTTP, requires Authorization: Bearer)',
    '/sse (legacy SSE, requires Authorization: Bearer)',
    '/messages (POST, legacy SSE, requires Authorization: Bearer)'
  ]
}));

// Health check (no auth required)
app.get('/health', (_, res) => res.json({ status:'ok', ts:new Date().toISOString() }));

// OAuth discovery for MCP clients (no auth required)
app.get('/.well-known/oauth-protected-resource', protectedResourceMetadata);

function createServer() {
  const server = new McpServer({ name:'mcp-lab-server', version:'1.0.0' });
  registerComputeTools(server);
  registerFilesystemTools(server);
  registerDatabaseTools(server);
  registerWebTools(server);
  registerSystemTools(server);
  return server;
}

// Streamable HTTP endpoint (current MCP transport).
// Stateless: a fresh server + transport per request, so it works across
// multiple Cloud Run instances without sticky sessions.
app.post('/mcp', requireAuth, async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc:'2.0', error:{ code:-32603, message:'Internal server error' }, id:null });
    }
  }
});

// Stateless mode has no server-initiated stream or session to delete.
const methodNotAllowed = (_, res) => res.status(405).set('Allow', 'POST').json({
  jsonrpc:'2.0', error:{ code:-32000, message:'Method not allowed.' }, id:null
});
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

// Session store: one McpServer instance per active SSE connection
const sessions = new Map();

// SSE endpoint (legacy transport): client connects here first
app.get('/sse', requireAuth, (req, res) => {
  const server = createServer();

  const transport = new SSEServerTransport('/messages', res);
  sessions.set(transport.sessionId, transport);
 
  server.connect(transport);
 
  req.on('close', () => {
    sessions.delete(transport.sessionId);
    console.error(`Session closed: ${transport.sessionId}`);
  });
});
 
// Message endpoint: client posts JSON-RPC here
app.post('/messages', requireAuth, (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sessions.get(sessionId);
  if (!transport) return res.status(404).json({ error:'Session not found' });
  // express.json() already consumed the body stream, so hand the parsed body to the transport
  transport.handlePostMessage(req, res, req.body);
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.error(`HTTP MCP Server listening on :${PORT}`));
