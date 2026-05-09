const { marked } = require('marked');
const DOMPurify = require('isomorphic-dompurify');
const fs = require('fs').promises;
const path = require('path');

class ScriptRenderer {
  constructor() {
    // Configure marked for safe markdown rendering
    marked.setOptions({
      highlight: function(code, lang) {
        // Basic syntax highlighting support
        return `<pre><code class="language-${lang || 'text'}">${this.escape(code)}</code></pre>`;
      },
      breaks: true,
      gfm: true,
      sanitize: false // We'll use DOMPurify for sanitization
    });
  }

  async renderScript(script, format = 'html') {
    try {
      const { content, fileUrl, fileType } = script;
      
      let rawContent = content;
      
      // If content is empty and we have a file URL, fetch the file content
      if (!rawContent && fileUrl) {
        rawContent = await this.fetchFileContent(fileUrl, fileType);
      }

      if (!rawContent) {
        return { error: 'No content available for rendering' };
      }

      switch (format) {
        case 'html':
          return this.renderToHTML(rawContent, fileType);
        case 'text':
          return this.renderToText(rawContent, fileType);
        case 'markdown':
          return this.renderToMarkdown(rawContent, fileType);
        case 'pdf':
          return this.renderToPDF(rawContent, fileType);
        default:
          return this.renderToHTML(rawContent, fileType);
      }
    } catch (error) {
      console.error('Script rendering error:', error);
      return { error: 'Failed to render script content' };
    }
  }

  async fetchFileContent(fileUrl, fileType) {
    try {
      // For Cloudinary files, we might need to download them
      if (fileUrl.includes('cloudinary')) {
        // For PDFs, we can't easily extract text without additional libraries
        // For now, return a placeholder
        if (fileType === 'pdf') {
          return '[PDF Content - Download to view full content]';
        }
        
        // For text and markdown files, we can try to fetch
        const response = await fetch(fileUrl);
        if (response.ok) {
          return await response.text();
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching file content:', error);
      return null;
    }
  }

  renderToHTML(content, fileType) {
    try {
      let htmlContent = '';

      switch (fileType) {
        case 'md':
        case 'markdown':
          // Render markdown to HTML
          htmlContent = marked(content);
          break;
        
        case 'txt':
        case 'text':
          // Render plain text with basic formatting
          htmlContent = this.renderPlainTextToHTML(content);
          break;
        
        case 'pdf':
          // PDF files need special handling
          htmlContent = this.renderPDFToHTML(content);
          break;
        
        default:
          // Try to detect if content looks like markdown
          if (this.isMarkdown(content)) {
            htmlContent = marked(content);
          } else {
            htmlContent = this.renderPlainTextToHTML(content);
          }
      }

      // Sanitize HTML to prevent XSS
      const sanitizedHTML = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 'i', 'b',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
          'a', 'img', 'div', 'span'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'title'],
        ALLOW_DATA_ATTR: false
      });

      return {
        success: true,
        content: sanitizedHTML,
        format: 'html',
        fileType
      };
    } catch (error) {
      console.error('HTML rendering error:', error);
      return { error: 'Failed to render content to HTML' };
    }
  }

  renderToText(content, fileType) {
    try {
      let textContent = content;

      if (fileType === 'md' || fileType === 'markdown') {
        // Convert markdown to plain text
        textContent = this.markdownToText(content);
      }

      return {
        success: true,
        content: textContent,
        format: 'text',
        fileType
      };
    } catch (error) {
      console.error('Text rendering error:', error);
      return { error: 'Failed to render content to text' };
    }
  }

  renderToMarkdown(content, fileType) {
    try {
      let markdownContent = content;

      if (fileType === 'txt' || fileType === 'text') {
        // Convert plain text to markdown
        markdownContent = this.textToMarkdown(content);
      }

      return {
        success: true,
        content: markdownContent,
        format: 'markdown',
        fileType
      };
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return { error: 'Failed to render content to markdown' };
    }
  }

  renderToPDF(content, fileType) {
    try {
      // For PDF rendering, we'd need a library like PDFKit or puppeteer
      // For now, return a placeholder
      return {
        success: true,
        content: '[PDF rendering would require additional PDF generation library]',
        format: 'pdf',
        fileType,
        downloadUrl: 'PDF download functionality not implemented yet'
      };
    } catch (error) {
      console.error('PDF rendering error:', error);
      return { error: 'Failed to render content to PDF' };
    }
  }

  renderPlainTextToHTML(content) {
    // Escape HTML entities
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Convert line breaks to <br> and paragraphs
    const paragraphs = escaped.split('\n\n');
    const html = paragraphs
      .map(paragraph => {
        // Handle single line breaks within paragraphs
        const lines = paragraph.split('\n');
        return `<p>${lines.join('<br>')}</p>`;
      })
      .join('');

    return html;
  }

  renderPDFToHTML(content) {
    // For PDF content, we'll show a download link and preview
    return `
      <div class="pdf-viewer">
        <div class="pdf-info">
          <h3>PDF Document</h3>
          <p>This is a PDF file. Click the download button to view the full content.</p>
          <button class="download-btn" onclick="window.open('${content}', '_blank')">
            Download PDF
          </button>
        </div>
        <div class="pdf-preview">
          <p>${content}</p>
        </div>
      </div>
    `;
  }

  isMarkdown(content) {
    // Simple heuristic to detect markdown
    const markdownIndicators = [
      /^#{1,6}\s/m,           // Headers
      /^\*\s.*$/m,             // Unordered lists
      /^\d+\.\s.*$/m,          // Ordered lists
      /\*\*.*?\*\*/,           // Bold text
      /\*.*?\*/,               // Italic text
      /\[.*?\]\(.*?\)/,        // Links
      /```[\s\S]*?```/,        // Code blocks
      /^>.*$/m                 // Blockquotes
    ];

    return markdownIndicators.some(pattern => pattern.test(content));
  }

  markdownToText(content) {
    // Basic markdown to text conversion
    return content
      .replace(/^#{1,6}\s/gm, '')           // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1')       // Remove bold
      .replace(/\*(.*?)\*/g, '$1')           // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/```[\s\S]*?```/g, '[Code Block]') // Replace code blocks
      .replace(/^>.*$/gm, '')               // Remove blockquotes
      .replace(/^\*\s/gm, '• ')             // Convert list items
      .replace(/^\d+\.\s/gm, '• ')         // Convert numbered lists
      .replace(/\n{3,}/g, '\n\n');          // Normalize line breaks
  }

  textToMarkdown(content) {
    // Basic text to markdown conversion
    return content
      .replace(/\n\n/g, '\n\n')             // Ensure paragraph breaks
      .replace(/^(\s*)[-*+]\s/gm, '$1• ')   // Convert bullet points
      .replace(/^(\s*)\d+\.\s/gm, '$1• ')  // Convert numbered lists
      .replace(/([A-Z][^.!?]*[.!?])/g, '**$1**'); // Bold sentences (basic)
  }

  // Method to get supported formats
  getSupportedFormats() {
    return {
      input: ['txt', 'text', 'md', 'markdown', 'pdf'],
      output: ['html', 'text', 'markdown', 'pdf']
    };
  }

  // Method to validate file type
  isValidFileType(fileType) {
    return this.getSupportedFormats().input.includes(fileType.toLowerCase());
  }

  // Method to get file icon based on type
  getFileIcon(fileType) {
    const icons = {
      'txt': '📄',
      'text': '📄',
      'md': '📝',
      'markdown': '📝',
      'pdf': '📋'
    };
    return icons[fileType.toLowerCase()] || '📄';
  }
}

module.exports = new ScriptRenderer();
