// utils/sanitize.js — module level, exportable, testable

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
