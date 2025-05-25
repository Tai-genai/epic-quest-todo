/*
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9999;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// Simple database initialization
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(path.join(__dirname, '../database.sqlite'));

// Initialize database
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          level INTEGER DEFAULT 1,
          experience INTEGER DEFAULT 0,
          streak_days INTEGER DEFAULT 0,
          last_login DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Todos table
      db.run(`
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT 0,
          priority TEXT DEFAULT 'medium',
          difficulty TEXT DEFAULT 'medium',
          experience_points INTEGER DEFAULT 10,
          due_date DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Achievements table
      db.run(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          required_value INTEGER,
          type TEXT NOT NULL
        )
      `);

      // User achievements table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_id INTEGER NOT NULL,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (achievement_id) REFERENCES achievements (id)
        )
      `);

      // Insert default achievements
      db.run(`
        INSERT OR IGNORE INTO achievements (name, description, icon, required_value, type) VALUES
        ('First Step', 'Complete your first task', '🎯', 1, 'tasks_completed'),
        ('Task Master', 'Complete 10 tasks', '💪', 10, 'tasks_completed'),
        ('Unstoppable', 'Complete 50 tasks', '🚀', 50, 'tasks_completed'),
        ('Week Warrior', '7 day streak', '🔥', 7, 'streak'),
        ('Month Master', '30 day streak', '⚡', 30, 'streak'),
        ('Level 5', 'Reach level 5', '⭐', 5, 'level'),
        ('Level 10', 'Reach level 10', '🌟', 10, 'level')
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    req.userId = decoded.userId;
    next();
  });
};

// Auth routes
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ message: 'Username or email already exists' });
          }
          return res.status(500).json({ message: 'Error creating user' });
        }

        const token = jwt.sign(
          { userId: this.lastID },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({
          message: 'User created successfully',
          token,
          user: {
            id: this.lastID,
            username,
            email,
            level: 1,
            experience: 0,
            streak_days: 0
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      db.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          level: user.level,
          experience: user.experience,
          streak_days: user.streak_days
        }
      });
    }
  );
});

// Todo routes
app.get('/api/todos', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId],
    (err, todos) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching todos' });
      }
      res.json(todos);
    }
  );
});

app.post('/api/todos', authenticateToken, (req, res) => {
  const { title, description, priority, difficulty, due_date } = req.body;
  
  const expPoints = {
    easy: 5,
    medium: 10,
    hard: 20,
    epic: 50
  };

  db.run(
    `INSERT INTO todos (user_id, title, description, priority, difficulty, experience_points, due_date) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, title, description, priority, difficulty, expPoints[difficulty] || 10, due_date],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error creating todo' });
      }
      
      res.status(201).json({
        id: this.lastID,
        title,
        description,
        priority,
        difficulty,
        experience_points: expPoints[difficulty] || 10,
        completed: false
      });
    }
  );
});

app.patch('/api/todos/:id/complete', authenticateToken, (req, res) => {
  const todoId = req.params.id;

  db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [todoId, req.userId],
    (err, todo) => {
      if (err || !todo) {
        return res.status(404).json({ message: 'Todo not found' });
      }

      if (todo.completed) {
        return res.status(400).json({ message: 'Todo already completed' });
      }

      db.run(
        'UPDATE todos SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [todoId],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error completing todo' });
          }

          db.run(
            'UPDATE users SET experience = experience + ? WHERE id = ?',
            [todo.experience_points, req.userId],
            (err) => {
              if (err) {
                console.error('Error updating user experience:', err);
              }

              db.get(
                'SELECT * FROM users WHERE id = ?',
                [req.userId],
                (err, user) => {
                  if (!err && user) {
                    const newLevel = Math.floor(user.experience / 100) + 1;
                    if (newLevel > user.level) {
                      db.run(
                        'UPDATE users SET level = ? WHERE id = ?',
                        [newLevel, req.userId]
                      );
                    }
                  }

                  res.json({
                    message: 'Todo completed!',
                    experienceGained: todo.experience_points,
                    newExperience: user ? user.experience : 0,
                    levelUp: user && newLevel > user.level
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.delete('/api/todos/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM todos WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error deleting todo' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Todo not found' });
      }
      res.json({ message: 'Todo deleted successfully' });
    }
  );
});

// Stats route
app.get('/api/stats', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM users WHERE id = ?',
    [req.userId],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ message: 'User not found' });
      }

      db.get(
        'SELECT COUNT(*) as completed_count FROM todos WHERE user_id = ? AND completed = 1',
        [req.userId],
        (err, result) => {
          const completedCount = result ? result.completed_count : 0;

          db.all(
            `SELECT a.* FROM achievements a
             JOIN user_achievements ua ON a.id = ua.achievement_id
             WHERE ua.user_id = ?`,
            [req.userId],
            (err, achievements) => {
              if (err) {
                achievements = [];
              }

              res.json({
                user: {
                  id: user.id,
                  username: user.username,
                  level: user.level,
                  experience: user.experience,
                  streak_days: user.streak_days,
                  experienceToNextLevel: 100 - (user.experience % 100)
                },
                stats: {
                  totalTodos: completedCount,
                  currentStreak: user.streak_days
                },
                achievements: achievements || []
              });
            }
          );
        }
      );
    }
  );
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// Start server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
*/
