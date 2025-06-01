import { initDatabase } from '../server/src/models/database';
import fs from 'fs';
import path from 'path';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Create a separate test database
const testDbPath = path.join(__dirname, '../server/test-database.sqlite');
const originalDbPath = path.join(__dirname, '../server/database.sqlite');

beforeAll(async () => {
  // Remove test database if it exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // Remove original database if it exists to ensure clean test state
  if (fs.existsSync(originalDbPath)) {
    fs.unlinkSync(originalDbPath);
  }
  
  // Initialize test database
  await initDatabase();
});

afterAll(async () => {
  // Clean up test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // Clean up original database created during tests
  if (fs.existsSync(originalDbPath)) {
    fs.unlinkSync(originalDbPath);
  }
});

// Global test utilities
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));