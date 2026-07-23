// lab/data/db.js
/*import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';

// Codespaces homedir() resolves to /root [cite: 124]
const DATA_DIR = join(homedir(), 'lab', 'data');
const DB_PATH  = join(DATA_DIR, 'lab.db');
let _db = null;

export function getDb(){
    if(!_db){
        // Ensure the directory exists before creating the DB [cite: 98]
        if(!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, {recursive:true});
        
        _db = new Database(DB_PATH);
        _db.pragma('journal_mode = WAL'); // [cite: 100]
        _db.pragma('foreign_keys = ON'); // [cite: 101]

        // Auto-Bootstrap the schema [cite: 102]
        _db.exec(`
            CREATE TABLE IF NOT EXISTS tasks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT DEFAULT 'todo' CHECK(status IN('todo','in_progress','done','cancelled')),
                priority TEXT DEFAULT 'medium' CHECK(priority IN('low','medium','high')),
                due_date TEXT,
                created_at TEXT DEFAULT(date('now')),
                updated_at TEXT DEFAULT(date('now'))
            );
            CREATE TABLE IF NOT EXISTS notes(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT(date('now'))
            );
        `);
    }
    return _db;
}*/

// lab/data/db.js
import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';

const DATA_DIR = join(homedir(), 'lab', 'data');
const DB_PATH  = join(DATA_DIR, 'lab.db');
let _db = null;

export function getDb(){
  if(!_db){
    if(!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, {recursive:true});
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    
    // This schema includes all columns required by your database tools [cite: 581-592]
    _db.exec(`
      CREATE TABLE IF NOT EXISTS tasks(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, 
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'todo' CHECK(status IN('todo','in_progress','done','cancelled')),
        priority TEXT DEFAULT 'medium' CHECK(priority IN('low','medium','high')),
        due_date TEXT, 
        created_at TEXT DEFAULT(date('now')), 
        updated_at TEXT DEFAULT(date('now'))
      );
      CREATE TABLE IF NOT EXISTS notes(
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '', 
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT(date('now'))
      );
    `);
  }
  return _db;
}