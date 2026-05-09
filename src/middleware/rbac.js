const userService = require('../models/User');

// Role definitions
const ROLES = {
  READER: 'user',
  WRITER: 'writer', 
  ADMIN: 'admin'
};

// Permission definitions
const PERMISSIONS = {
  // Reader permissions
  READ_SCRIPTS: 'read_scripts',
  COMMENT_SCRIPTS: 'comment_scripts',
  RATE_SCRIPTS: 'rate_scripts',
  
  // Writer permissions (includes all reader permissions)
  UPLOAD_SCRIPTS: 'upload_scripts',
  EDIT_OWN_SCRIPTS: 'edit_own_scripts',
  DELETE_OWN_SCRIPTS: 'delete_own_scripts',
  MANAGE_OWN_SCRIPTS: 'manage_own_scripts',
  
  // Admin permissions (includes all permissions)
  MANAGE_USERS: 'manage_users',
  MANAGE_ALL_SCRIPTS: 'manage_all_scripts',
  MANAGE_COMMENTS: 'manage_comments',
  MANAGE_PAYMENTS: 'manage_payments',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_BUG_REPORTS: 'manage_bug_reports',
  SYSTEM_ADMIN: 'system_admin'
};

// Role to permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.READER]: [
    PERMISSIONS.READ_SCRIPTS,
    PERMISSIONS.COMMENT_SCRIPTS,
    PERMISSIONS.RATE_SCRIPTS
  ],
  [ROLES.WRITER]: [
    PERMISSIONS.READ_SCRIPTS,
    PERMISSIONS.COMMENT_SCRIPTS,
    PERMISSIONS.RATE_SCRIPTS,
    PERMISSIONS.UPLOAD_SCRIPTS,
    PERMISSIONS.EDIT_OWN_SCRIPTS,
    PERMISSIONS.DELETE_OWN_SCRIPTS,
    PERMISSIONS.MANAGE_OWN_SCRIPTS
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.READ_SCRIPTS,
    PERMISSIONS.COMMENT_SCRIPTS,
    PERMISSIONS.RATE_SCRIPTS,
    PERMISSIONS.UPLOAD_SCRIPTS,
    PERMISSIONS.EDIT_OWN_SCRIPTS,
    PERMISSIONS.DELETE_OWN_SCRIPTS,
    PERMISSIONS.MANAGE_OWN_SCRIPTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ALL_SCRIPTS,
    PERMISSIONS.MANAGE_COMMENTS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_BUG_REPORTS,
    PERMISSIONS.SYSTEM_ADMIN
  ]
};

// Helper functions
const hasRole = (user, role) => {
  if (!user) return false;
  if (role === ROLES.ADMIN) return user.role === ROLES.ADMIN;
  if (role === ROLES.WRITER) return user.isWriter || user.role === ROLES.ADMIN;
  return true; // All authenticated users are readers
};

const hasPermission = (user, permission) => {
  if (!user) return false;
  
  const userRole = user.role === ROLES.ADMIN ? ROLES.ADMIN : 
                   user.isWriter ? ROLES.WRITER : ROLES.READER;
  
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

// Middleware functions
const authenticateUser = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
};

const requireReader = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // All authenticated users are readers
  next();
};

const requireWriter = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (!hasRole(req.user, ROLES.WRITER)) {
    return res.status(403).json({
      success: false,
      message: 'Writer access required',
      code: 'WRITER_REQUIRED'
    });
  }
  
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (!hasRole(req.user, ROLES.ADMIN)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  next();
};

// Permission-based middleware factory
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission required: ${permission}`,
        code: 'PERMISSION_REQUIRED',
        permission
      });
    }
    
    next();
  };
};

// Resource ownership middleware
const requireOwnership = (resourceType, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Admins bypass ownership checks
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }
      
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID required',
          code: 'RESOURCE_ID_REQUIRED'
        });
      }
      
      let isOwner = false;
      
      switch (resourceType) {
        case 'script':
          const Script = require('../models/Script');
          const script = await Script.findById(resourceId);
          isOwner = script && script.authorId === req.user.id;
          break;
          
        case 'user':
          isOwner = resourceId === req.user.id;
          break;
          
        case 'comment':
          // Add comment ownership check when comment model is implemented
          const Comment = require('../models/Comment');
          const comment = await Comment.findById(resourceId);
          isOwner = comment && comment.userId === req.user.id;
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type',
            code: 'INVALID_RESOURCE_TYPE'
          });
      }
      
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Resource ownership required',
          code: 'OWNERSHIP_REQUIRED'
        });
      }
      
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
        code: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

// Premium access middleware
const requirePremium = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Admins bypass premium checks
  if (req.user.role === ROLES.ADMIN) {
    return next();
  }
  
  if (!userService.isPremiumActive(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Premium access required',
      code: 'PREMIUM_REQUIRED',
      requiresPremium: true
    });
  }
  
  next();
};

// Verified writer middleware
const requireVerifiedWriter = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Admins bypass verification checks
  if (req.user.role === ROLES.ADMIN) {
    return next();
  }
  
  if (!req.user.isWriter) {
    return res.status(403).json({
      success: false,
      message: 'Writer account required',
      code: 'WRITER_REQUIRED'
    });
  }
  
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Writer account must be verified',
      code: 'WRITER_VERIFICATION_REQUIRED'
    });
  }
  
  next();
};

// Rate limiting middleware (basic implementation)
const createRateLimit = (windowMs, maxRequests, message = 'Too many requests') => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip + (req.user ? `-${req.user.id}` : '');
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [ip, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
      if (validTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, validTimestamps);
      }
    }
    
    // Check current requests
    const userRequests = requests.get(key) || [];
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current request
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    next();
  };
};

// Utility functions
const getUserPermissions = (user) => {
  const userRole = user.role === ROLES.ADMIN ? ROLES.ADMIN : 
                   user.isWriter ? ROLES.WRITER : ROLES.READER;
  return ROLE_PERMISSIONS[userRole] || [];
};

const getUserRole = (user) => {
  if (user.role === ROLES.ADMIN) return ROLES.ADMIN;
  if (user.isWriter) return ROLES.WRITER;
  return ROLES.READER;
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  authenticateUser,
  requireReader,
  requireWriter,
  requireAdmin,
  requirePermission,
  requireOwnership,
  requirePremium,
  requireVerifiedWriter,
  createRateLimit,
  hasRole,
  hasPermission,
  getUserPermissions,
  getUserRole
};
