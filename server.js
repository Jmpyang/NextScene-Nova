require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const path = require('path');
const connectDB = require('./src/config/db');

// Route imports
const indexRoutes = require('./src/routes/index');
const authRoutes = require('./src/routes/auth');
const scriptRoutes = require('./src/routes/scripts');
const userRoutes = require('./src/routes/user');
const premiumRoutes = require('./src/routes/premium');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Passport Config
require('./src/config/passport');

app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Static Folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/user', userRoutes);
app.use('/api/premium', premiumRoutes);

// SPA Fallback - Serve index.html for any unknown routes (for client-side routing)
// Note: This must come AFTER API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Local Server: http://localhost:${PORT}`);
  });
}

module.exports = app;