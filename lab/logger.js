import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// 1. Setup the log path
const LOG_DIR = join(homedir(), 'lab', 'logs');
const LOG_FILE = join(LOG_DIR, 'server.log');

// 2. Ensure the log directory exists BEFORE creating the stream
try {
    if (!existsSync(LOG_DIR)) {
        mkdirSync(LOG_DIR, { recursive: true });
    }
} catch (err) {
    process.stderr.write(`Failed to create log directory: ${err.message}\n`);
}

// 3. Create a write stream (append mode)
const stream = createWriteStream(LOG_FILE, { flags: 'a' });

/**
 * Core logging function
 */
export function log(level, tool, message, data = {}) {
    const entry = JSON.stringify({
        ts: new Date().toISOString(),
        level: level.toUpperCase(),
        tool,
        message,
        ...data
    });

    // Write to the persistent log file
    stream.write(entry + '\n');

    // In MCP, always push errors (and optionally info) to stderr 
    // so the host (Claude) can see them in its own logs.
    if (level === 'error' || level === 'info') {
        process.stderr.write(entry + '\n');
    }
}

export const logger = {
    info: (tool, msg, d) => log('info', tool, msg, d),
    warn: (tool, msg, d) => log('warn', tool, msg, d),
    error: (tool, msg, d) => log('error', tool, msg, d),
};