import { z } from 'zod/v4';
import { logger } from '../logger.js';

/*export function registerWebTools(server) {
    server.tool(
        'http_get',
        'Perform an HTTP GET request to a URL. Returns status code, headers, and body (truncated to 4000 chars). Only use for public APIs.',
        {
            url: z.string().url().describe('Full URL including https://'),
            headers: z.record(z.string(), z.string()).optional().describe('Optional request headers as key-value pairs'), //was Optional request headers as key-value pairs'
        },
        async ({ url, headers = {} }) => {
            logger.info('http_get', 'Fetching', { url });

            // Set a 10-second timeout to prevent the server from hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const res = await fetch(url, { 
                    headers,
                    signal: controller.signal 
                });
                
                const body = await res.text();
                clearTimeout(timeoutId);

                const result = {
                    status: res.status,
                    statusText: res.statusText,
                    contentType: res.headers.get('content-type'),
                    // Cleanly handle truncation
                    body: body.length > 4000 ? body.slice(0, 4000) + '...[truncated]' : body
                };

                return { 
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] 
                };
            } catch (e) {
                clearTimeout(timeoutId);
                const errorMessage = e.name === 'AbortError' 
                    ? 'Request timed out after 10 seconds' 
                    : e.message;
                    
                return { 
                    content: [{ type: 'text', text: `Error: ${errorMessage}` }], 
                    isError: true 
                };
            }
        }
    );
}*/

// lab/tools/web.js
export function registerWebTools(server) {
  server.tool(
    'http_get',
    'Perform an HTTP GET request to a URL.',
    {
      url: z.string().url().describe('Full URL including https://'),
      headers: z.record(z.string()).optional().describe('Optional request headers'),
    },
    async ({ url, headers = {} }) => {
      logger.info('http_get', 'Fetching', { url });
      try {
        // MERGE HEADERS: Force User-Agent to 'curl' so wttr.in returns text
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