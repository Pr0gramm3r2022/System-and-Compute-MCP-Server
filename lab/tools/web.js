// lab/tools/web.js
import { z } from 'zod'; //  Added clean import
import { logger } from '../logger.js';

export function registerWebTools(server) {
  server.tool(
    'http_get',
    'Perform an HTTP GET request to a URL.',
    {
      url: z.string().url().describe('Full URL including https://'),
      // Fix: z.record maps (keyType, valueType) explicitly
      headers: z.record(z.string(), z.string()).optional().describe('Optional request headers'),
    },
    async ({ url, headers = {} }) => {
      logger.info('http_get', 'Fetching', { url });
      try {
        const response = await fetch(url, { 
          headers: { 
            'User-Agent': 'curl/7.64.1', 
            ...headers 
          } 
        });

        const body = await response.text();
        const result = {
          status: response.status,
          body: body.slice(0, 4000) + (body.length > 4000 ? '...[truncated]' : '')
        };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
}