const { prisma } = require('../lib/prisma');
const { AppError, NotFoundError, AuthorizationError } = require('../utils/errorHandler');

class ScriptService {
  // Find script by ID
  static async findById(id, includeAuthor = true) {
    try {
      const script = await prisma.script.findUnique({
        where: { id },
        include: {
          author: includeAuthor ? {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              isWriter: true,
              isVerified: true
            }
          } : false,
          ratings: {
            select: {
              id: true,
              rating: true,
              comment: true,
              userId: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              ratings: true,
              comments: true
            }
          }
        }
      });

      if (!script) {
        throw new NotFoundError('Script');
      }

      return script;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to find script', 500, 'FIND_SCRIPT_ERROR');
    }
  }

  // Find scripts by author
  static async findByAuthor(authorId, options = {}) {
    try {
      const { page = 1, limit = 10, status = 'published' } = options;
      const skip = (page - 1) * limit;

      const where = {
        authorId,
        status: status === 'all' ? undefined : status
      };

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
                avatar: true
              }
            },
            _count: {
              select: {
                ratings: true,
                comments: true
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
    } catch (error) {
      throw new AppError('Failed to find scripts by author', 500, 'FIND_AUTHOR_SCRIPTS_ERROR');
    }
  }

  // Find all scripts with filters
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        authorId,
        genre,
        isPremiumOnly,
        status = 'published',
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      const skip = (page - 1) * limit;

      const where = {};
      if (authorId) where.authorId = authorId;
      if (genre) where.genre = genre;
      if (isPremiumOnly !== undefined) where.isPremiumOnly = isPremiumOnly;
      if (status && status !== 'all') where.status = status;
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } }
        ];
      }

      const orderBy = {};
      orderBy[sortBy] = sortOrder;

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
                isWriter: true,
                isVerified: true
              }
            },
            _count: {
              select: {
                ratings: true,
                comments: true
              }
            }
          },
          orderBy
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
    } catch (error) {
      throw new AppError('Failed to find scripts', 500, 'FIND_SCRIPTS_ERROR');
    }
  }

  // Create new script
  static async create(scriptData, authorId) {
    try {
      const script = await prisma.script.create({
        data: {
          ...scriptData,
          authorId,
          views: 0,
          likes: 0,
          averageRating: 0,
          totalRatings: 0,
          editCount: 0
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          }
        }
      });

      return script;
    } catch (error) {
      throw new AppError('Failed to create script', 500, 'CREATE_SCRIPT_ERROR');
    }
  }

  // Update script
  static async update(id, updateData, userId, userRole) {
    try {
      // Check if user owns the script or is admin
      const existingScript = await prisma.script.findUnique({
        where: { id },
        select: { authorId: true, editCount: true }
      });

      if (!existingScript) {
        throw new NotFoundError('Script');
      }

      if (existingScript.authorId !== userId && userRole !== 'admin') {
        throw new AuthorizationError('You can only edit your own scripts');
      }

      // Increment edit count
      const data = {
        ...updateData,
        editCount: existingScript.editCount + 1
      };

      const script = await prisma.script.update({
        where: { id },
        data,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          }
        }
      });

      return script;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update script', 500, 'UPDATE_SCRIPT_ERROR');
    }
  }

  // Delete script
  static async delete(id, userId, userRole) {
    try {
      // Check if user owns the script or is admin
      const existingScript = await prisma.script.findUnique({
        where: { id },
        select: { authorId: true }
      });

      if (!existingScript) {
        throw new NotFoundError('Script');
      }

      if (existingScript.authorId !== userId && userRole !== 'admin') {
        throw new AuthorizationError('You can only delete your own scripts');
      }

      await prisma.script.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete script', 500, 'DELETE_SCRIPT_ERROR');
    }
  }

  // Increment views
  static async incrementViews(id) {
    try {
      await prisma.script.update({
        where: { id },
        data: {
          views: {
            increment: 1
          }
        }
      });

      return true;
    } catch (error) {
      // Don't throw error for view increment failure
      console.error('Failed to increment views:', error);
      return false;
    }
  }

  // Like/unlike script
  static async toggleLike(scriptId, userId) {
    try {
      // Check if script exists
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { id: true, likes: true }
      });

      if (!script) {
        throw new NotFoundError('Script');
      }

      // This would need a likes table in the schema for proper implementation
      // For now, just increment/decrement likes count
      const updatedScript = await prisma.script.update({
        where: { id: scriptId },
        data: {
          likes: {
            increment: 1
          }
        }
      });

      return { liked: true, likes: updatedScript.likes };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to toggle like', 500, 'TOGGLE_LIKE_ERROR');
    }
  }

  // Add rating to script
  static async addRating(scriptId, userId, rating, comment) {
    try {
      // Check if script exists
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { id: true }
      });

      if (!script) {
        throw new NotFoundError('Script');
      }

      // Check if user already rated this script
      const existingRating = await prisma.rating.findUnique({
        where: {
          userId_scriptId: {
            userId,
            scriptId
          }
        }
      });

      let newRating;
      if (existingRating) {
        // Update existing rating
        newRating = await prisma.rating.update({
          where: { id: existingRating.id },
          data: {
            rating,
            comment
          }
        });
      } else {
        // Create new rating
        newRating = await prisma.rating.create({
          data: {
            userId,
            scriptId,
            rating,
            comment
          }
        });
      }

      // Update script's average rating
      await this.updateAverageRating(scriptId);

      return newRating;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to add rating', 500, 'ADD_RATING_ERROR');
    }
  }

  // Update script's average rating
  static async updateAverageRating(scriptId) {
    try {
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

      return true;
    } catch (error) {
      console.error('Failed to update average rating:', error);
      return false;
    }
  }

  // Get script ratings
  static async getRatings(scriptId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const skip = (page - 1) * limit;

      const [ratings, total] = await Promise.all([
        prisma.rating.findMany({
          where: { scriptId },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.rating.count({ where: { scriptId } })
      ]);

      return {
        ratings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new AppError('Failed to get ratings', 500, 'GET_RATINGS_ERROR');
    }
  }

  // Search scripts
  static async searchScripts(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        genre,
        isPremiumOnly,
        sortBy = 'relevance'
      } = options;
      
      const skip = (page - 1) * limit;

      const where = {
        AND: [
          { status: 'published' },
          query ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } }
            ]
          } : {},
          genre ? { genre } : {},
          isPremiumOnly !== undefined ? { isPremiumOnly } : {}
        ].filter(condition => Object.keys(condition).length > 1 || Object.values(condition)[0] !== false)
      };

      let orderBy;
      switch (sortBy) {
        case 'views':
          orderBy = { views: 'desc' };
          break;
        case 'likes':
          orderBy = { likes: 'desc' };
          break;
        case 'rating':
          orderBy = { averageRating: 'desc' };
          break;
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        default:
          orderBy = { createdAt: 'desc' };
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
                isWriter: true,
                isVerified: true
              }
            },
            _count: {
              select: {
                ratings: true,
                comments: true
              }
            }
          },
          orderBy
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
    } catch (error) {
      throw new AppError('Failed to search scripts', 500, 'SEARCH_SCRIPTS_ERROR');
    }
  }

  // Get popular scripts
  static async getPopularScripts(options = {}) {
    try {
      const { limit = 10, timeRange = 'all' } = options;
      
      let dateFilter;
      if (timeRange === 'week') {
        dateFilter = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      } else if (timeRange === 'month') {
        dateFilter = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      }

      const scripts = await prisma.script.findMany({
        where: {
          status: 'published',
          ...(dateFilter && { createdAt: dateFilter })
        },
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          },
          _count: {
            select: {
              ratings: true,
              comments: true
            }
          }
        },
        orderBy: [
          { views: 'desc' },
          { likes: 'desc' },
          { averageRating: 'desc' }
        ]
      });

      return scripts;
    } catch (error) {
      throw new AppError('Failed to get popular scripts', 500, 'GET_POPULAR_SCRIPTS_ERROR');
    }
  }
}

module.exports = ScriptService;
