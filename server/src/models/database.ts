import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          level INTEGER DEFAULT 1,
          experience INTEGER DEFAULT 0,
          streak_days INTEGER DEFAULT 0,
          last_login DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Todos table
      db.run(`
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT 0,
          priority TEXT DEFAULT 'medium',
          difficulty TEXT DEFAULT 'medium',
          experience_points INTEGER DEFAULT 10,
          due_date DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          category TEXT DEFAULT 'general',
          tags TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Achievements table
      db.run(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          required_value INTEGER,
          type TEXT NOT NULL
        )
      `);

      // User achievements table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_id INTEGER NOT NULL,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (achievement_id) REFERENCES achievements (id)
        )
      `);

      // Insert default achievements
      db.run(`
        INSERT OR IGNORE INTO achievements (name, description, icon, required_value, type) VALUES
        ('First Step', 'Complete your first task', '🎯', 1, 'tasks_completed'),
        ('Task Master', 'Complete 10 tasks', '💪', 10, 'tasks_completed'),
        ('Unstoppable', 'Complete 50 tasks', '🚀', 50, 'tasks_completed'),
        ('Week Warrior', '7 day streak', '🔥', 7, 'streak'),
        ('Month Master', '30 day streak', '⚡', 30, 'streak'),
        ('Level 5', 'Reach level 5', '⭐', 5, 'level'),
        ('Level 10', 'Reach level 10', '🌟', 10, 'level')
      `);

      // Add category and tags columns to existing todos table (migration)
      db.run(`ALTER TABLE todos ADD COLUMN category TEXT DEFAULT 'general'`, () => {});
      db.run(`ALTER TABLE todos ADD COLUMN tags TEXT`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

export default db;
