const rbac = require('./rbac');

// Re-export RBAC middleware for backward compatibility
exports.isLoggedIn = rbac.authenticateUser;
exports.isLoggedOut = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }

  res.status(400).json({
    success: false,
    message: 'You are already logged in'
  });
};
exports.isAdmin = rbac.requireAdmin;
exports.checkAccess = rbac.requirePremium;

// Export all RBAC middleware
exports.requireReader = rbac.requireReader;
exports.requireWriter = rbac.requireWriter;
exports.requireAdmin = rbac.requireAdmin;
exports.requirePremium = rbac.requirePremium;
exports.requireVerifiedWriter = rbac.requireVerifiedWriter;
exports.requirePermission = rbac.requirePermission;
exports.requireOwnership = rbac.requireOwnership;
exports.createRateLimit = rbac.createRateLimit;

// Make user available to all views
exports.setCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
};
