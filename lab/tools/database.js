import { z } from 'zod';
import { getDb } from '../data/db.js';

export function registerDatabaseTools(server) {
  const db = getDb();

  // Tool to list all tasks
  server.tool(
    'list_tasks',
    'List all tasks from the database',
    {},
    async () => {
      const tasks = db.prepare('SELECT * FROM tasks').all();
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  // Tool to create a task - notice the priority matches your schema
  server.tool(
    'create_task',
    'Create a new project task',
    {
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional()
    },
    async ({ title, description = '', priority = 'medium' }) => {
      const info = db.prepare(
        'INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)'
      ).run(title, description, priority);
      return { content: [{ type: 'text', text: `Task created with ID: ${info.lastInsertRowid}` }] };
    }
  );

  // Tool to update status - handles strings from Claude via z.coerce [cite: 150, 229]
  server.tool(
    'update_task_status',
    'Update a task status',
    {
      id: z.coerce.number(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled'])
    },
    async ({ id, status }) => {
      db.prepare('UPDATE tasks SET status = ?, updated_at = date("now") WHERE id = ?').run(status, id);
      return { content: [{ type: 'text', text: `Task ${id} updated to ${status}` }] };
    }
  );
}