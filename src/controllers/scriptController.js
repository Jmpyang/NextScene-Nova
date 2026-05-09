const ScriptService = require('../models/Script');
const UserService = require('../models/User');
const scriptRenderer = require('../services/scriptRenderer');
const { validationResult } = require('express-validator');

// List all published scripts
exports.getAllScripts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;

    const options = { 
      page, 
      limit, 
      status: 'published' 
    };

    // Filter out premium content if user is not premium AND not admin
    if (!req.user || (!UserService.isPremiumActive(req.user) && req.user.role !== 'admin')) {
      options.isPremiumOnly = false;
    }

    const result = await ScriptService.findAll(options);

    res.json({
      success: true,
      scripts: result.scripts,
      pagination: {
        currentPage: page,
        totalPages: result.pagination.pages,
        totalScripts: result.pagination.total
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
    const script = await ScriptService.findById(req.params.id);

    if (!script || script.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check premium access (Allow if user is premium OR admin)
    if (script.isPremiumOnly && (!req.user || (!UserService.isPremiumActive(req.user) && req.user.role !== 'admin'))) {
      return res.status(403).json({ success: false, message: 'Premium access required', requiresPremium: true });
    }

    // Increment views
    await ScriptService.incrementViews(script.id);

    // Determine file type from file URL or content
    let fileType = 'text';
    if (script.fileUrl) {
      if (script.fileUrl.includes('.pdf')) fileType = 'pdf';
      else if (script.fileUrl.includes('.md') || script.fileUrl.includes('markdown')) fileType = 'markdown';
      else if (script.fileUrl.includes('.txt')) fileType = 'txt';
    } else if (script.content) {
      // Detect file type from content
      if (scriptRenderer.isMarkdown(script.content)) {
        fileType = 'markdown';
      }
    }

    // Render script content based on requested format
    const format = req.query.format || 'html';
    const rendered = await scriptRenderer.renderScript(script, format);

    if (rendered.error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to render script content',
        error: rendered.error
      });
    }

    res.json({
      success: true,
      script: {
        ...script,
        renderedContent: rendered.content,
        renderFormat: rendered.format,
        fileType: rendered.fileType
      }
    });
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({ success: false, message: 'Error fetching script' });
  }
};

// Render script content in different formats
exports.renderScript = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'html' } = req.query;

    const script = await ScriptService.findById(id);

    if (!script || script.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check premium access
    if (script.isPremiumOnly && (!req.user || (!UserService.isPremiumActive(req.user) && req.user.role !== 'admin'))) {
      return res.status(403).json({ success: false, message: 'Premium access required' });
    }

    const rendered = await scriptRenderer.renderScript(script, format);

    if (rendered.error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to render script content',
        error: rendered.error
      });
    }

    res.json({
      success: true,
      content: rendered.content,
      format: rendered.format,
      fileType: rendered.fileType
    });
  } catch (error) {
    console.error('Error rendering script:', error);
    res.status(500).json({ success: false, message: 'Error rendering script' });
  }
};

// Handle create script
exports.postCreateScript = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Check if user is a WRITER (Admins bypass this)
  const isAuthorizedWriter = req.user.isWriter || req.user.role === 'admin';

  if (!isAuthorizedWriter) {
    return res.status(403).json({
      success: false,
      message: 'Readers cannot upload scripts. Please register as a Writer.'
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

    const script = await ScriptService.create({
      title,
      description: description || '',
      content: scriptContent || (isPDF ? 'PDF Content' : ''),
      fileUrl,
      authorId: req.user.id,
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
    const script = await ScriptService.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check if user is the author OR admin
    if (script.authorId !== req.user.id && req.user.role !== 'admin') {
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

    const updateData = {
      title,
      description: description || '',
      content,
      isPremiumOnly: isPremiumOnly === true || isPremiumOnly === 'on' || isPremiumOnly === 'true',
      status: status || script.status
    };

    // Update metadata if provided
    if (genre) updateData.genre = genre;
    if (pageCount) updateData.pageCount = pageCount;
    if (language) updateData.language = language;

    // Increment edit count (only for non-admins)
    if (req.user.role !== 'admin') {
      await ScriptService.incrementEditCount(script.id);
    }

    const updatedScript = await ScriptService.update(script.id, updateData);

    res.json({
      success: true,
      message: 'Script updated successfully',
      script: updatedScript,
      editsRemaining: 3 - updatedScript.editCount
    });
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ success: false, message: 'Error updating script' });
  }
};

// Delete script
exports.deleteScript = async (req, res) => {
  try {
    const script = await ScriptService.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check if user is the author OR admin
    if (script.authorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await ScriptService.delete(script.id);

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
    const script = await ScriptService.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Add or update rating using ScriptService
    const updatedScript = await ScriptService.addRating(script.id, req.user.id, rating, comment);

    res.json({
      success: true,
      message: 'Rating added successfully',
      averageRating: updatedScript.averageRating,
      totalRatings: updatedScript.totalRatings
    });
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ success: false, message: 'Error adding rating' });
  }
};

// Toggle like / reaction on script (Note: likes are now a counter, not an array)
exports.toggleLike = async (req, res) => {
  try {
    const script = await ScriptService.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Since likes are now a counter in Prisma schema, we need to implement
    // a separate tracking mechanism for user likes or just increment/decrement
    // For now, let's just increment the counter (simplified approach)
    const updatedScript = await ScriptService.incrementLikes(script.id);

    res.json({
      success: true,
      liked: true,
      likesCount: updatedScript.likes
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, message: 'Error toggling like' });
  }
};

// Add a comment to a script (Note: comments not in current Prisma schema)
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const script = await ScriptService.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Comments functionality would need to be implemented separately
    // as comments are not in the current Prisma schema
    res.status(501).json({ 
      success: false, 
      message: 'Comments functionality not implemented in current schema' 
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: 'Error adding comment' });
  }
};

// List comments for a script (Note: comments not in current Prisma schema)
exports.getComments = async (req, res) => {
  try {
    const script = await ScriptService.findById(req.params.id);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Comments functionality would need to be implemented separately
    // as comments are not in the current Prisma schema
    res.status(501).json({ 
      success: false, 
      message: 'Comments functionality not implemented in current schema' 
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, message: 'Error fetching comments' });
  }
};

// Download script as PDF
exports.downloadScriptPDF = async (req, res) => {
  try {
    const script = await ScriptService.findById(req.params.id);
    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Check premium access
    if (script.isPremiumOnly) {
      if (!UserService.isPremiumActive(req.user) && script.authorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Premium subscription required to download this script' });
      }
    }

    // If it's an uploaded PDF, we should probably redirect to the original file or stream it
    if (script.fileUrl && script.fileUrl.toLowerCase().endsWith('.pdf')) {
      return res.redirect(script.fileUrl);
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
