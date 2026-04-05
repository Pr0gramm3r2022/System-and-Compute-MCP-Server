import { z } from 'zod/v4';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { logger } from '../logger.js';

// Restrict all file access to the lab directory for safety
const LAB_ROOT = resolve(homedir(), 'lab');

// Ensure the lab directory exists on startup
if (!existsSync(LAB_ROOT)) {
    mkdirSync(LAB_ROOT, { recursive: true });
}

/**
 * Security Helper: Resolves paths and prevents directory traversal attacks.
 * Using resolve() is safer than join() because it handles '..' segments properly.
 */
function safePath(p) {
    const resolved = resolve(LAB_ROOT, p);
    if (!resolved.startsWith(LAB_ROOT)) {
        throw new Error('Path traversal blocked: Access outside of ~/lab/ is prohibited.');
    }
    return resolved;
}

export function registerFilesystemTools(server) {
    // --- READ FILE ---
    server.tool(
        'read_file',
        'Read a text file from the lab directory. Returns file contents as a string. Path is relative to ~/lab/.',
        { path: z.string().describe('Relative path within ~/lab/, e.g. logs/server.log') },
        async ({ path }) => {
            logger.info('read_file', 'Reading', { path });
            try {
                const full = safePath(path);
                if (!existsSync(full) || statSync(full).isDirectory()) {
                    return { 
                        content: [{ type: 'text', text: `File not found or is a directory: ${path}` }], 
                        isError: true 
                    };
                }
                const content = readFileSync(full, 'utf8');
                return { content: [{ type: 'text', text: content }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
            }
        }
    );

    // --- WRITE FILE ---
    server.tool(
        'write_file',
        'Write text content to a file in the lab directory. Creates the file if it does not exist. OVERWRITES existing content.',
        {
            path: z.string().describe('Relative path within ~/lab/'),
            content: z.string().describe('Text content to write'),
        },
        async ({ path, content }) => {
            logger.info('write_file', 'Writing', { path, bytes: content.length });
            try {
                const full = safePath(path);
                
                // Ensure the directory exists before writing the file
                const dir = dirname(full);
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }

                writeFileSync(full, content, 'utf8');
                return { content: [{ type: 'text', text: `Written ${content.length} bytes to ${path}` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
            }
        }
    );

    // --- LIST DIRECTORY ---
    server.tool(
        'list_directory',
        'List files and subdirectories at a path within ~/lab/. Returns names, sizes, and types.',
        { path: z.string().default('.').describe('Relative path within ~/lab/, default is root') },
        async ({ path }) => {
            try {
                const full = safePath(path);
                if (!existsSync(full)) {
                    return { content: [{ type: 'text', text: `Directory not found: ${path}` }], isError: true };
                }

                const entries = readdirSync(full).map(name => {
                    const st = statSync(join(full, name));
                    const type = st.isDirectory() ? 'DIR ' : 'FILE';
                    const size = st.isFile() ? `${st.size}B` : '';
                    return `${type.padEnd(5)} ${name.padEnd(40)} ${size}`;
                });

                return { content: [{ type: 'text', text: entries.join('\n') || '(empty)' }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}