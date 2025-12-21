// Check if user has active premium subscription
exports.isPremium = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Login required'
    });
  }

  if (req.user.isPremiumActive()) {
    return next();
  }

  res.status(403).json({
    success: false,
    message: 'Premium subscription required',
    requiresPremium: true
  });
};

// Check premium status for conditional content
exports.checkPremium = (req, res, next) => {
  res.locals.isPremium = req.isAuthenticated() && req.user.isPremiumActive();
  next();
};
