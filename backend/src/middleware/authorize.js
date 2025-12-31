const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Enforce read-only access for superadmin role: allow only GET requests
    // Support both `super_admin` and `superadmin` role naming variants
    const role = req.user && req.user.role;
    if (role && (role === 'super_admin' || role === 'superadmin') && req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        message: 'Superadmin has read-only access and cannot perform this operation'
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = authorize;
