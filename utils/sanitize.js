// utils/sanitize.js — module level, exportable, testable

//need to import the server.js file


async function main() {
  // use sanitizeInput here
  // but don't define it here
 // # Input sanitizer (add to your agent wrapper)
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  
  return input
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/ignore\s+(previous|all)\s+instructions/gi, '[FILTERED]')
    .replace(/system\s*prompt/gi, '[FILTERED]')
    .trim()
    .slice(0, 2000)
}


}