import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { initDatabase } from '../server/src/models/database';
import authRoutes from '../server/src/routes/auth';
import { errorHandler } from '../server/src/middleware/errorHandler';

describe('Authentication', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);

    // Initialize in-memory database
    await initDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        id: expect.any(Number),
        username: userData.username,
        email: userData.email,
        level: 1,
        experience: 0,
        streak_days: 0
      });
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: 'testuser',
        email: 'another@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        username: 'anotheruser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'incomplete' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Register a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'loginuser',
          email: 'login@example.com',
          password: 'LoginPassword123!'
        });
    });

    it('should login with username successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'LoginPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        username: 'loginuser',
        email: 'login@example.com'
      });
    });

    it('should login with email successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'login@example.com',
          password: 'LoginPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'LoginPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(401);
    });
  });
});