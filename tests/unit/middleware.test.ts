import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../server/src/middleware/auth';
import { errorHandler } from '../../server/src/middleware/errorHandler';

// Mock request/response objects
const mockRequest = (headers: any = {}) => ({
  headers,
  body: {},
  params: {},
  query: {},
}) as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET!, { expiresIn: '1h' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect((req as any).userId).toBe(123);
      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', () => {
      const req = mockRequest({});
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. No token provided.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', () => {
      const req = mockRequest({ authorization: 'InvalidFormat' });
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. No token provided.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', () => {
      const expiredToken = jwt.sign({ userId: 123 }, process.env.JWT_SECRET!, { expiresIn: '-1h' });
      const req = mockRequest({ authorization: `Bearer ${expiredToken}` });
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle token without userId', () => {
      const tokenWithoutUserId = jwt.sign({ someOtherField: 'value' }, process.env.JWT_SECRET!);
      const req = mockRequest({ authorization: `Bearer ${tokenWithoutUserId}` });
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect((req as any).userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Error Handler Middleware', () => {
  it('should handle standard errors', () => {
    const error = new Error('Test error');
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Test error',
      stack: expect.any(String)
    });
  });

  it('should handle errors with custom status codes', () => {
    const error = Object.assign(new Error('Custom error'), { status: 400 });
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Custom error',
      stack: expect.any(String)
    });
  });

  it('should not include stack trace in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Production error');
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Production error'
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle non-Error objects', () => {
    const error = 'String error';
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal Server Error'
    });
  });
});