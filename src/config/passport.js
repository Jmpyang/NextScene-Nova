const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });
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
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password || '');

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
    profileFields: ['id', 'emails', 'name', 'photos'],
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log('Facebook OAuth profile received:', { 
        id: profile.id, 
        name: profile.displayName,
        email: profile.emails?.[0]?.value 
      });

      // Check if user exists
      let user = await prisma.user.findFirst({
        where: {
          AND: [
            { socialId: profile.id },
            { provider: 'facebook' }
          ]
        }
      });

      if (user) {
        console.log('Facebook user found:', user.email);
        return done(null, user);
      }

      // Check if email already exists (for linking accounts)
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });
        if (user) {
          // Link Facebook account to existing user
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              socialId: profile.id,
              provider: 'facebook'
            }
          });
          console.log('Facebook account linked to existing user:', user.email);
          return done(null, user);
        }
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          name: `${profile.name.givenName} ${profile.name.familyName}`,
          email: email || `${profile.id}@facebook.com`,
          socialId: profile.id,
          provider: 'facebook',
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          isVerified: true
        }
      });

      console.log('New Facebook user created:', user.email);
      done(null, user);
    } catch (error) {
      console.error('Facebook OAuth error:', error);
      done(error, null);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google OAuth profile received:', { 
        id: profile.id, 
        name: profile.displayName,
        email: profile.emails?.[0]?.value 
      });

      // Check if user exists
      let user = await prisma.user.findFirst({
        where: {
          AND: [
            { socialId: profile.id },
            { provider: 'google' }
          ]
        }
      });

      if (user) {
        console.log('Google user found:', user.email);
        return done(null, user);
      }

      // Check if email already exists (for linking accounts)
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });
        if (user) {
          // Link Google account to existing user
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              socialId: profile.id,
              provider: 'google'
            }
          });
          console.log('Google account linked to existing user:', user.email);
          return done(null, user);
        }
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          name: profile.displayName,
          email: email || `${profile.id}@google.com`,
          socialId: profile.id,
          provider: 'google',
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          isVerified: true
        }
      });

      console.log('New Google user created:', user.email);
      done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      done(error, null);
    }
  }
));

module.exports = passport;
