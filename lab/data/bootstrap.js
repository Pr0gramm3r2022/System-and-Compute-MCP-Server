cat > /workspaces/mcpAgentLab/lab/scripts/bootstrap.js << 'EOF'
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb } from '../data/db.js';

const LAB = '/workspaces/mcpAgentLab/lab';
const checks = [
  ['ANTHROPIC_API_KEY', () => !!process.env.ANTHROPIC_API_KEY],
  ['Node v20+',         () => parseInt(process.version.slice(1)) >= 20],
  ['server.js',         () => existsSync(join(LAB, 'server.js'))],
  ['tools/database.js', () => existsSync(join(LAB, 'tools/database.js'))],
  ['data/db.js',        () => existsSync(join(LAB, 'data/db.js'))],
  ['prompts/pm_system.js', () => existsSync(join(LAB, 'prompts/pm_system.js'))],
];

let pass = true;
console.log("--- MCP Lab Health Check ---");
for (const [name, check] of checks) {
  const ok = check();
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) pass = false;
}

try {
  const db = getDb();
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`✅ SQLite: ${t.map(x => x.name).join(', ')}`);
} catch (e) {
  console.log(`❌ SQLite: ${e.message}`);
  pass = false;
}

console.log(pass ? '\n✅ Lab ready.' : '\n❌ Fix above issues first.');
EOF