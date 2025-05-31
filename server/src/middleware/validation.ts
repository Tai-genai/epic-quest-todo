import { Request, Response, NextFunction } from 'express';

export const validateTodo = (req: Request, res: Response, next: NextFunction) => {
  const { title, description, priority, difficulty, category, tags } = req.body;
  
  // Title validation
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ message: 'Title is required and must be a non-empty string' });
  }
  
  if (title.length > 200) {
    return res.status(400).json({ message: 'Title must be less than 200 characters' });
  }
  
  // Description validation
  if (description && typeof description !== 'string') {
    return res.status(400).json({ message: 'Description must be a string' });
  }
  
  if (description && description.length > 1000) {
    return res.status(400).json({ message: 'Description must be less than 1000 characters' });
  }
  
  // Priority validation
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ message: 'Priority must be one of: low, medium, high, critical' });
  }
  
  // Difficulty validation
  const validDifficulties = ['easy', 'medium', 'hard', 'epic'];
  if (difficulty && !validDifficulties.includes(difficulty)) {
    return res.status(400).json({ message: 'Difficulty must be one of: easy, medium, hard, epic' });
  }
  
  // Category validation
  if (category && typeof category !== 'string') {
    return res.status(400).json({ message: 'Category must be a string' });
  }
  
  if (category && category.length > 50) {
    return res.status(400).json({ message: 'Category must be less than 50 characters' });
  }
  
  // Tags validation
  if (tags) {
    if (!Array.isArray(tags)) {
      return res.status(400).json({ message: 'Tags must be an array' });
    }
    
    if (tags.length > 10) {
      return res.status(400).json({ message: 'Maximum 10 tags allowed' });
    }
    
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length > 30) {
        return res.status(400).json({ message: 'Each tag must be a string with less than 30 characters' });
      }
    }
  }
  
  // Sanitize inputs
  req.body.title = title.trim();
  if (description) req.body.description = description.trim();
  if (category) req.body.category = category.trim().toLowerCase();
  
  next();
};

export const validateAuth = (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password } = req.body;
  
  // Username validation
  if (username && (typeof username !== 'string' || username.length < 3 || username.length > 50)) {
    return res.status(400).json({ message: 'Username must be between 3 and 50 characters' });
  }
  
  // Email validation
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
  }
  
  // Password validation
  if (password) {
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    // Strong password policy
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({ 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      });
    }
  }
  
  next();
};