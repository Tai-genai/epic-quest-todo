import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { initDatabase } from '../server/src/models/database';
import authRoutes from '../server/src/routes/auth';
import todoRoutes from '../server/src/routes/todos';
import statsRoutes from '../server/src/routes/stats';
import { errorHandler } from '../server/src/middleware/errorHandler';

describe('Stats and Gamification', () => {
  let app: express.Application;
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/todos', todoRoutes);
    app.use('/api/stats', statsRoutes);
    app.use(errorHandler);

    // Initialize in-memory database
    await initDatabase();

    // Register and login a test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'statsuser',
        email: 'stats@example.com',
        password: 'StatsPassword123!'
      });

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  describe('GET /api/stats', () => {
    it('should return initial stats for new user', async () => {
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: {
          id: userId,
          username: 'statsuser',
          level: 1,
          experience: 0,
          streak_days: 0
        },
        stats: {
          total_todos: 0,
          completed_todos: 0,
          completion_rate: 0,
          total_experience: 0
        },
        achievements: expect.any(Array)
      });
    });

    it('should update stats after creating todos', async () => {
      // Create some todos
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'First Todo',
          description: 'Testing stats',
          priority: 'medium',
          difficulty: 'easy'
        });

      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Second Todo',
          description: 'Testing more stats',
          priority: 'high',
          difficulty: 'hard'
        });

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats.total_todos).toBe(2);
      expect(response.body.stats.completed_todos).toBe(0);
      expect(response.body.stats.completion_rate).toBe(0);
    });

    it('should update stats after completing todos', async () => {
      // Get current todos
      const todosResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      const todoIds = todosResponse.body.map((todo: any) => todo.id);

      // Complete first todo (easy = 5 XP)
      await request(app)
        .patch(`/api/todos/${todoIds[0]}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      const statsAfterFirst = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsAfterFirst.body.stats.completed_todos).toBe(1);
      expect(statsAfterFirst.body.stats.completion_rate).toBe(50);
      expect(statsAfterFirst.body.user.experience).toBe(5);

      // Complete second todo (hard = 20 XP)
      await request(app)
        .patch(`/api/todos/${todoIds[1]}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      const statsAfterSecond = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsAfterSecond.body.stats.completed_todos).toBe(2);
      expect(statsAfterSecond.body.stats.completion_rate).toBe(100);
      expect(statsAfterSecond.body.user.experience).toBe(25);
    });

    it('should reject stats request without authentication', async () => {
      const response = await request(app)
        .get('/api/stats');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('Experience and Level System', () => {
    let newAuthToken: string;

    beforeAll(async () => {
      // Create a new user for level testing
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'leveluser',
          email: 'level@example.com',
          password: 'LevelPassword123!'
        });

      newAuthToken = registerResponse.body.token;
    });

    it('should calculate levels correctly based on experience', async () => {
      // Create and complete enough todos to level up
      const todosToCreate = [
        { difficulty: 'epic', xp: 50 },   // Total: 50
        { difficulty: 'hard', xp: 20 },  // Total: 70
        { difficulty: 'hard', xp: 20 },  // Total: 90
        { difficulty: 'medium', xp: 10 }, // Total: 100 (level 2)
        { difficulty: 'easy', xp: 5 },   // Total: 105
      ];

      let currentLevel = 1;

      for (let i = 0; i < todosToCreate.length; i++) {
        const todo = todosToCreate[i];
        
        // Create todo
        const createResponse = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${newAuthToken}`)
          .send({
            title: `Level Test Todo ${i + 1}`,
            description: 'Testing level progression',
            priority: 'medium',
            difficulty: todo.difficulty
          });

        // Complete todo
        const completeResponse = await request(app)
          .patch(`/api/todos/${createResponse.body.id}/complete`)
          .set('Authorization', `Bearer ${newAuthToken}`);

        const expectedTotalXP = todosToCreate.slice(0, i + 1).reduce((sum, t) => sum + t.xp, 0);
        const expectedLevel = Math.floor(expectedTotalXP / 100) + 1;

        expect(completeResponse.body.experienceGained).toBe(todo.xp);
        expect(completeResponse.body.newExperience).toBe(expectedTotalXP);

        if (expectedLevel > currentLevel) {
          expect(completeResponse.body.levelUp).toBe(true);
          currentLevel = expectedLevel;
        }

        // Verify stats
        const statsResponse = await request(app)
          .get('/api/stats')
          .set('Authorization', `Bearer ${newAuthToken}`);

        expect(statsResponse.body.user.experience).toBe(expectedTotalXP);
        expect(statsResponse.body.user.level).toBe(expectedLevel);
      }
    });
  });

  describe('Achievements System', () => {
    let achievementAuthToken: string;

    beforeAll(async () => {
      // Create a new user for achievement testing
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'achievementuser',
          email: 'achievement@example.com',
          password: 'AchievementPassword123!'
        });

      achievementAuthToken = registerResponse.body.token;
    });

    it('should track "First Steps" achievement', async () => {
      // Create and complete first todo
      const createResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${achievementAuthToken}`)
        .send({
          title: 'First Achievement Todo',
          description: 'Testing first steps achievement',
          priority: 'medium',
          difficulty: 'easy'
        });

      await request(app)
        .patch(`/api/todos/${createResponse.body.id}/complete`)
        .set('Authorization', `Bearer ${achievementAuthToken}`);

      const statsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${achievementAuthToken}`);

      const firstStepsAchievement = statsResponse.body.achievements.find(
        (a: any) => a.title === 'First Steps'
      );

      expect(firstStepsAchievement).toBeDefined();
      expect(firstStepsAchievement.unlocked).toBe(1);
    });

    it('should track "Getting Started" achievement for 5 completed todos', async () => {
      // Create and complete 4 more todos (already have 1)
      for (let i = 0; i < 4; i++) {
        const createResponse = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${achievementAuthToken}`)
          .send({
            title: `Achievement Todo ${i + 2}`,
            description: 'Testing getting started achievement',
            priority: 'medium',
            difficulty: 'easy'
          });

        await request(app)
          .patch(`/api/todos/${createResponse.body.id}/complete`)
          .set('Authorization', `Bearer ${achievementAuthToken}`);
      }

      const statsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${achievementAuthToken}`);

      const gettingStartedAchievement = statsResponse.body.achievements.find(
        (a: any) => a.title === 'Getting Started'
      );

      expect(gettingStartedAchievement).toBeDefined();
      expect(gettingStartedAchievement.unlocked).toBe(1);
      expect(statsResponse.body.stats.completed_todos).toBe(5);
    });

    it('should track "Level Up" achievement for reaching level 2', async () => {
      // Create enough todos to reach level 2 (need 100+ XP total)
      // Currently at 5 * 5 = 25 XP, need 75 more
      const todosForLevel = [
        { difficulty: 'epic', xp: 50 },   // 75 total
        { difficulty: 'hard', xp: 20 },  // 95 total  
        { difficulty: 'medium', xp: 10 } // 105 total (level 2)
      ];

      for (const todo of todosForLevel) {
        const createResponse = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${achievementAuthToken}`)
          .send({
            title: 'Level Up Todo',
            description: 'Testing level up achievement',
            priority: 'medium',
            difficulty: todo.difficulty
          });

        await request(app)
          .patch(`/api/todos/${createResponse.body.id}/complete`)
          .set('Authorization', `Bearer ${achievementAuthToken}`);
      }

      const statsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${achievementAuthToken}`);

      const levelUpAchievement = statsResponse.body.achievements.find(
        (a: any) => a.title === 'Level Up'
      );

      expect(levelUpAchievement).toBeDefined();
      expect(levelUpAchievement.unlocked).toBe(1);
      expect(statsResponse.body.user.level).toBeGreaterThanOrEqual(2);
    });
  });
});