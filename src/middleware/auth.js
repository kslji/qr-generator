const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

function auth(req, res, next) {
  try {
    const gatewayUserId = req.headers['x-user-id'];
    const gatewayUserEmail = req.headers['x-user-email'];
    const forwardedBy = req.headers['x-forwarded-by'];

    if (forwardedBy === 'auth-gateway' && gatewayUserId) {
      req.user = {
        id: gatewayUserId,
        email: gatewayUserEmail || ''
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Access denied. Invalid token format.', 401, 'UNAUTHORIZED');
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: decoded.id,
      email: decoded.email
    };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired token.', 401, 'UNAUTHORIZED'));
    } else {
      next(err);
    }
  }
}

module.exports = auth;
