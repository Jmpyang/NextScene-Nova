const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// Home page API
router.get('/posts', async (req, res) => {
  try {
    const recentPosts = await Post.find({ status: 'published' })
      .populate('author', 'name avatar')
      .sort({ publishedAt: -1 })
      .limit(3);

    res.json({
      success: true,
      posts: recentPosts
    });
  } catch (error) {
    console.error('Error loading posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading posts'
    });
  }
});

// Handle contact form submission
router.post('/contact', (req, res) => {
  // In production, implement email sending or database storage
  const { name, email, message } = req.body;

  // For now, just return success
  res.json({
    success: true,
    message: 'Message sent successfully'
  });
});

// Tawk.to configuration endpoint
router.get('/config/tawk', (req, res) => {
  const propertyId = process.env.TAWK_PROPERTY_ID;
  const widgetId = process.env.TAWK_WIDGET_ID;
  
  res.json({
    enabled: !!(propertyId && widgetId && propertyId !== 'PROPERTY_ID' && widgetId !== 'WIDGET_ID'),
    propertyId: propertyId || null,
    widgetId: widgetId || null
  });
});

module.exports = router;
