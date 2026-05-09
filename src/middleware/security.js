const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Only for development
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "res.cloudinary.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Rate limiting configurations
const createRateLimits = () => {
  // General API rate limit
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Strict rate limit for authentication
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 auth attempts per window
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    skipSuccessfulRequests: true,
  });

  // Upload rate limit
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: {
      success: false,
      message: 'Too many uploads, please try again later.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
    }
  });

  // Script creation rate limit
  const scriptCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 scripts per hour
    message: {
      success: false,
      message: 'Too many scripts created, please try again later.',
      code: 'SCRIPT_RATE_LIMIT_EXCEEDED'
    }
  });

  return {
    apiLimiter,
    authLimiter,
    uploadLimiter,
    scriptCreationLimiter
  };
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    sanitizeObject(req.params);
  }

  next();
};

// Recursive object sanitization
const sanitizeObject = (obj) => {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        // Basic XSS prevention
        obj[key] = DOMPurify.sanitize(obj[key], {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        }).trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  }
};

// Validation rules
const validationRules = {
  // User validation
  register: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),
    
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase, one uppercase, one number, and one special character'),
    
    body('phoneNumber')
      .optional()
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    
    body('isWriter')
      .optional()
      .isBoolean()
      .withMessage('isWriter must be a boolean')
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  // Script validation
  createScript: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    
    body('content')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100000 })
      .withMessage('Content must be between 1 and 100,000 characters'),
    
    body('genre')
      .optional()
      .isIn(['Drama', 'Comedy', 'Sci-Fi', 'Horror', 'Romance', 'Thriller', 'Action', 'Other'])
      .withMessage('Invalid genre'),
    
    body('language')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Language must be between 2 and 50 characters'),
    
    body('pageCount')
      .optional()
      .isInt({ min: 0, max: 10000 })
      .withMessage('Page count must be between 0 and 10,000'),
    
    body('isPremiumOnly')
      .optional()
      .isBoolean()
      .withMessage('isPremiumOnly must be a boolean'),
    
    body('status')
      .optional()
      .isIn(['draft', 'published', 'archived'])
      .withMessage('Invalid status')
  ],

  // Comment validation
  createComment: [
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters'),
    
    body('scriptId')
      .isUUID()
      .withMessage('Invalid script ID'),
    
    body('parentId')
      .optional()
      .isUUID()
      .withMessage('Invalid parent comment ID')
  ],

  // Bug report validation
  createBugReport: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    
    body('description')
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Description must be between 10 and 2000 characters'),
    
    body('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity level'),
    
    body('category')
      .optional()
      .isIn(['ui', 'backend', 'payment', 'auth', 'performance', 'other'])
      .withMessage('Invalid category'),
    
    body('url')
      .optional()
      .isURL()
      .withMessage('Please provide a valid URL')
  ],

  // Parameter validation
  uuid: [
    param('id')
      .isUUID()
      .withMessage('Invalid ID format')
  ],

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

// Content security middleware
const contentSecurity = (req, res, next) => {
  // Check for malicious patterns in request
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi
  ];

  const checkSuspiciousContent = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(obj[key])) {
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkSuspiciousContent(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  // Check request body, query, and params
  if (checkSuspiciousContent(req.body) || 
      checkSuspiciousContent(req.query) || 
      checkSuspiciousContent(req.params)) {
    
    console.warn('Suspicious content detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      timestamp: new Date().toISOString()
    });
    
    return res.status(400).json({
      success: false,
      message: 'Invalid content detected',
      code: 'SUSPICIOUS_CONTENT'
    });
  }

  next();
};

// File upload security
const fileSecurity = {
  // Allowed MIME types
  allowedMimeTypes: {
    avatar: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    script: ['text/plain', 'text/markdown', 'application/pdf']
  },

  // File size limits (in bytes)
  maxFileSize: {
    avatar: 2 * 1024 * 1024, // 2MB
    script: 10 * 1024 * 1024  // 10MB
  },

  // Validate file
  validateFile: (file, type) => {
    const allowedMimes = fileSecurity.allowedMimeTypes[type] || [];
    const maxSize = fileSecurity.maxFileSize[type] || fileSecurity.maxFileSize.script;

    if (!allowedMimes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
      };
    }

    return { valid: true };
  }
};

// SQL injection prevention (additional layer)
const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|#|\/\*|\*\/)/g,
    /(\bOR\b.*=.*\bOR\b)/gi,
    /(\bAND\b.*=.*\bAND\b)/gi,
    /(\bxp_cmdshell\b)/gi
  ];

  const checkSQLInjection = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of sqlPatterns) {
          if (pattern.test(obj[key])) {
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkSQLInjection(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkSQLInjection(req.body) || 
      checkSQLInjection(req.query) || 
      checkSQLInjection(req.params)) {
    
    console.warn('SQL injection attempt detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      timestamp: new Date().toISOString()
    });
    
    return res.status(400).json({
      success: false,
      message: 'Invalid request detected',
      code: 'SQL_INJECTION_ATTEMPT'
    });
  }

  next();
};

module.exports = {
  securityHeaders,
  createRateLimits,
  sanitizeInput,
  validationRules,
  handleValidationErrors,
  contentSecurity,
  fileSecurity,
  preventSQLInjection
};
