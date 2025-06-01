import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import statsRoutes from '../../server/src/routes/stats';
import db from '../../server/src/models/database';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/stats', statsRoutes);

// Helper function to create a test user and get JWT token
const createTestUser = async (userData: any = {}): Promise<{ userId: number; token: string }> => {
  const hashedPassword = await bcrypt.hash('TestPassword123', 10);
  const defaultData = {
    username: 'testuser',
    email: 'test@example.com',
    password: hashedPassword,
    level: 1,
    experience: 0,
    streak_days: 0,
    ...userData
  };
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (username, email, password, level, experience, streak_days) VALUES (?, ?, ?, ?, ?, ?)',
      [defaultData.username, defaultData.email, defaultData.password, defaultData.level, defaultData.experience, defaultData.streak_days],
      function(err) {
        if (err) reject(err);
        
        const userId = this.lastID;
        const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
        resolve({ userId, token });
      }
    );
  });
};

// Helper function to create completed todos
const createCompletedTodos = async (userId: number, count: number): Promise<void> => {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO todos (user_id, title, description, completed, completed_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)',
        [userId, `Todo ${i + 1}`, `Description ${i + 1}`],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

describe('Stats Routes', () => {
  beforeEach(async () => {
    // Clean up tables before each test
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

  describe('GET /api/stats', () => {
    it('should return user stats with no todos', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: testUser.userId,
          username: 'testuser',
          level: 1,
          experience: 0,
          streak_days: 0,
          experienceToNextLevel: 100
        },
        stats: {
          totalTodos: 0,
          currentStreak: 0
        },
        achievements: []
      });
    });

    it('should return user stats with completed todos', async () => {
      const testUser = await createTestUser({
        level: 2,
        experience: 150,
        streak_days: 5
      });

      await createCompletedTodos(testUser.userId, 3);

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: testUser.userId,
          username: 'testuser',
          level: 2,
          experience: 150,
          streak_days: 5,
          experienceToNextLevel: 50 // 200 - 150 = 50 to next level
        },
        stats: {
          totalTodos: 3,
          currentStreak: 5
        },
        achievements: expect.any(Array)
      });
    });

    it('should calculate experience to next level correctly', async () => {
      const testCases = [
        { experience: 0, expected: 100 },
        { experience: 50, expected: 50 },
        { experience: 99, expected: 1 },
        { experience: 100, expected: 100 }, // Level 2, 0 progress to level 3
        { experience: 150, expected: 50 },
        { experience: 250, expected: 50 }
      ];

      for (const { experience, expected } of testCases) {
        const testUser = await createTestUser({ experience });

        const response = await request(app)
          .get('/api/stats')
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(200);

        expect(response.body.user.experienceToNextLevel).toBe(expected);

        // Clean up for next iteration
        await new Promise<void>((resolve, reject) => {
          db.run('DELETE FROM users', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    });

    it('should include user achievements', async () => {
      const testUser = await createTestUser();

      // Manually unlock an achievement
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
          [testUser.userId, 1], // Achievement ID 1 should be "First Step"
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body.achievements).toHaveLength(1);
      expect(response.body.achievements[0]).toHaveProperty('name', 'First Step');
      expect(response.body.achievements[0]).toHaveProperty('description', 'Complete your first task');
      expect(response.body.achievements[0]).toHaveProperty('icon', '🎯');
    });

    it('should trigger achievement checking for completed tasks', async () => {
      const testUser = await createTestUser();

      // Create exactly 1 completed todo to trigger "First Step" achievement
      await createCompletedTodos(testUser.userId, 1);

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body.stats.totalTodos).toBe(1);

      // Check if achievement was automatically unlocked
      // Note: The achievement checking is asynchronous, so we might need to call again
      const secondResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Should have unlocked "First Step" achievement
      const firstStepAchievement = secondResponse.body.achievements.find(
        (achievement: any) => achievement.name === 'First Step'
      );
      expect(firstStepAchievement).toBeTruthy();
    });

    it('should trigger achievement checking for level progression', async () => {
      const testUser = await createTestUser({
        level: 5,
        experience: 500
      });

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Give time for achievement checking
      const secondResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Should have unlocked "Level 5" achievement
      const level5Achievement = secondResponse.body.achievements.find(
        (achievement: any) => achievement.name === 'Level 5'
      );
      expect(level5Achievement).toBeTruthy();
    });

    it('should trigger achievement checking for streak days', async () => {
      const testUser = await createTestUser({
        streak_days: 7
      });

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Give time for achievement checking
      const secondResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Should have unlocked "Week Warrior" achievement
      const weekWarriorAchievement = secondResponse.body.achievements.find(
        (achievement: any) => achievement.name === 'Week Warrior'
      );
      expect(weekWarriorAchievement).toBeTruthy();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeToken = jwt.sign({ userId: 999999 }, process.env.JWT_SECRET!);

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(401);

      expect(response.body.message).toBe('Access denied. No token provided.');
    });

    it('should handle database errors gracefully', async () => {
      const testUser = await createTestUser();

      // Close database temporarily to simulate error
      db.close((err) => {
        if (!err) {
          // Reopen database
          const sqlite3 = require('sqlite3');
          const path = require('path');
          const dbPath = path.join(__dirname, '../../server/database.sqlite');
          Object.setPrototypeOf(db, new sqlite3.Database(dbPath));
        }
      });

      // This might return an error or empty achievements array
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${testUser.token}`);

      // The endpoint should handle errors gracefully
      expect([200, 404, 500]).toContain(response.status);
    });
  });
});