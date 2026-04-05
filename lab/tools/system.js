import { execSync } from 'child_process';
import { logger } from '../logger.js';

/**
 * Registers system-level diagnostic tools.
 */
export function registerSystemTools(server) {
    server.tool(
        'system_info',
        'Return operating system, CPU, memory, Node version, and uptime. Safe read-only operation.',
        {},
        async () => {
            logger.info('system_info', 'Fetching system metrics');

            const info = {
                platform: process.platform,
                arch: process.arch,
                node: process.version,
                uptime: `${Math.floor(process.uptime())}s`,
                pid: process.pid,
                // Convert bytes to MB for better readability
                memUsedMB: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
                memTotalMB: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024),
            };

            try {
                // nproc is standard on Linux, but we add a fallback for /proc/cpuinfo
                const cpuOutput = execSync('nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo').toString().trim();
                info.cpuCores = parseInt(cpuOutput);

                // Updated disk check: 'df -h' is more universal than 'df -BG'
                // This targets the root partition and pulls the 'Available' column
                const diskOutput = execSync("df -h / --output=avail | tail -1").toString().trim();
                info.diskAvailable = diskOutput;
            } catch (error) {
                logger.warn('system_info', 'Could not fetch shell-based metrics', { error: error.message });
            }

            return { 
                content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] 
            };
        }
    );
}