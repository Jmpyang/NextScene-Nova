const Script = require('../models/Script');
const { validationResult } = require('express-validator');

// List all published scripts
exports.getAllScripts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const query = { status: 'published' };

    // Filter out premium content if user is not premium AND not admin
    if (!req.user || (!req.user.isPremiumActive() && req.user.role !== 'admin')) {
      query.isPremiumOnly = false;
    }

    const scripts = await Script.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const totalScripts = await Script.countDocuments(query);
    const totalPages = Math.ceil(totalScripts / limit);

    res.json({
      success: true,
      scripts,
      pagination: {
        currentPage: page,
        totalPages,
        totalScripts
      }
    });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ success: false, message: 'Error fetching scripts' });
  }
};

// Show single script
exports.getScript = async (req, res) => {
  try {
    const script = await Script.findById(req.params.id)
      .populate('author', 'name avatar bio')
      .populate('ratings.user', 'name avatar');

    if (!script || script.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check premium access (Allow if user is premium OR admin)
    if (script.isPremiumOnly && (!req.user || (!req.user.isPremiumActive() && req.user.role !== 'admin'))) {
      return res.status(403).json({ success: false, message: 'Premium access required', requiresPremium: true });
    }

    // Increment views
    script.views += 1;
    await script.save();

    res.json({
      success: true,
      script
    });
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({ success: false, message: 'Error fetching script' });
  }
};

// Handle create script
exports.postCreateScript = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Check if user is a verified WRITER (Admins bypass this)
  const isAuthorizedWriter = (req.user.isWriter && req.user.isVerified) || req.user.role === 'admin';

  if (!isAuthorizedWriter) {
    const errorMsg = !req.user.isWriter ? 'Readers cannot upload scripts. Please register as a Writer.' : 'Account not verified. You must be verified by an admin to upload scripts.';
    return res.status(403).json({
      success: false,
      message: errorMsg
    });
  }

  try {
    const { title, description, content, isPremiumOnly, status, genre, pageCount, language } = req.body;
    const axios = require('axios');

    let scriptContent = content;
    let fileUrl = '';

    // If a file was uploaded (to Cloudinary)
    if (req.file) {
      fileUrl = req.file.path;

      // If it's a text-based file, fetch its content for the preview
      const isTextFile = req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/markdown';
      if (isTextFile) {
        try {
          const response = await axios.get(fileUrl);
          scriptContent = response.data;
        } catch (err) {
          console.error('Error fetching file content from Cloudinary:', err);
          // Fallback to what was provided in the text area or a placeholder
        }
      }
    }

    // Validate that we have content from either field or file (unless it's a PDF which we can't easily read)
    const isPDF = req.file && req.file.mimetype === 'application/pdf';
    if (!isPDF && (!scriptContent || scriptContent.trim() === '')) {
      return res.status(400).json({ success: false, message: 'Script content is required (either via text input or file upload)' });
    }

    const script = await Script.create({
      title,
      description,
      content: scriptContent || (isPDF ? 'PDF File Uploaded (Reading Not Supported. Please Download)' : ''),
      fileUrl,
      author: req.user._id,
      genre: genre || 'Other',
      pageCount: parseInt(pageCount) || 0,
      language: language || 'English',
      isPremiumOnly: isPremiumOnly === true || isPremiumOnly === 'on' || isPremiumOnly === 'true',
      status: status || 'published'
    });

    res.json({
      success: true,
      message: 'Script created successfully',
      script
    });
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({ success: false, message: 'Error creating script' });
  }
};

// Handle update script
exports.postUpdateScript = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const script = await Script.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check if user is the author OR admin
    if (script.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Check edit limit (3 edits maximum) - admins bypass this
    if (req.user.role !== 'admin' && script.editCount >= 3) {
      return res.status(403).json({
        success: false,
        message: 'Edit limit reached. You can only edit a script 3 times.'
      });
    }

    const { title, description, content, isPremiumOnly, status, genre, pageCount, language } = req.body;

    script.title = title;
    script.description = description;
    script.content = content;
    script.isPremiumOnly = isPremiumOnly === true || isPremiumOnly === 'on' || isPremiumOnly === 'true';
    script.status = status || script.status;

    // Update metadata if provided
    if (genre) script.genre = genre;
    if (pageCount) script.pageCount = pageCount;
    if (language) script.language = language;

    // Increment edit count (only for non-admins)
    if (req.user.role !== 'admin') {
      script.editCount += 1;
    }

    await script.save();

    res.json({
      success: true,
      message: 'Script updated successfully',
      script,
      editsRemaining: 3 - script.editCount
    });
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ success: false, message: 'Error updating script' });
  }
};

// Delete script
exports.deleteScript = async (req, res) => {
  try {
    const script = await Script.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check if user is the author OR admin
    if (script.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await script.deleteOne();

    res.json({ success: true, message: 'Script deleted successfully' });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ success: false, message: 'Error deleting script' });
  }
};

// Add rating to script
exports.addRating = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const script = await Script.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check if user already rated
    const existingRating = script.ratings.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
    } else {
      script.ratings.push({
        user: req.user._id,
        rating,
        comment
      });
    }

    script.calculateAverageRating();
    await script.save();

    res.json({
      success: true,
      message: 'Rating added successfully',
      averageRating: script.averageRating,
      totalRatings: script.totalRatings
    });
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ success: false, message: 'Error adding rating' });
  }
};

// Download script as PDF
exports.downloadScriptPDF = async (req, res) => {
  try {
    const script = await Script.findById(req.params.id).populate('author', 'name');
    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check premium access
    if (script.isPremiumOnly) {
      const User = require('../models/User');
      const user = await User.findById(req.user._id);
      if (!user.isPremiumActive() && script.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Premium subscription required to download this script' });
      }
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Set filename
    const filename = `${script.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Title Page
    doc.fontSize(25).text(script.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(15).text(`By ${script.author ? script.author.name : 'Unknown'}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text(script.description || '', { align: 'left', lineGap: 5 });

    doc.addPage();

    // Script Content
    doc.font('Courier').fontSize(12).text(script.content, {
      lineGap: 10,
      paragraphGap: 15
    });

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, message: 'Error generating PDF' });
  }
};
