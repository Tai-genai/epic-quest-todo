import express from 'express';
import db from '../models/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get user stats and achievements
router.get('/', authenticateToken, (req: any, res) => {
  // Get user stats
  db.get(
    'SELECT * FROM users WHERE id = ?',
    [req.userId],
    (err, user: any) => {
      if (err || !user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get completed todos count
      db.get(
        'SELECT COUNT(*) as completed_count FROM todos WHERE user_id = ? AND completed = 1',
        [req.userId],
        (err, result: any) => {
          const completedCount = result ? result.completed_count : 0;

          // Get user achievements
          db.all(
            `SELECT a.* FROM achievements a
             JOIN user_achievements ua ON a.id = ua.achievement_id
             WHERE ua.user_id = ?`,
            [req.userId],
            (err, achievements) => {
              if (err) {
                achievements = [];
              }

              // Check for new achievements
              checkAchievements(req.userId, completedCount, user.streak_days, user.level);

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

// Check and unlock achievements
function checkAchievements(userId: number, completedTasks: number, streak: number, level: number) {
  // Check tasks completed achievements
  db.all(
    `SELECT * FROM achievements WHERE type = 'tasks_completed' AND required_value <= ?
     AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)`,
    [completedTasks, userId],
    (err, achievements: any[]) => {
      if (!err && achievements) {
        achievements.forEach(achievement => {
          db.run(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [userId, achievement.id]
          );
        });
      }
    }
  );

  // Check streak achievements
  db.all(
    `SELECT * FROM achievements WHERE type = 'streak' AND required_value <= ?
     AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)`,
    [streak, userId],
    (err, achievements: any[]) => {
      if (!err && achievements) {
        achievements.forEach(achievement => {
          db.run(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [userId, achievement.id]
          );
        });
      }
    }
  );

  // Check level achievements
  db.all(
    `SELECT * FROM achievements WHERE type = 'level' AND required_value <= ?
     AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)`,
    [level, userId],
    (err, achievements: any[]) => {
      if (!err && achievements) {
        achievements.forEach(achievement => {
          db.run(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [userId, achievement.id]
          );
        });
      }
    }
  );
}

export default router;
