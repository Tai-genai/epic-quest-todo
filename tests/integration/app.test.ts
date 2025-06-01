import request from 'supertest';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from '../../server/src/models/database';
import authRoutes from '../../server/src/routes/auth';
import todoRoutes from '../../server/src/routes/todos';
import statsRoutes from '../../server/src/routes/stats';
import { errorHandler } from '../../server/src/middleware/errorHandler';
import db from '../../server/src/models/database';

// Create test app similar to production
const createTestApp = () => {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../client/public')));
  
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/todos', todoRoutes);
  app.use('/api/stats', statsRoutes);
  
  // Serve React app
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../../client/public/index.html'));
    } else {
      res.status(404).json({ message: 'API endpoint not found' });
    }
  });
  
  // Error handling middleware
  app.use(errorHandler);
  
  return app;
};

describe('Full Application Integration Tests', () => {
  let app: express.Application;
  let userToken: string;
  let userId: number;

  beforeAll(async () => {
    app = createTestApp();
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

  describe('Complete User Journey', () => {
    it('should handle complete user registration and todo management flow', async () => {
      // 1. Register a new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'journeyuser',
          email: 'journey@example.com',
          password: 'JourneyPassword123'
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('token');
      expect(registerResponse.body.user.username).toBe('journeyuser');
      userToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      // 2. Check initial stats (should be empty)
      const initialStatsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(initialStatsResponse.body.user.level).toBe(1);
      expect(initialStatsResponse.body.user.experience).toBe(0);
      expect(initialStatsResponse.body.stats.totalTodos).toBe(0);
      expect(initialStatsResponse.body.achievements).toHaveLength(0);

      // 3. Create first todo
      const firstTodoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'My First Todo',
          description: 'This is my first todo item',
          priority: 'high',
          difficulty: 'easy'
        })
        .expect(201);

      expect(firstTodoResponse.body.title).toBe('My First Todo');
      expect(firstTodoResponse.body.experience_points).toBe(5); // easy = 5 XP
      const firstTodoId = firstTodoResponse.body.id;

      // 4. Create a harder todo
      const hardTodoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Challenging Task',
          description: 'This is a difficult task',
          priority: 'high',
          difficulty: 'epic'
        })
        .expect(201);

      expect(hardTodoResponse.body.experience_points).toBe(50); // epic = 50 XP
      const hardTodoId = hardTodoResponse.body.id;

      // 5. Get all todos
      const todosResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(todosResponse.body).toHaveLength(2);
      expect(todosResponse.body[0].title).toBe('Challenging Task'); // Most recent first

      // 6. Complete the first (easy) todo
      const completeEasyResponse = await request(app)
        .patch(`/api/todos/${firstTodoId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(completeEasyResponse.body.experienceGained).toBe(5);
      expect(completeEasyResponse.body.levelUp).toBe(false); // Not enough XP yet

      // 7. Complete the hard todo
      const completeHardResponse = await request(app)
        .patch(`/api/todos/${hardTodoId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(completeHardResponse.body.experienceGained).toBe(50);
      expect(completeHardResponse.body.levelUp).toBe(false); // 55 XP total, not enough for level up

      // 8. Check updated stats
      const updatedStatsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedStatsResponse.body.user.experience).toBe(55);
      expect(updatedStatsResponse.body.user.level).toBe(1);
      expect(updatedStatsResponse.body.user.experienceToNextLevel).toBe(45); // 100 - 55
      expect(updatedStatsResponse.body.stats.totalTodos).toBe(2);

      // 9. Check achievements (may need a second call for async processing)
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for achievement processing
      
      const achievementsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should have unlocked "First Step" and "Task Master" achievements
      const achievementNames = achievementsResponse.body.achievements.map((a: any) => a.name);
      expect(achievementNames).toContain('First Step');

      // 10. Create and complete more todos to trigger level up
      for (let i = 0; i < 3; i++) {
        const todoResponse = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: `Extra Todo ${i + 1}`,
            description: 'Extra todo for leveling',
            priority: 'medium',
            difficulty: 'medium'
          })
          .expect(201);

        await request(app)
          .patch(`/api/todos/${todoResponse.body.id}/complete`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);
      }

      // 11. Check for level up (85 XP total, should level up)
      const levelUpResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Level Up Todo',
          description: 'This should trigger level up',
          priority: 'medium',
          difficulty: 'medium'
        })
        .expect(201);

      const levelUpCompleteResponse = await request(app)
        .patch(`/api/todos/${levelUpResponse.body.id}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(levelUpCompleteResponse.body.levelUp).toBe(false); // 95 XP, still level 1

      // One more to trigger level up
      const finalTodoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Final Level Up Todo',
          description: 'This should definitely trigger level up',
          priority: 'medium',
          difficulty: 'medium'
        })
        .expect(201);

      const finalCompleteResponse = await request(app)
        .patch(`/api/todos/${finalTodoResponse.body.id}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(finalCompleteResponse.body.levelUp).toBe(true); // 105 XP, level up!

      // 12. Verify final stats
      const finalStatsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(finalStatsResponse.body.user.level).toBe(2);
      expect(finalStatsResponse.body.user.experience).toBe(105);
      expect(finalStatsResponse.body.stats.totalTodos).toBe(6);

      // 13. Test logout and login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'journeyuser',
          password: 'JourneyPassword123'
        })
        .expect(200);

      expect(loginResponse.body.user.level).toBe(2);
      expect(loginResponse.body.user.experience).toBe(105);

      // 14. Test todo deletion
      const deleteResponse = await request(app)
        .delete(`/api/todos/${finalTodoResponse.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(deleteResponse.body.message).toBe('Todo deleted successfully');

      // 15. Verify todo was deleted
      const finalTodosResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should have 5 todos left (6 created, 1 deleted)
      expect(finalTodosResponse.body).toHaveLength(5);
    });

    it('should handle error cases in the complete flow', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'erroruser',
          email: 'error@example.com',
          password: 'ErrorPassword123'
        })
        .expect(201);

      userToken = registerResponse.body.token;

      // Try to complete non-existent todo
      await request(app)
        .patch('/api/todos/999999/complete')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      // Try to delete non-existent todo
      await request(app)
        .delete('/api/todos/999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      // Try to access protected routes without token
      await request(app)
        .get('/api/todos')
        .expect(401);

      await request(app)
        .post('/api/todos')
        .send({ title: 'Test' })
        .expect(401);

      await request(app)
        .get('/api/stats')
        .expect(401);

      // Try to register with duplicate username
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'erroruser',
          email: 'different@example.com',
          password: 'Password123'
        })
        .expect(400);

      // Try to login with wrong credentials
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'erroruser',
          password: 'WrongPassword'
        })
        .expect(401);
    });
  });

  describe('Static File Serving', () => {
    it('should serve static files correctly', async () => {
      // Test that non-API routes serve the HTML file
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    it('should serve the app for any non-API route', async () => {
      const routes = ['/dashboard', '/login', '/profile', '/some/deep/route'];
      
      for (const route of routes) {
        const response = await request(app)
          .get(route)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/text\/html/);
      }
    });

    it('should return 404 for non-existent API routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.message).toBe('API endpoint not found');
    });
  });

  describe('Cross-Origin Resource Sharing (CORS)', () => {
    it('should handle CORS correctly', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
});