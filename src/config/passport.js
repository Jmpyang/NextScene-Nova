const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Facebook Strategy
passport.use(new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'emails', 'name', 'photos']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let user = await User.findOne({ socialId: profile.id, provider: 'facebook' });

      if (user) {
        return done(null, user);
      }

      // Check if email already exists (for linking accounts)
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          // Link Facebook account to existing user
          user.socialId = profile.id;
          user.provider = 'facebook';
          await user.save();
          return done(null, user);
        }
      }

      // Create new user
      user = await User.create({
        name: `${profile.name.givenName} ${profile.name.familyName}`,
        email: email || `${profile.id}@facebook.com`,
        socialId: profile.id,
        provider: 'facebook',
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : ''
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let user = await User.findOne({ socialId: profile.id, provider: 'google' });

      if (user) {
        return done(null, user);
      }

      // Check if email already exists (for linking accounts)
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          // Link Google account to existing user
          user.socialId = profile.id;
          user.provider = 'google';
          await user.save();
          return done(null, user);
        }
      }

      // Create new user
      user = await User.create({
        name: profile.displayName,
        email: email || `${profile.id}@google.com`,
        socialId: profile.id,
        provider: 'google',
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : ''
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

module.exports = passport;
