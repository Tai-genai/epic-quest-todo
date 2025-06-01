import request from 'supertest';
import express from 'express';
import cors from 'cors';
import authRoutes from '../../server/src/routes/auth';
import db from '../../server/src/models/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes', () => {
  beforeEach(async () => {
    // Clean up users table before each test
    return new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: expect.any(Number),
        username: 'testuser',
        email: 'test@example.com',
        level: 1,
        experience: 0,
        streak_days: 0
      });

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(response.body.user.id);
    });

    it('should reject registration with duplicate username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123'
      };

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'different@example.com',
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body.message).toBe('Username or email already exists');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123'
      };

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'differentuser',
          email: 'test@example.com',
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body.message).toBe('Username or email already exists');
    });

    it('should hash password correctly', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Check that password is hashed in database
      return new Promise<void>((resolve, reject) => {
        db.get('SELECT password FROM users WHERE username = ?', ['testuser'], (err, row: any) => {
          if (err) reject(err);
          expect(row.password).not.toBe('TestPassword123');
          expect(row.password.length).toBeGreaterThan(20);
          resolve();
        });
      });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const hashedPassword = await bcrypt.hash('TestPassword123', 10);
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['testuser', 'test@example.com', hashedPassword],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });

    it('should login with valid username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: expect.any(Number),
        username: 'testuser',
        email: 'test@example.com',
        level: 1,
        experience: 0,
        streak_days: 0
      });
    });

    it('should login with valid email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test@example.com',
          password: 'TestPassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'wronguser',
          password: 'TestPassword123'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should update last_login timestamp on successful login', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        })
        .expect(200);

      // Check that last_login was updated
      return new Promise<void>((resolve, reject) => {
        db.get('SELECT last_login FROM users WHERE username = ?', ['testuser'], (err, row: any) => {
          if (err) reject(err);
          expect(row.last_login).not.toBeNull();
          resolve();
        });
      });
    });
  });
});