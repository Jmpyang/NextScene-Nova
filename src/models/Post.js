const { prisma } = require('../config/db');

class PostService {
  // Generate slug from title
  static generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Create a new post
  static async create(postData) {
    const data = { ...postData };
    
    // Generate slug if not provided
    if (!data.slug) {
      data.slug = this.generateSlug(data.title);
    }

    // Set publishedAt if status is published and not already set
    if (data.status === 'published' && !data.publishedAt) {
      data.publishedAt = new Date();
    }

    return await prisma.post.create({
      data: {
        ...data,
        views: 0,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      }
    });
  }

  // Find post by ID
  static async findById(id) {
    return await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      }
    });
  }

  // Find post by slug
  static async findBySlug(slug) {
    return await prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      }
    });
  }

  // Update post
  static async update(id, updateData) {
    const data = { ...updateData };
    
    // Generate slug if title is updated and slug is not provided
    if (data.title && !data.slug) {
      data.slug = this.generateSlug(data.title);
    }

    // Set publishedAt if status is being changed to published
    if (data.status === 'published') {
      const existingPost = await prisma.post.findUnique({
        where: { id },
        select: { publishedAt: true }
      });
      
      if (!existingPost.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    return await prisma.post.update({
      where: { id },
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      }
    });
  }

  // Delete post
  static async delete(id) {
    return await prisma.post.delete({
      where: { id }
    });
  }

  // Find all posts (with pagination and filters)
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      authorId, 
      category, 
      status = 'published',
      search,
      tags 
    } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (authorId) where.authorId = authorId;
    if (category) where.category = category;
    if (status) where.status = status;
    
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.post.count({ where })
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find posts by author
  static async findByAuthor(authorId, options = {}) {
    const { page = 1, limit = 10, status = 'published' } = options;
    const skip = (page - 1) * limit;

    const where = { authorId };
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.post.count({ where })
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find posts by category
  static async findByCategory(category, options = {}) {
    const { page = 1, limit = 10, status = 'published' } = options;
    const skip = (page - 1) * limit;

    const where = { 
      category, 
      status 
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.post.count({ where })
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find posts by tags
  static async findByTags(tags, options = {}) {
    const { page = 1, limit = 10, status = 'published' } = options;
    const skip = (page - 1) * limit;

    const where = { 
      status,
      tags: {
        hasSome: Array.isArray(tags) ? tags : [tags]
      }
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.post.count({ where })
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get recent posts
  static async getRecentPosts(options = {}) {
    const { limit = 5, category, authorId } = options;
    
    const where = { status: 'published' };
    if (category) where.category = category;
    if (authorId) where.authorId = authorId;

    return await prisma.post.findMany({
      where,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      },
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  // Get popular posts (by views)
  static async getPopularPosts(options = {}) {
    const { limit = 10, category, authorId } = options;
    
    const where = { status: 'published' };
    if (category) where.category = category;
    if (authorId) where.authorId = authorId;

    return await prisma.post.findMany({
      where,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      },
      orderBy: { views: 'desc' }
    });
  }

  // Increment views
  static async incrementViews(id) {
    return await prisma.post.update({
      where: { id },
      data: {
        views: {
          increment: 1
        }
      }
    });
  }

  // Search posts
  static async search(query, options = {}) {
    const { page = 1, limit = 10, category, authorId } = options;
    const skip = (page - 1) * limit;

    const where = {
      status: 'published',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      ]
    };

    if (category) where.category = category;
    if (authorId) where.authorId = authorId;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.post.count({ where })
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Check if slug is unique
  static async isSlugUnique(slug, excludeId = null) {
    const where = { slug };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existingPost = await prisma.post.findUnique({
      where: { slug },
      select: { id: true }
    });

    return !existingPost;
  }

  // Get unique slug
  static async getUniqueSlug(title, excludeId = null) {
    let slug = this.generateSlug(title);
    let counter = 1;
    let isUnique = await this.isSlugUnique(slug, excludeId);

    while (!isUnique) {
      slug = `${this.generateSlug(title)}-${counter}`;
      isUnique = await this.isSlugUnique(slug, excludeId);
      counter++;
    }

    return slug;
  }
}

module.exports = PostService;
