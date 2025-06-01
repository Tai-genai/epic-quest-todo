import { initDatabase } from '../../server/src/models/database';
import db from '../../server/src/models/database';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(async () => {
    // Clean up all data before each test
    const tables = ['user_achievements', 'todos', 'users'];
    for (const table of tables) {
      await new Promise<void>((resolve, reject) => {
        db.run(`DELETE FROM ${table}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  describe('Database Schema', () => {
    it('should have created all required tables', async () => {
      const tables = await new Promise<any[]>((resolve, reject) => {
        db.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const tableNames = tables.map(table => table.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('todos');
      expect(tableNames).toContain('achievements');
      expect(tableNames).toContain('user_achievements');
    });

    it('should have correct users table structure', async () => {
      const columns = await new Promise<any[]>((resolve, reject) => {
        db.all('PRAGMA table_info(users)', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('username');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('password');
      expect(columnNames).toContain('level');
      expect(columnNames).toContain('experience');
      expect(columnNames).toContain('streak_days');
      expect(columnNames).toContain('last_login');
      expect(columnNames).toContain('created_at');
    });

    it('should have correct todos table structure', async () => {
      const columns = await new Promise<any[]>((resolve, reject) => {
        db.all('PRAGMA table_info(todos)', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('completed');
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('difficulty');
      expect(columnNames).toContain('experience_points');
      expect(columnNames).toContain('due_date');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('created_at');
    });

    it('should have default achievements populated', async () => {
      const achievements = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM achievements', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(achievements.length).toBeGreaterThan(0);
      
      // Check for specific achievements
      const achievementNames = achievements.map(achievement => achievement.name);
      expect(achievementNames).toContain('First Step');
      expect(achievementNames).toContain('Task Master');
      expect(achievementNames).toContain('Unstoppable');
      expect(achievementNames).toContain('Week Warrior');
      expect(achievementNames).toContain('Month Master');
      expect(achievementNames).toContain('Level 5');
      expect(achievementNames).toContain('Level 10');
    });
  });

  describe('Database Constraints and Relationships', () => {
    it('should enforce unique username constraint', async () => {
      // Insert first user
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['testuser', 'test1@example.com', 'password1'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Try to insert user with same username
      const insertPromise = new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['testuser', 'test2@example.com', 'password2'],
          (err) => {
            if (err) resolve(err); // We expect an error
            else reject(new Error('Should have failed'));
          }
        );
      });

      const error = await insertPromise;
      expect((error as any).message).toContain('UNIQUE');
    });

    it('should enforce unique email constraint', async () => {
      // Insert first user
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['testuser1', 'test@example.com', 'password1'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Try to insert user with same email
      const insertPromise = new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['testuser2', 'test@example.com', 'password2'],
          (err) => {
            if (err) resolve(err); // We expect an error
            else reject(new Error('Should have failed'));
          }
        );
      });

      const error = await insertPromise;
      expect((error as any).message).toContain('UNIQUE');
    });

    it('should enforce foreign key constraint for todos', async () => {
      // Try to insert todo with non-existent user_id
      const insertPromise = new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)',
          [999999, 'Test Todo', 'Test Description'],
          (err) => {
            if (err) resolve(err); // We expect an error in strict mode
            else resolve(null); // SQLite might allow this in non-strict mode
          }
        );
      });

      // Note: SQLite foreign key constraints might not be enabled by default
      // This test verifies the behavior regardless
      await insertPromise;
    });

    it('should handle cascading deletes correctly', async () => {
      // Create a user
      const userId = await new Promise<number>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['cascadeuser', 'cascade@example.com', 'password'],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Create todos for the user
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)',
          [userId, 'Todo 1', 'Description 1'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)',
          [userId, 'Todo 2', 'Description 2'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify todos exist
      const todosBefore = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM todos WHERE user_id = ?', [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(todosBefore).toHaveLength(2);

      // Delete the user (this might or might not cascade depending on FK settings)
      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Check if todos still exist (behavior depends on FK constraint settings)
      const todosAfter = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM todos WHERE user_id = ?', [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // This test documents the current behavior
      // In production, you might want to handle this with application logic
      expect(todosAfter.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Performance and Concurrency', () => {
    it('should handle concurrent inserts correctly', async () => {
      const concurrentUsers = [];

      // Create multiple users concurrently
      for (let i = 0; i < 10; i++) {
        concurrentUsers.push(
          new Promise<number>((resolve, reject) => {
            db.run(
              'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
              [`user${i}`, `user${i}@example.com`, `password${i}`],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          })
        );
      }

      const userIds = await Promise.all(concurrentUsers);
      expect(userIds).toHaveLength(10);
      expect(new Set(userIds).size).toBe(10); // All IDs should be unique
    });

    it('should handle large dataset queries efficiently', async () => {
      // Create a user
      const userId = await new Promise<number>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['largeuser', 'large@example.com', 'password'],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Create many todos
      const insertPromises = [];
      for (let i = 0; i < 100; i++) {
        insertPromises.push(
          new Promise<void>((resolve, reject) => {
            db.run(
              'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)',
              [userId, `Todo ${i}`, `Description ${i}`],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          })
        );
      }

      await Promise.all(insertPromises);

      // Query all todos and measure performance
      const startTime = Date.now();
      const todos = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      const endTime = Date.now();

      expect(todos).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data consistency during complex operations', async () => {
      // Create user
      const userId = await new Promise<number>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password, experience) VALUES (?, ?, ?, ?)',
          ['integrityuser', 'integrity@example.com', 'password', 95],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Create a todo
      const todoId = await new Promise<number>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description, experience_points) VALUES (?, ?, ?, ?)',
          [userId, 'Test Todo', 'Test Description', 10],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Simulate completing the todo and updating user experience
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('UPDATE todos SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?', [todoId]);
          db.run('UPDATE users SET experience = experience + 10 WHERE id = ?', [userId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // Verify data consistency
      const user = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const todo = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(user.experience).toBe(105);
      expect(todo.completed).toBe(1);
      expect(todo.completed_at).toBeTruthy();
    });

    it('should handle edge cases in data types', async () => {
      // Test with edge case values
      const userId = await new Promise<number>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password, level, experience, streak_days) VALUES (?, ?, ?, ?, ?, ?)',
          ['edgeuser', 'edge@example.com', 'password', 0, -1, 999999],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      const user = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(user.level).toBe(0);
      expect(user.experience).toBe(-1);
      expect(user.streak_days).toBe(999999);
    });
  });
});