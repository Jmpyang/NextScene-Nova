// Detect and set language for the request
exports.detectLanguage = (req, res, next) => {
  // Priority: query parameter > session > cookie > accept-language header > default
  let language;

  // 1. Check query parameter (?lang=sw)
  if (req.query.lang) {
    language = req.query.lang;
    req.session.language = language;
  }
  // 2. Check session
  else if (req.session.language) {
    language = req.session.language;
  }
  // 3. Check cookie
  else if (req.cookies.language) {
    language = req.cookies.language;
  }
  // 4. Check Accept-Language header
  else if (req.headers['accept-language']) {
    const acceptedLanguages = req.headers['accept-language'].split(',');
    language = acceptedLanguages[0].split('-')[0];
  }
  // 5. Default language
  else {
    language = process.env.DEFAULT_LANGUAGE || 'en';
  }

  // Validate language (only allow configured languages)
  const supportedLanguages = ['en', 'sw'];
  if (!supportedLanguages.includes(language)) {
    language = 'en';
  }

  // Change i18next language
  req.i18n.changeLanguage(language);
  
  // Store in cookie for persistence
  res.cookie('language', language, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year

  // Make language available to views
  res.locals.currentLanguage = language;
  res.locals.languages = supportedLanguages;

  next();
};
