const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { AppError, NotFoundError, ConflictError } = require('../utils/errorHandler');

class UserService {
  // Find user by ID
  static async findById(id) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          bio: true,
          phoneNumber: true,
          isVerified: true,
          isWriter: true,
          isPremium: true,
          premiumExpiresAt: true,
          coins: true,
          totalCoinsEarned: true,
          website: true,
          twitter: true,
          linkedin: true,
          isActive: true,
          isBanned: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        throw new NotFoundError('User');
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to find user', 500, 'FIND_USER_ERROR');
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          password: true,
          avatar: true,
          bio: true,
          phoneNumber: true,
          isVerified: true,
          isWriter: true,
          isPremium: true,
          premiumExpiresAt: true,
          coins: true,
          isActive: true,
          isBanned: true,
          socialId: true,
          provider: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return user;
    } catch (error) {
      throw new AppError('Failed to find user by email', 500, 'FIND_USER_EMAIL_ERROR');
    }
  }

  // Create new user
  static async create(userData) {
    try {
      const { password, ...data } = userData;
      
      // Hash password
      let hashedPassword;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 12);
      }

      const user = await prisma.user.create({
        data: {
          ...data,
          email: data.email.toLowerCase(),
          password: hashedPassword,
          isActive: true,
          isBanned: false
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          bio: true,
          phoneNumber: true,
          isVerified: true,
          isWriter: true,
          isPremium: true,
          premiumExpiresAt: true,
          coins: true,
          website: true,
          twitter: true,
          linkedin: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictError('Email already exists');
      }
      throw new AppError('Failed to create user', 500, 'CREATE_USER_ERROR');
    }
  }

  // Update user
  static async update(id, updateData) {
    try {
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 12);
      }

      // Normalize email if provided
      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase();
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          bio: true,
          phoneNumber: true,
          isVerified: true,
          isWriter: true,
          isPremium: true,
          premiumExpiresAt: true,
          coins: true,
          website: true,
          twitter: true,
          linkedin: true,
          isActive: true,
          isBanned: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundError('User');
      }
      throw new AppError('Failed to update user', 500, 'UPDATE_USER_ERROR');
    }
  }

  // Delete user (soft delete by deactivating)
  static async delete(id) {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: 'Account deleted'
        }
      });

      return true;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundError('User');
      }
      throw new AppError('Failed to delete user', 500, 'DELETE_USER_ERROR');
    }
  }

  // Update premium status
  static async updatePremium(userId, plan) {
    try {
      const expiresAt = new Date();
      if (plan === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (plan === 'annual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        throw new AppError('Invalid plan specified', 400, 'INVALID_PLAN');
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
          premiumExpiresAt: expiresAt
        }
      });

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update premium status', 500, 'UPDATE_PREMIUM_ERROR');
    }
  }

  // Check if user has active premium
  static isPremiumActive(user) {
    if (!user.isPremium) return false;
    if (!user.premiumExpiresAt) return false;
    return new Date() < new Date(user.premiumExpiresAt);
  }

  // Update login tracking
  static async updateLoginTracking(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          loginCount: {
            increment: 1
          }
        }
      });

      return true;
    } catch (error) {
      throw new AppError('Failed to update login tracking', 500, 'UPDATE_LOGIN_ERROR');
    }
  }

  // Ban user
  static async banUser(userId, reason, bannedBy) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: reason
        }
      });

      return true;
    } catch (error) {
      throw new AppError('Failed to ban user', 500, 'BAN_USER_ERROR');
    }
  }

  // Unban user
  static async unbanUser(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedReason: null
        }
      });

      return true;
    } catch (error) {
      throw new AppError('Failed to unban user', 500, 'UNBAN_USER_ERROR');
    }
  }

  // Get user statistics
  static async getUserStatistics(userId) {
    try {
      const [
        scriptCount,
        totalViews,
        totalLikes,
        totalRatings,
        avgRating
      ] = await Promise.all([
        prisma.script.count({ where: { authorId: userId } }),
        prisma.script.aggregate({
          where: { authorId: userId },
          _sum: { views: true }
        }),
        prisma.script.aggregate({
          where: { authorId: userId },
          _sum: { likes: true }
        }),
        prisma.rating.count({ where: { script: { authorId: userId } } }),
        prisma.rating.aggregate({
          where: { script: { authorId: userId } },
          _avg: { rating: true }
        })
      ]);

      return {
        scriptCount,
        totalViews: totalViews._sum.views || 0,
        totalLikes: totalLikes._sum.likes || 0,
        totalRatings,
        averageRating: avgRating._avg.rating || 0
      };
    } catch (error) {
      throw new AppError('Failed to get user statistics', 500, 'USER_STATS_ERROR');
    }
  }

  // Search users
  static async searchUsers(query, options = {}) {
    try {
      const { page = 1, limit = 20, role, isWriter, isVerified } = options;
      const skip = (page - 1) * limit;

      const where = {
        AND: [
          { isActive: true },
          { isBanned: false },
          query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { bio: { contains: query, mode: 'insensitive' } }
            ]
          } : {},
          role ? { role } : {},
          isWriter !== undefined ? { isWriter } : {},
          isVerified !== undefined ? { isVerified } : {}
        ].filter(condition => Object.keys(condition).length > 1 || Object.values(condition)[0] !== false)
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            bio: true,
            isWriter: true,
            isVerified: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new AppError('Failed to search users', 500, 'SEARCH_USERS_ERROR');
    }
  }

  // Get all users (admin only)
  static async getAllUsers(options = {}) {
    try {
      const { page = 1, limit = 50, role, status } = options;
      const skip = (page - 1) * limit;

      const where = {
        AND: [
          role ? { role } : {},
          status === 'active' ? { isActive: true, isBanned: false } : {},
          status === 'banned' ? { isBanned: true } : {},
          status === 'inactive' ? { isActive: false } : {}
        ].filter(condition => Object.keys(condition).length > 0)
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            isWriter: true,
            isVerified: true,
            isPremium: true,
            premiumExpiresAt: true,
            coins: true,
            isActive: true,
            isBanned: true,
            bannedAt: true,
            bannedReason: true,
            lastLoginAt: true,
            loginCount: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new AppError('Failed to get all users', 500, 'GET_ALL_USERS_ERROR');
    }
  }
}

module.exports = UserService;
