import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { initDatabase } from '../server/src/models/database';
import authRoutes from '../server/src/routes/auth';
import todoRoutes from '../server/src/routes/todos';
import { errorHandler } from '../server/src/middleware/errorHandler';

describe('Todo Management', () => {
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
    app.use(errorHandler);

    // Initialize in-memory database
    await initDatabase();

    // Register and login a test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'todouser',
        email: 'todouser@example.com',
        password: 'TodoPassword123!'
      });

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  describe('GET /api/todos', () => {
    it('should return empty array for new user', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/todos');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });

  describe('POST /api/todos', () => {
    it('should create a todo successfully', async () => {
      const todoData = {
        title: 'Test Todo',
        description: 'This is a test todo',
        priority: 'medium',
        difficulty: 'medium',
        due_date: '2024-12-31'
      };

      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(todoData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        title: todoData.title,
        description: todoData.description,
        priority: todoData.priority,
        difficulty: todoData.difficulty,
        experience_points: 10,
        completed: false
      });
    });

    it('should assign correct experience points based on difficulty', async () => {
      const difficulties = [
        { difficulty: 'easy', expectedPoints: 5 },
        { difficulty: 'medium', expectedPoints: 10 },
        { difficulty: 'hard', expectedPoints: 20 },
        { difficulty: 'epic', expectedPoints: 50 }
      ];

      for (const { difficulty, expectedPoints } of difficulties) {
        const response = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `${difficulty} task`,
            description: `A ${difficulty} difficulty task`,
            priority: 'medium',
            difficulty: difficulty
          });

        expect(response.status).toBe(201);
        expect(response.body.experience_points).toBe(expectedPoints);
      }
    });

    it('should reject todos without authentication', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({
          title: 'Unauthorized Todo',
          description: 'This should fail'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/todos/:id/complete', () => {
    let todoId: number;

    beforeEach(async () => {
      // Create a todo to complete
      const todoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Todo to Complete',
          description: 'This todo will be completed',
          priority: 'high',
          difficulty: 'hard'
        });

      todoId = todoResponse.body.id;
    });

    it('should complete a todo successfully and award experience', async () => {
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Todo completed!',
        experienceGained: 20,
        newExperience: expect.any(Number)
      });
    });

    it('should not complete already completed todo', async () => {
      // Complete the todo first
      await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to complete again
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Todo already completed');
    });

    it('should not complete non-existent todo', async () => {
      const response = await request(app)
        .patch('/api/todos/99999/complete')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Todo not found');
    });

    it('should not complete todo belonging to another user', async () => {
      // Register another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'otheruser',
          email: 'other@example.com',
          password: 'OtherPassword123!'
        });

      // Try to complete first user's todo with second user's token
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${otherUserResponse.body.token}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Todo not found');
    });
  });

  describe('DELETE /api/todos/:id', () => {
    let todoId: number;

    beforeEach(async () => {
      // Create a todo to delete
      const todoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Todo to Delete',
          description: 'This todo will be deleted',
          priority: 'low',
          difficulty: 'easy'
        });

      todoId = todoResponse.body.id;
    });

    it('should delete a todo successfully', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Todo deleted successfully');
    });

    it('should not delete non-existent todo', async () => {
      const response = await request(app)
        .delete('/api/todos/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Todo not found');
    });

    it('should not delete todo without authentication', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`);

      expect(response.status).toBe(401);
    });
  });
});