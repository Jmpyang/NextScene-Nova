const { prisma } = require('../config/db');

class ScriptService {
  // Create a new script
  static async create(scriptData) {
    const { ratings, ...data } = scriptData;
    
    return await prisma.script.create({
      data: {
        ...data,
        averageRating: 0,
        totalRatings: 0,
        views: 0,
        likes: 0,
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

  // Find script by ID
  static async findById(id) {
    return await prisma.script.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        },
        ratings: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  // Update script
  static async update(id, updateData) {
    return await prisma.script.update({
      where: { id },
      data: updateData,
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

  // Delete script
  static async delete(id) {
    return await prisma.script.delete({
      where: { id }
    });
  }

  // Find all scripts (with pagination and filters)
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      authorId, 
      genre, 
      isPremiumOnly, 
      status = 'published',
      search 
    } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (authorId) where.authorId = authorId;
    if (genre) where.genre = genre;
    if (isPremiumOnly !== undefined) where.isPremiumOnly = isPremiumOnly;
    if (status) where.status = status;
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [scripts, total] = await Promise.all([
      prisma.script.findMany({
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
        orderBy: { createdAt: 'desc' }
      }),
      prisma.script.count({ where })
    ]);

    return {
      scripts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find scripts by author
  static async findByAuthor(authorId, options = {}) {
    const { page = 1, limit = 10, status = 'published' } = options;
    const skip = (page - 1) * limit;

    const where = { authorId };
    if (status) where.status = status;

    const [scripts, total] = await Promise.all([
      prisma.script.findMany({
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
        orderBy: { createdAt: 'desc' }
      }),
      prisma.script.count({ where })
    ]);

    return {
      scripts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Add or update rating
  static async addRating(scriptId, userId, rating, comment) {
    // Check if user already rated this script
    const existingRating = await prisma.rating.findUnique({
      where: {
        userId_scriptId: {
          userId,
          scriptId
        }
      }
    });

    if (existingRating) {
      // Update existing rating
      await prisma.rating.update({
        where: { id: existingRating.id },
        data: { rating, comment }
      });
    } else {
      // Create new rating
      await prisma.rating.create({
        data: {
          userId,
          scriptId,
          rating,
          comment
        }
      });
    }

    // Recalculate average rating
    await this.calculateAverageRating(scriptId);

    return await this.findById(scriptId);
  }

  // Remove rating
  static async removeRating(scriptId, userId) {
    const rating = await prisma.rating.findUnique({
      where: {
        userId_scriptId: {
          userId,
          scriptId
        }
      }
    });

    if (rating) {
      await prisma.rating.delete({
        where: { id: rating.id }
      });
      
      // Recalculate average rating
      await this.calculateAverageRating(scriptId);
    }

    return await this.findById(scriptId);
  }

  // Calculate average rating
  static async calculateAverageRating(scriptId) {
    const ratings = await prisma.rating.findMany({
      where: { scriptId },
      select: { rating: true }
    });

    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings 
      : 0;

    await prisma.script.update({
      where: { id: scriptId },
      data: {
        averageRating,
        totalRatings
      }
    });
  }

  // Increment views
  static async incrementViews(scriptId) {
    return await prisma.script.update({
      where: { id: scriptId },
      data: {
        views: {
          increment: 1
        }
      }
    });
  }

  // Increment likes
  static async incrementLikes(scriptId) {
    return await prisma.script.update({
      where: { id: scriptId },
      data: {
        likes: {
          increment: 1
        }
      }
    });
  }

  // Decrement likes
  static async decrementLikes(scriptId) {
    return await prisma.script.update({
      where: { id: scriptId },
      data: {
        likes: {
          decrement: 1
        }
      }
    });
  }

  // Increment edit count (max 3)
  static async incrementEditCount(scriptId) {
    const script = await prisma.script.findUnique({
      where: { id: scriptId },
      select: { editCount: true }
    });

    if (script.editCount >= 3) {
      throw new Error('Maximum edit limit reached (3 edits)');
    }

    return await prisma.script.update({
      where: { id: scriptId },
      data: {
        editCount: {
          increment: 1
        }
      }
    });
  }

  // Get popular scripts
  static async getPopularScripts(options = {}) {
    const { limit = 10, genre, isPremiumOnly } = options;
    
    const where = { status: 'published' };
    if (genre) where.genre = genre;
    if (isPremiumOnly !== undefined) where.isPremiumOnly = isPremiumOnly;

    return await prisma.script.findMany({
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
        { views: 'desc' },
        { averageRating: 'desc' },
        { likes: 'desc' }
      ]
    });
  }

  // Get scripts by genre
  static async getByGenre(genre, options = {}) {
    const { page = 1, limit = 10, isPremiumOnly } = options;
    const skip = (page - 1) * limit;

    const where = { 
      genre, 
      status: 'published'
    };
    if (isPremiumOnly !== undefined) where.isPremiumOnly = isPremiumOnly;

    const [scripts, total] = await Promise.all([
      prisma.script.findMany({
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
        orderBy: { createdAt: 'desc' }
      }),
      prisma.script.count({ where })
    ]);

    return {
      scripts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = ScriptService;
