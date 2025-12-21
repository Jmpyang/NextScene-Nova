// Check if user is authenticated
exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    success: false,
    message: 'Login required',
    isAuthenticated: false
  });
};

// Check if user is NOT authenticated (for login/register pages)
exports.isLoggedOut = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }

  res.status(400).json({
    success: false,
    message: 'You are already logged in'
  });
};

// Check if user is an admin
exports.isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({
    success: false,
    message: 'Access denied. Admin privileges required.'
  });
};

// Check access to premium content (Admin or Premium User)
exports.checkAccess = (req, res, next) => {
  // If content is not premium, allow access (logic handled in controller, 
  // but here we check if user has privileges to generally access premium stuff if required)
  // Actually, typically checkAccess is used on a per-resource basis, but here we might want
  // a middleware that ensures the user is EITHER premium OR admin.

  if (req.isAuthenticated()) {
    if (req.user.role === 'admin' || req.user.isPremium) {
      return next();
    }
  }

  res.status(403).json({
    success: false,
    message: 'This content is for Premium members only.'
  });
};

// Make user available to all views
exports.setCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
};
