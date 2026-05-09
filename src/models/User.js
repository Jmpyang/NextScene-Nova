const { prisma } = require('../config/db');
const bcrypt = require('bcryptjs');

class UserService {
  // Create a new user
  static async create(userData) {
    const { password, ...data } = userData;
    
    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    return await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        totalCoinsEarned: 0,
        totalMoneyWithdrawn: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumExpiresAt: true,
        avatar: true,
        bio: true,
        phoneNumber: true,
        isVerified: true,
        isWriter: true,
        website: true,
        twitter: true,
        linkedin: true,
        coins: true,
        totalCoinsEarned: true,
        totalMoneyWithdrawn: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Find user by ID
  static async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumExpiresAt: true,
        avatar: true,
        bio: true,
        phoneNumber: true,
        isVerified: true,
        isWriter: true,
        website: true,
        twitter: true,
        linkedin: true,
        coins: true,
        totalCoinsEarned: true,
        totalMoneyWithdrawn: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Find user by email
  static async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        socialId: true,
        provider: true,
        isPremium: true,
        premiumExpiresAt: true,
        avatar: true,
        bio: true,
        phoneNumber: true,
        isVerified: true,
        isWriter: true,
        website: true,
        twitter: true,
        linkedin: true,
        coins: true,
        totalCoinsEarned: true,
        totalMoneyWithdrawn: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Find user by social ID and provider
  static async findBySocialId(socialId, provider) {
    return await prisma.user.findFirst({
      where: {
        socialId,
        provider,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        socialId: true,
        provider: true,
        isPremium: true,
        premiumExpiresAt: true,
        avatar: true,
        bio: true,
        phoneNumber: true,
        isVerified: true,
        isWriter: true,
        website: true,
        twitter: true,
        linkedin: true,
        coins: true,
        totalCoinsEarned: true,
        totalMoneyWithdrawn: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Update user
  static async update(id, updateData) {
    const { password, ...data } = updateData;
    
    // Hash password if provided
    let hashedPassword = undefined;
    if (password !== undefined) {
      if (password) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
      } else {
        hashedPassword = null;
      }
    }

    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(hashedPassword !== undefined && { password: hashedPassword }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumExpiresAt: true,
        avatar: true,
        bio: true,
        phoneNumber: true,
        isVerified: true,
        isWriter: true,
        website: true,
        twitter: true,
        linkedin: true,
        coins: true,
        totalCoinsEarned: true,
        totalMoneyWithdrawn: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Delete user
  static async delete(id) {
    return await prisma.user.delete({
      where: { id }
    });
  }

  // Find all users (with pagination)
  static async findAll(options = {}) {
    const { page = 1, limit = 10, role, isVerified } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (isVerified !== undefined) where.isVerified = isVerified;

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
          isPremium: true,
          premiumExpiresAt: true,
          avatar: true,
          bio: true,
          phoneNumber: true,
          isVerified: true,
          isWriter: true,
          website: true,
          twitter: true,
          linkedin: true,
          coins: true,
          totalCoinsEarned: true,
          totalMoneyWithdrawn: true,
          createdAt: true,
          updatedAt: true,
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
  }

  // Compare password
  static async comparePassword(user, candidatePassword) {
    if (!user.password) return false;
    return await bcrypt.compare(candidatePassword, user.password);
  }

  // Check if premium is active
  static isPremiumActive(user) {
    // If explicitly not premium, return false
    if (user.isPremium === false) return false;

    // If isPremium is true and no expiry date, assume valid (legacy or lifetime)
    if (user.isPremium === true && !user.premiumExpiresAt) return true;

    // If expiry exists, check if it's in the future
    return user.isPremium && user.premiumExpiresAt && new Date() < user.premiumExpiresAt;
  }

  // Update user coins
  static async updateCoins(userId, coins, totalCoinsEarned) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        coins,
        totalCoinsEarned,
      },
      select: {
        id: true,
        name: true,
        email: true,
        coins: true,
        totalCoinsEarned: true,
      }
    });
  }

  // Update total money withdrawn
  static async updateTotalWithdrawn(userId, amount) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        totalMoneyWithdrawn: {
          increment: amount,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        totalMoneyWithdrawn: true,
      }
    });
  }
}

module.exports = UserService;
