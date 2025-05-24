import express from 'express';
import db from '../models/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all todos for user
router.get('/', authenticateToken, (req: any, res) => {
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

// Create todo
router.post('/', authenticateToken, (req: any, res) => {
  const { title, description, priority, difficulty, due_date } = req.body;
  
  // Calculate experience points based on difficulty
  const expPoints = {
    easy: 5,
    medium: 10,
    hard: 20,
    epic: 50
  };

  db.run(
    `INSERT INTO todos (user_id, title, description, priority, difficulty, experience_points, due_date) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, title, description, priority, difficulty, expPoints[difficulty as keyof typeof expPoints] || 10, due_date],
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
        experience_points: expPoints[difficulty as keyof typeof expPoints] || 10,
        completed: false
      });
    }
  );
});

// Complete todo
router.patch('/:id/complete', authenticateToken, (req: any, res) => {
  const todoId = req.params.id;

  // Get todo details
  db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [todoId, req.userId],
    (err, todo: any) => {
      if (err || !todo) {
        return res.status(404).json({ message: 'Todo not found' });
      }

      if (todo.completed) {
        return res.status(400).json({ message: 'Todo already completed' });
      }

      // Complete the todo
      db.run(
        'UPDATE todos SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [todoId],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error completing todo' });
          }

          // Update user experience
          db.run(
            'UPDATE users SET experience = experience + ? WHERE id = ?',
            [todo.experience_points, req.userId],
            (err) => {
              if (err) {
                console.error('Error updating user experience:', err);
              }

              // Check for level up
              db.get(
                'SELECT * FROM users WHERE id = ?',
                [req.userId],
                (err, user: any) => {
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

// Delete todo
router.delete('/:id', authenticateToken, (req: any, res) => {
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

export default router;
