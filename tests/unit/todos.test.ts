import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import todoRoutes from '../../server/src/routes/todos';
import { authenticateToken } from '../../server/src/middleware/auth';
import db from '../../server/src/models/database';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/todos', todoRoutes);

// Helper function to create a test user and get JWT token
const createTestUser = async (): Promise<{ userId: number; token: string }> => {
  const hashedPassword = await bcrypt.hash('TestPassword123', 10);
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      ['testuser', 'test@example.com', hashedPassword],
      function(err) {
        if (err) reject(err);
        
        const userId = this.lastID;
        const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
        resolve({ userId, token });
      }
    );
  });
};

describe('Todo Routes', () => {
  let testUser: { userId: number; token: string };

  beforeEach(async () => {
    // Clean up tables before each test
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM todos', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create test user
    testUser = await createTestUser();
  });

  describe('GET /api/todos', () => {
    it('should return empty array when user has no todos', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return todos for authenticated user', async () => {
      // Create test todos
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description, priority, difficulty) VALUES (?, ?, ?, ?, ?)',
          [testUser.userId, 'Test Todo 1', 'Test Description 1', 'high', 'medium'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description, priority, difficulty) VALUES (?, ?, ?, ?, ?)',
          [testUser.userId, 'Test Todo 2', 'Test Description 2', 'low', 'easy'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('title', 'Test Todo 2'); // Most recent first
      expect(response.body[1]).toHaveProperty('title', 'Test Todo 1');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/todos')
        .expect(401);

      expect(response.body.message).toBe('Access denied. No token provided.');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.message).toBe('Invalid token.');
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo successfully', async () => {
      const todoData = {
        title: 'New Todo',
        description: 'Test description',
        priority: 'high',
        difficulty: 'hard',
        due_date: '2024-12-31T23:59:59Z'
      };

      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send(todoData)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number),
        title: 'New Todo',
        description: 'Test description',
        priority: 'high',
        difficulty: 'hard',
        experience_points: 20, // hard difficulty = 20 XP
        completed: false
      });

      // Verify todo was saved to database
      return new Promise<void>((resolve, reject) => {
        db.get(
          'SELECT * FROM todos WHERE id = ?',
          [response.body.id],
          (err, todo: any) => {
            if (err) reject(err);
            expect(todo).toBeTruthy();
            expect(todo.title).toBe('New Todo');
            expect(todo.user_id).toBe(testUser.userId);
            resolve();
          }
        );
      });
    });

    it('should assign correct experience points based on difficulty', async () => {
      const difficulties = [
        { difficulty: 'easy', expectedXP: 5 },
        { difficulty: 'medium', expectedXP: 10 },
        { difficulty: 'hard', expectedXP: 20 },
        { difficulty: 'epic', expectedXP: 50 }
      ];

      for (const { difficulty, expectedXP } of difficulties) {
        const response = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${testUser.token}`)
          .send({
            title: `Test ${difficulty}`,
            description: 'Test',
            priority: 'medium',
            difficulty
          })
          .expect(201);

        expect(response.body.experience_points).toBe(expectedXP);
      }
    });

    it('should default to 10 XP for unknown difficulty', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          title: 'Test Todo',
          description: 'Test',
          priority: 'medium',
          difficulty: 'unknown'
        })
        .expect(201);

      expect(response.body.experience_points).toBe(10);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({
          title: 'Test Todo',
          description: 'Test'
        })
        .expect(401);

      expect(response.body.message).toBe('Access denied. No token provided.');
    });
  });

  describe('PATCH /api/todos/:id/complete', () => {
    let todoId: number;

    beforeEach(async () => {
      // Create a test todo
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description, priority, difficulty, experience_points) VALUES (?, ?, ?, ?, ?, ?)',
          [testUser.userId, 'Test Todo', 'Test Description', 'medium', 'hard', 20],
          function(err) {
            if (err) reject(err);
            todoId = this.lastID;
            resolve();
          }
        );
      });
    });

    it('should complete todo and award experience', async () => {
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Todo completed!',
        experienceGained: 20,
        newExperience: expect.any(Number),
        levelUp: expect.any(Boolean)
      });

      // Verify todo is marked as completed
      return new Promise<void>((resolve, reject) => {
        db.get(
          'SELECT completed, completed_at FROM todos WHERE id = ?',
          [todoId],
          (err, todo: any) => {
            if (err) reject(err);
            expect(todo.completed).toBe(1);
            expect(todo.completed_at).toBeTruthy();
            resolve();
          }
        );
      });
    });

    it('should update user experience correctly', async () => {
      // Get initial experience
      const initialUser = await new Promise<any>((resolve, reject) => {
        db.get('SELECT experience FROM users WHERE id = ?', [testUser.userId], (err, user) => {
          if (err) reject(err);
          else resolve(user);
        });
      });

      await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Check updated experience
      return new Promise<void>((resolve, reject) => {
        db.get('SELECT experience FROM users WHERE id = ?', [testUser.userId], (err, user: any) => {
          if (err) reject(err);
          expect(user.experience).toBe(initialUser.experience + 20);
          resolve();
        });
      });
    });

    it('should detect level up correctly', async () => {
      // Set user experience to 95 (need 5 more for level up)
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET experience = 95, level = 1 WHERE id = ?', [testUser.userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body.levelUp).toBe(true);

      // Verify level was updated
      return new Promise<void>((resolve, reject) => {
        db.get('SELECT level FROM users WHERE id = ?', [testUser.userId], (err, user: any) => {
          if (err) reject(err);
          expect(user.level).toBe(2);
          resolve();
        });
      });
    });

    it('should reject completing already completed todo', async () => {
      // First completion
      await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      // Second completion should fail
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(400);

      expect(response.body.message).toBe('Todo already completed');
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await request(app)
        .patch('/api/todos/999999/complete')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(404);

      expect(response.body.message).toBe('Todo not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/todos/${todoId}/complete`)
        .expect(401);

      expect(response.body.message).toBe('Access denied. No token provided.');
    });
  });

  describe('DELETE /api/todos/:id', () => {
    let todoId: number;

    beforeEach(async () => {
      // Create a test todo
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)',
          [testUser.userId, 'Test Todo', 'Test Description'],
          function(err) {
            if (err) reject(err);
            todoId = this.lastID;
            resolve();
          }
        );
      });
    });

    it('should delete todo successfully', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body.message).toBe('Todo deleted successfully');

      // Verify todo was deleted
      return new Promise<void>((resolve, reject) => {
        db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, todo) => {
          if (err) reject(err);
          expect(todo).toBeFalsy();
          resolve();
        });
      });
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await request(app)
        .delete('/api/todos/999999')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(404);

      expect(response.body.message).toBe('Todo not found');
    });

    it('should not allow deleting other users todos', async () => {
      // Create another user
      const otherUser = await createTestUser();

      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .expect(404);

      expect(response.body.message).toBe('Todo not found');

      // Verify original todo still exists
      return new Promise<void>((resolve, reject) => {
        db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, todo) => {
          if (err) reject(err);
          expect(todo).toBeTruthy();
          resolve();
        });
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(401);

      expect(response.body.message).toBe('Access denied. No token provided.');
    });
  });
});