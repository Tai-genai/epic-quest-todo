# Epic Quest Todo - Test Suite

Comprehensive test suite for the Epic Quest Todo application covering unit tests, integration tests, and security tests.

## Test Structure

```
tests/
├── setup.ts                    # Global test setup and utilities
├── unit/                       # Unit tests for individual components
│   ├── auth.test.ts            # Authentication system tests
│   ├── todos.test.ts           # Todo management tests
│   ├── middleware.test.ts      # Middleware tests
│   └── stats.test.ts           # Stats and gamification tests
├── integration/                # Integration tests
│   ├── app.test.ts            # Full application flow tests
│   └── database.test.ts        # Database integration tests
├── security/                   # Security-focused tests
│   └── security.test.ts        # Security vulnerability tests
└── README.md                   # This file
```

## Test Categories

### Unit Tests (45+ test cases)
- **Authentication Tests** - User registration, login, JWT token handling
- **Todo Management Tests** - CRUD operations, completion system, experience points
- **Middleware Tests** - Token authentication, error handling
- **Stats & Gamification Tests** - Achievement system, level progression, streak calculation

### Integration Tests (12+ test cases)
- **Full Application Flow** - End-to-end user journey testing
- **Database Integration** - Schema validation, constraints, performance testing

### Security Tests (18+ test cases)
- **Authentication Security** - Password hashing, JWT validation
- **Authorization Security** - Access control, data isolation between users
- **Input Validation** - SQL injection prevention, XSS protection
- **Session Security** - Token manipulation, concurrent access
- **Error Disclosure** - Information leakage prevention

## Running Tests

### Prerequisites
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test Files
```bash
# Unit tests only
npx jest tests/unit

# Integration tests only
npx jest tests/integration

# Security tests only
npx jest tests/security

# Specific test file
npx jest tests/unit/auth.test.ts
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript support with ts-jest
- Test environment: Node.js
- Coverage collection from server source files
- Test timeout: 10 seconds
- Setup file: `tests/setup.ts`

### Environment Variables
Tests use the following environment variables:
- `NODE_ENV=test` - Indicates test environment
- `JWT_SECRET=test-secret-key-for-testing-only` - Test JWT secret

### Database
Tests use a separate SQLite database (`server/database.sqlite`) that is:
- Created fresh for each test run
- Cleaned between test suites
- Automatically removed after tests complete

## Test Coverage Areas

### ✅ Fully Tested
- User authentication (registration, login, JWT)
- Todo CRUD operations
- Experience point system
- Achievement unlocking
- Level progression
- User data isolation
- Basic security measures

### ⚠️ Partially Tested
- Error handling edge cases
- Database constraints
- Concurrent operations
- Rate limiting (framework not implemented)

### ❌ Not Tested (Features Not Implemented)
- Categories and tags
- PWA functionality
- Push notifications
- OAuth authentication
- Advanced security features

## Key Test Scenarios

### Authentication Flow
1. User registration with password hashing
2. Login with username/email
3. JWT token generation and validation
4. Access control for protected routes

### Todo Management Flow
1. Create todos with different difficulties
2. Complete todos and gain experience
3. Level up when reaching 100+ XP
4. Achievement unlocking based on progress

### Security Scenarios
1. Prevent access without authentication
2. Prevent users from accessing other users' data
3. SQL injection prevention
4. Token manipulation detection

### Integration Scenarios
1. Complete user journey from registration to todo completion
2. Database consistency during complex operations
3. Error handling across the entire application

## Writing New Tests

### Test File Naming
- Unit tests: `*.test.ts` in `tests/unit/`
- Integration tests: `*.test.ts` in `tests/integration/`
- Security tests: `*.test.ts` in `tests/security/`

### Test Structure
```typescript
describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup before each test
  });

  it('should do something specific', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Helper Functions
Common helper functions are available in test files:
- `createTestUser()` - Creates a test user and returns user data with JWT token
- `delay(ms)` - Utility for waiting in async tests

### Database Cleanup
Each test file should clean up database tables in `beforeEach`:
```typescript
beforeEach(async () => {
  const tables = ['user_achievements', 'todos', 'users'];
  for (const table of tables) {
    await new Promise<void>((resolve, reject) => {
      db.run(`DELETE FROM ${table}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
});
```

## Test Quality Guidelines

### Test Naming
- Use descriptive test names that explain the expected behavior
- Start with "should" for behavior expectations
- Include both positive and negative test cases

### Test Independence
- Each test should be independent and not rely on other tests
- Clean up data between tests
- Don't assume test execution order

### Assertions
- Use specific assertions that clearly indicate expected behavior
- Test both success and error cases
- Verify side effects (database changes, etc.)

### Coverage Goals
- Aim for >80% code coverage
- Focus on critical paths and edge cases
- Test error conditions and boundary values

## Continuous Integration

These tests are designed to run in CI/CD environments:
- No external dependencies required
- Self-contained SQLite database
- Deterministic test results
- Reasonable execution time (<30 seconds)

## Troubleshooting

### Common Issues

1. **Database locked errors**
   - Solution: Ensure proper cleanup in `afterEach`/`afterAll`

2. **Port conflicts**
   - Solution: Tests don't start actual server, use supertest

3. **JWT secret errors**
   - Solution: Verify `JWT_SECRET` environment variable is set in setup

4. **Async test timeouts**
   - Solution: Increase timeout in Jest config or specific tests

### Debug Mode
Run tests with additional logging:
```bash
DEBUG=* npm test
```

## Future Improvements

### Planned Test Enhancements
- API response schema validation
- Performance benchmarking tests
- Load testing for concurrent users
- End-to-end browser testing
- Snapshot testing for API responses

### When New Features Are Added
- Categories/Tags: Add validation and CRUD tests
- PWA: Add manifest and service worker tests
- OAuth: Add third-party authentication tests
- Notifications: Add push notification tests
- Rate Limiting: Add rate limit validation tests