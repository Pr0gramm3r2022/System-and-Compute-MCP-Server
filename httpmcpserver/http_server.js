import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { requireApiKey } from '../middleware/auth.js';
import { globalLimiter } from '../middleware/ratelimit.js';
import { registerComputeTools }    from '../lab/tools/compute.js';
import { registerFilesystemTools } from '../lab/tools/filesystem.js';
import { registerDatabaseTools }   from '../lab/tools/database.js';
import { registerWebTools }        from '../lab/tools/web.js';
import { registerSystemTools }     from '../lab/tools/system.js';
//rewrote file paths using grep
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
  routes: ['/health', '/sse (requires x-api-key)', '/messages (POST, requires x-api-key)']
}));

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
