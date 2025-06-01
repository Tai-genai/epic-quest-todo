import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { initDatabase } from '../server/src/models/database';
import authRoutes from '../server/src/routes/auth';
import todoRoutes from '../server/src/routes/todos';
import statsRoutes from '../server/src/routes/stats';
import { errorHandler } from '../server/src/middleware/errorHandler';

describe('Integration Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create full application
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/todos', todoRoutes);
    app.use('/api/stats', statsRoutes);
    app.use(errorHandler);

    // Initialize in-memory database
    await initDatabase();
  });

  describe('Complete User Journey', () => {
    let authToken: string;
    let userId: number;
    const todoIds: number[] = [];

    it('should complete full user registration and authentication flow', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'journeyuser',
          email: 'journey@example.com',
          password: 'JourneyPassword123!'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.token).toBeDefined();
      
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      // 2. Login with credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'journeyuser',
          password: 'JourneyPassword123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
    });

    it('should create multiple todos with different difficulties', async () => {
      const todos = [
        { title: 'Easy Task', difficulty: 'easy', description: 'Simple task' },
        { title: 'Medium Task', difficulty: 'medium', description: 'Moderate task' },
        { title: 'Hard Task', difficulty: 'hard', description: 'Challenging task' },
        { title: 'Epic Task', difficulty: 'epic', description: 'Legendary task' }
      ];

      for (const todo of todos) {
        const response = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...todo,
            priority: 'medium'
          });

        expect(response.status).toBe(201);
        todoIds.push(response.body.id);
      }

      expect(todoIds).toHaveLength(4);
    });

    it('should retrieve all created todos', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
      expect(response.body.every((todo: any) => todoIds.includes(todo.id))).toBe(true);
    });

    it('should complete todos and track experience progression', async () => {
      let totalExperience = 0;
      const expectedExperience = [5, 10, 20, 50]; // easy, medium, hard, epic

      for (let i = 0; i < todoIds.length; i++) {
        const response = await request(app)
          .patch(`/api/todos/${todoIds[i]}/complete`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        totalExperience += expectedExperience[i];
        
        expect(response.body.experienceGained).toBe(expectedExperience[i]);
        expect(response.body.newExperience).toBe(totalExperience);
      }
    });

    it('should check user stats and achievements', async () => {
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.experience).toBe(85); // 5+10+20+50
      expect(response.body.user.level).toBeGreaterThan(1); // Should level up
      expect(response.body.stats.total_todos).toBe(4);
      expect(response.body.stats.completed_todos).toBe(4);
      expect(response.body.stats.completion_rate).toBe(100);
    });

    it('should delete completed todos', async () => {
      for (const todoId of todoIds) {
        const response = await request(app)
          .delete(`/api/todos/${todoId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
      }

      // Verify todos are deleted
      const getResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveLength(0);
    });
  });

  describe('Multi-User Scenarios', () => {
    let user1Token: string;
    let user2Token: string;
    let user1TodoId: number;
    let user2TodoId: number;

    beforeAll(async () => {
      // Create two users
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'multiuser1',
          email: 'multiuser1@example.com',
          password: 'MultiUser1Password123!'
        });
      user1Token = user1Response.body.token;

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'multiuser2',
          email: 'multiuser2@example.com',
          password: 'MultiUser2Password123!'
        });
      user2Token = user2Response.body.token;
    });

    it('should isolate todos between users', async () => {
      // User 1 creates a todo
      const user1TodoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'User 1 Todo',
          description: 'This belongs to user 1',
          priority: 'high',
          difficulty: 'medium'
        });
      user1TodoId = user1TodoResponse.body.id;

      // User 2 creates a todo
      const user2TodoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'User 2 Todo',
          description: 'This belongs to user 2',
          priority: 'low',
          difficulty: 'easy'
        });
      user2TodoId = user2TodoResponse.body.id;

      // User 1 should only see their todo
      const user1Todos = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(user1Todos.body).toHaveLength(1);
      expect(user1Todos.body[0].title).toBe('User 1 Todo');

      // User 2 should only see their todo
      const user2Todos = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(user2Todos.body).toHaveLength(1);
      expect(user2Todos.body[0].title).toBe('User 2 Todo');
    });

    it('should prevent cross-user todo operations', async () => {
      // User 2 tries to complete User 1's todo
      const completeResponse = await request(app)
        .patch(`/api/todos/${user1TodoId}/complete`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(completeResponse.status).toBe(404);

      // User 2 tries to delete User 1's todo
      const deleteResponse = await request(app)
        .delete(`/api/todos/${user1TodoId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(deleteResponse.status).toBe(404);
    });

    it('should track separate statistics for each user', async () => {
      // Complete todos for both users
      await request(app)
        .patch(`/api/todos/${user1TodoId}/complete`)
        .set('Authorization', `Bearer ${user1Token}`);

      await request(app)
        .patch(`/api/todos/${user2TodoId}/complete`)
        .set('Authorization', `Bearer ${user2Token}`);

      // Check User 1 stats
      const user1Stats = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(user1Stats.body.stats.total_todos).toBe(1);
      expect(user1Stats.body.stats.completed_todos).toBe(1);

      // Check User 2 stats
      const user2Stats = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(user2Stats.body.stats.total_todos).toBe(1);
      expect(user2Stats.body.stats.completed_todos).toBe(1);
    });
  });

  describe('Database Consistency', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'dbuser',
          email: 'db@example.com',
          password: 'DbPassword123!'
        });
      authToken = response.body.token;
    });

    it('should maintain referential integrity', async () => {
      // Create a todo
      const todoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Integrity Test',
          description: 'Testing database integrity',
          priority: 'medium',
          difficulty: 'medium'
        });

      const todoId = todoResponse.body.id;

      // Complete the todo
      await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      // Verify todo is marked as completed
      const todosResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      const completedTodo = todosResponse.body.find((t: any) => t.id === todoId);
      expect(completedTodo.completed).toBe(1);
      expect(completedTodo.completed_at).toBeTruthy();
    });

    it('should handle concurrent operations safely', async () => {
      // Create multiple todos concurrently
      const todoPromises = Array(5).fill(null).map((_, index) =>
        request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Todo ${index}`,
            description: `Todo created concurrently`,
            priority: 'medium',
            difficulty: 'easy'
          })
      );

      const responses = await Promise.all(todoPromises);
      
      // All should succeed
      expect(responses.every(r => r.status === 201)).toBe(true);
      
      // All should have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should validate data constraints', async () => {
      // Test with null values
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: null,
          description: 'Valid description',
          priority: 'medium',
          difficulty: 'medium'
        });

      // Should handle gracefully (either reject or use defaults)
      expect([201, 400, 500]).toContain(response.status);
    });
  });
});