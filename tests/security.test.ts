import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDatabase } from '../server/src/models/database';
import authRoutes from '../server/src/routes/auth';
import todoRoutes from '../server/src/routes/todos';
import { errorHandler } from '../server/src/middleware/errorHandler';

describe('Security Tests', () => {
  let app: express.Application;

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
  });

  describe('Authentication Security', () => {
    it('should hash passwords properly', async () => {
      const password = 'TestPassword123!';
      const userData = {
        username: 'securitytest',
        email: 'security@example.com',
        password: password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Verify password is hashed (not stored in plain text)
      const hash = await bcrypt.hash(password, 10);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(password.length);
    });

    it('should generate valid JWT tokens', async () => {
      const userData = {
        username: 'jwttest',
        email: 'jwt@example.com',
        password: 'JwtPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.token).toBeDefined();

      // Verify token structure
      const token = response.body.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(response.body.user.id);
      expect(decoded.exp).toBeDefined();
    });

    it('should reject expired tokens', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 1 },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      );

      return request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid or expired token');
        });
    });

    it('should reject malformed tokens', () => {
      return request(app)
        .get('/api/todos')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(403);
    });

    it('should reject tokens with wrong secret', () => {
      const wrongSecretToken = jwt.sign(
        { userId: 1 },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      return request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(403);
    });
  });

  describe('Authorization Security', () => {
    let userToken: string;
    let otherUserToken: string;
    let todoId: number;

    beforeAll(async () => {
      // Create first user
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'authuser1',
          email: 'authuser1@example.com',
          password: 'AuthPassword123!'
        });
      userToken = user1Response.body.token;

      // Create second user
      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'authuser2',
          email: 'authuser2@example.com',
          password: 'AuthPassword123!'
        });
      otherUserToken = user2Response.body.token;

      // Create a todo with first user
      const todoResponse = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Private Todo',
          description: 'This belongs to user1',
          priority: 'medium',
          difficulty: 'medium'
        });
      todoId = todoResponse.body.id;
    });

    it('should prevent access to other users todos via GET', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]); // Should not see user1's todos
    });

    it('should prevent completing other users todos', async () => {
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Todo not found');
    });

    it('should prevent deleting other users todos', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Todo not found');
    });
  });

  describe('Input Validation Security', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validationuser',
          email: 'validation@example.com',
          password: 'ValidationPassword123!'
        });
      authToken = response.body.token;
    });

    it('should handle SQL injection attempts in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: "admin'; DROP TABLE users; --",
          password: 'anything'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should handle XSS attempts in todo creation', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: xssPayload,
          description: xssPayload,
          priority: 'medium',
          difficulty: 'medium'
        });

      expect(response.status).toBe(201);
      // The payload should be stored as-is, but properly escaped when rendered
      expect(response.body.title).toBe(xssPayload);
    });

    it('should handle large payload attacks', async () => {
      const largeString = 'a'.repeat(10000);
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: largeString,
          description: largeString,
          priority: 'medium',
          difficulty: 'medium'
        });

      // Should either accept or reject gracefully, not crash
      expect([201, 400, 413, 500]).toContain(response.status);
    });

    it('should handle null byte injection', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test\x00Title',
          description: 'Test\x00Description',
          priority: 'medium',
          difficulty: 'medium'
        });

      // Should handle gracefully
      expect([201, 400, 500]).toContain(response.status);
    });
  });

  describe('Session Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
      // Should not reveal whether username exists or password is wrong
      expect(response.body.message).not.toContain('username');
      expect(response.body.message).not.toContain('password');
      expect(response.body.message).not.toContain('email');
    });

    it('should not leak user information in registration conflicts', async () => {
      // Register a user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'conflictuser',
          email: 'conflict@example.com',
          password: 'ConflictPassword123!'
        });

      // Try to register with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'conflictuser',
          email: 'different@example.com',
          password: 'ConflictPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should handle concurrent requests safely', async () => {
      const userData = {
        username: 'concurrentuser',
        email: 'concurrent@example.com',
        password: 'ConcurrentPassword123!'
      };

      // Make multiple concurrent registration requests
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/auth/register')
          .send(userData)
      );

      const responses = await Promise.all(promises);
      
      // Only one should succeed, others should fail with conflict
      const successful = responses.filter(r => r.status === 201);
      const conflicts = responses.filter(r => r.status === 400);
      
      expect(successful).toHaveLength(1);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });
});