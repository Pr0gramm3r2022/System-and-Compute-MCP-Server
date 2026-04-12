// ~/lab/tools/database.js
import { getDb } from '../data/db.js';
import { z } from 'zod';

// ── Schema bootstrap (runs once on first connection) ───────────
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      priority    TEXT    DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      status      TEXT    DEFAULT 'todo'   CHECK(status   IN ('todo','in_progress','done')),
      due_date    TEXT,
      created_at  TEXT    DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      tags       TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );
  `);
}

// ── Register all database tools ────────────────────────────────
export function registerDatabaseTools(server) {
  const db = getDb();
  initSchema(db);

  // ── TASKS ──────────────────────────────────────────────────

  server.tool(
    'create_task',
    'Create a new task',
    {
      title:       z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      priority:    z.enum(['low', 'medium', 'high']).default('medium'),
      due_date:    z.string().optional().describe('Due date YYYY-MM-DD'),
      status:      z.enum(['todo', 'in_progress', 'done']).default('todo'),
    },
    async ({ title, description = '', priority, due_date = null, status }) => {
      const stmt = db.prepare(`
        INSERT INTO tasks (title, description, priority, due_date, status)
        VALUES (?, ?, ?, ?, ?)
      `);
      const { lastInsertRowid } = stmt.run(title, description, priority, due_date, status);
      return { content: [{ type: 'text', text: `Task created: [#${lastInsertRowid}] ${title}` }] };
    }
  );

  server.tool(
    'list_tasks',
    'List tasks, optionally filtered by status or priority',
    {
      status:   z.enum(['todo', 'in_progress', 'done', 'all']).default('all'),
      priority: z.enum(['low', 'medium', 'high', 'all']).default('all'),
    },
    async ({ status, priority }) => {
      let query = 'SELECT * FROM tasks WHERE 1=1';
      const params = [];
      if (status   !== 'all') { query += ' AND status = ?';   params.push(status); }
      if (priority !== 'all') { query += ' AND priority = ?'; params.push(priority); }
      query += " ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id";

      const tasks = db.prepare(query).all(...params);
      if (tasks.length === 0) return { content: [{ type: 'text', text: 'No tasks found.' }] };

      const lines = tasks.map(t =>
        `#${t.id} [${t.status}] [${t.priority}] ${t.title}` +
        (t.due_date    ? ` (due: ${t.due_date})` : '') +
        (t.description ? `\n   ${t.description}` : '')
      );
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.tool(
    'update_task',
    'Update fields on an existing task by ID',
    {
      id:          z.number().describe('Task ID'),
      title:       z.string().optional(),
      description: z.string().optional(),
      priority:    z.enum(['low', 'medium', 'high']).optional(),
      due_date:    z.string().optional(),
      status:      z.enum(['todo', 'in_progress', 'done']).optional(),
    },
    async ({ id, ...updates }) => {
      const fields = Object.entries(updates).filter(([, v]) => v !== undefined);
      if (fields.length === 0) return { content: [{ type: 'text', text: 'No fields to update.' }] };

      const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
      const values    = fields.map(([, v]) => v);
      const { changes } = db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...values, id);

      if (changes === 0) return { content: [{ type: 'text', text: `Task #${id} not found.` }] };
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      return { content: [{ type: 'text', text: `Task #${id} updated: ${task.title}` }] };
    }
  );

  server.tool(
    'delete_task',
    'Delete a task by ID. Always confirm with the user before calling this.',
    {
      id: z.number().describe('Task ID to delete'),
    },
    async ({ id }) => {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) return { content: [{ type: 'text', text: `Task #${id} not found.` }] };

      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      return { content: [{ type: 'text', text: `Deleted task #${id}: ${task.title}` }] };
    }
  );

  server.tool(
    'get_task_summary',
    'Return a summary: total tasks, counts by status, top 3 open tasks by priority',
    {},
    async () => {
      const total = db.prepare('SELECT COUNT(*) as n FROM tasks').get().n;
      if (total === 0) return { content: [{ type: 'text', text: 'No tasks yet.' }] };

      const byStatus = db.prepare(`
        SELECT status, COUNT(*) as n FROM tasks GROUP BY status
      `).all().reduce((a, r) => ({ ...a, [r.status]: r.n }), { todo: 0, in_progress: 0, done: 0 });

      const byPriority = db.prepare(`
        SELECT priority, COUNT(*) as n FROM tasks GROUP BY priority
      `).all().reduce((a, r) => ({ ...a, [r.priority]: r.n }), { high: 0, medium: 0, low: 0 });

      const top3 = db.prepare(`
        SELECT * FROM tasks
        WHERE status != 'done'
        ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id
        LIMIT 3
      `).all().map(t => `  • #${t.id} [${t.priority}] ${t.title}`).join('\n');

      const text = [
        `Total tasks: ${total}`,
        `  todo: ${byStatus.todo}  in_progress: ${byStatus.in_progress}  done: ${byStatus.done}`,
        `Priority — high: ${byPriority.high}  medium: ${byPriority.medium}  low: ${byPriority.low}`,
        `Top 3 open tasks:`,
        top3 || '  (none)',
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    }
  );

  // ── NOTES ──────────────────────────────────────────────────

  server.tool(
    'create_note',
    'Create a new note with optional tags',
    {
      title:   z.string().describe('Note title'),
      content: z.string().describe('Note body'),
      tags:    z.array(z.string()).default([]).describe('Optional tags'),
    },
    async ({ title, content, tags }) => {
      const { lastInsertRowid } = db.prepare(`
        INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)
      `).run(title, content, JSON.stringify(tags));
      return { content: [{ type: 'text', text: `Note created: [#${lastInsertRowid}] ${title}` }] };
    }
  );

  server.tool(
    'search_notes',
    'Search notes by keyword across title, content, and tags',
    {
      query: z.string().describe('Search keyword'),
    },
    async ({ query }) => {
      const like = `%${query}%`;
      const matches = db.prepare(`
        SELECT * FROM notes
        WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
        ORDER BY id DESC
      `).all(like, like, like);

      if (matches.length === 0) {
        return { content: [{ type: 'text', text: `No notes found matching "${query}".` }] };
      }

      const lines = matches.map(n => {
        const tags = JSON.parse(n.tags ?? '[]');
        const preview = n.content.slice(0, 120) + (n.content.length > 120 ? '…' : '');
        return `#${n.id} "${n.title}"${tags.length ? ' [' + tags.join(', ') + ']' : ''}\n  ${preview}`;
      });
      return { content: [{ type: 'text', text: lines.join('\n\n') }] };
    }
  );

  server.tool(
    'list_notes',
    'List all notes',
    {},
    async () => {
      const notes = db.prepare('SELECT * FROM notes ORDER BY id DESC').all();
      if (notes.length === 0) return { content: [{ type: 'text', text: 'No notes yet.' }] };

      const lines = notes.map(n => {
        const tags = JSON.parse(n.tags ?? '[]');
        return `#${n.id} "${n.title}" (${n.created_at})${tags.length ? ' [' + tags.join(', ') + ']' : ''}`;
      });
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}