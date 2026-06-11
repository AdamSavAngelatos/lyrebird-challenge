import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'clinic.db');

export type Db = ReturnType<typeof createDb>;

export function createDb(dbPath = DEFAULT_DB_PATH): Database.Database {
  const db = new Database(dbPath, {
    verbose: process.env.LOG_SQL ? (sql) => console.log('[sql]', sql) : undefined,
  });

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clinicians (
      id         TEXT     PRIMARY KEY,
      name       TEXT     NOT NULL,
      created_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id         TEXT     PRIMARY KEY,
      name       TEXT     NOT NULL,
      created_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id           TEXT     PRIMARY KEY,
      clinician_id TEXT     NOT NULL REFERENCES clinicians(id),
      patient_id   TEXT     NOT NULL REFERENCES patients(id),
      start        DATETIME NOT NULL,
      end          DATETIME NOT NULL,
      created_at   DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_clinician_time
      ON appointments(clinician_id, start, end);

    CREATE INDEX IF NOT EXISTS idx_appointments_start
      ON appointments(start);
  `);

  return db;
}
