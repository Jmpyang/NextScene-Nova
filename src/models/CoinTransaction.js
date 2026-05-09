const { prisma } = require('../config/db');

class CoinTransactionService {
  // Create a new coin transaction
  static async create(transactionData) {
    return await prisma.coinTransaction.create({
      data: {
        ...transactionData,
        metadata: transactionData.metadata || {},
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            coins: true,
          }
        }
      }
    });
  }

  // Find transaction by ID
  static async findById(id) {
    return await prisma.coinTransaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            coins: true,
          }
        }
      }
    });
  }

  // Update transaction
  static async update(id, updateData) {
    return await prisma.coinTransaction.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            coins: true,
          }
        }
      }
    });
  }

  // Delete transaction
  static async delete(id) {
    return await prisma.coinTransaction.delete({
      where: { id }
    });
  }

  // Find all transactions (with pagination and filters)
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      userId, 
      type, 
      source,
      startDate,
      endDate
    } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (source) where.source = source;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              coins: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.coinTransaction.count({ where })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find transactions by user
  static async findByUser(userId, options = {}) {
    const { page = 1, limit = 10, type, source } = options;
    const skip = (page - 1) * limit;

    const where = { userId };
    if (type) where.type = type;
    if (source) where.source = source;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              coins: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.coinTransaction.count({ where })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Create transaction and update user coins
  static async createWithBalanceUpdate(userId, type, source, amount, description = '', referenceId = null, metadata = {}) {
    // Get current user balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, totalCoinsEarned: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    let newBalance = user.coins;
    let newTotalEarned = user.totalCoinsEarned;

    // Calculate new balance based on transaction type
    if (type === 'EARN') {
      newBalance += amount;
      newTotalEarned += amount;
    } else if (type === 'DEDUCTION' || type === 'PURCHASE') {
      if (newBalance < amount) {
        throw new Error('Insufficient coins');
      }
      newBalance -= amount;
    }

    // Create transaction and update user balance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the transaction
      const transaction = await tx.coinTransaction.create({
        data: {
          userId,
          type,
          source,
          amount,
          balanceAfter: newBalance,
          description,
          referenceId,
          metadata,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              coins: true,
            }
          }
        }
      });

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          coins: newBalance,
          totalCoinsEarned: newTotalEarned,
        }
      });

      return transaction;
    });

    return result;
  }

  // Get user's coin balance
  static async getUserBalance(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, totalCoinsEarned: true }
    });

    return user || { coins: 0, totalCoinsEarned: 0 };
  }

  // Get transaction statistics
  static async getStatistics(options = {}) {
    const { userId, startDate, endDate } = options;

    const where = {};
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [
      totalTransactions,
      earnedTransactions,
      purchaseTransactions,
      deductionTransactions,
      totalEarned,
      totalSpent
    ] = await Promise.all([
      prisma.coinTransaction.count({ where }),
      prisma.coinTransaction.count({ where: { ...where, type: 'EARN' } }),
      prisma.coinTransaction.count({ where: { ...where, type: 'PURCHASE' } }),
      prisma.coinTransaction.count({ where: { ...where, type: 'DEDUCTION' } }),
      prisma.coinTransaction.aggregate({
        where: { ...where, type: 'EARN' },
        _sum: { amount: true }
      }),
      prisma.coinTransaction.aggregate({
        where: { ...where, type: { in: ['PURCHASE', 'DEDUCTION'] } },
        _sum: { amount: true }
      })
    ]);

    return {
      totalTransactions,
      earnedTransactions,
      purchaseTransactions,
      deductionTransactions,
      totalEarned: totalEarned._sum.amount || 0,
      totalSpent: totalSpent._sum.amount || 0,
      netBalance: (totalEarned._sum.amount || 0) - (totalSpent._sum.amount || 0)
    };
  }

  // Get recent transactions
  static async getRecentTransactions(options = {}) {
    const { limit = 10, userId, type } = options;
    
    const where = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    return await prisma.coinTransaction.findMany({
      where,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            coins: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get transactions by source
  static async getBySource(source, options = {}) {
    const { page = 1, limit = 10, userId } = options;
    const skip = (page - 1) * limit;

    const where = { source };
    if (userId) where.userId = userId;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              coins: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.coinTransaction.count({ where })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get earnings summary by source
  static async getEarningsBySource(options = {}) {
    const { userId, startDate, endDate } = options;

    const where = { type: 'EARN' };
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const earnings = await prisma.coinTransaction.groupBy({
      by: ['source'],
      where,
      _sum: { amount: true },
      _count: { source: true },
      orderBy: { _sum: { amount: 'desc' } }
    });

    return earnings.map(item => ({
      source: item.source,
      totalAmount: item._sum.amount || 0,
      transactionCount: item._count.source
    }));
  }

  // Deduct coins (for purchases or penalties)
  static async deductCoins(userId, amount, source, description = '', referenceId = null, metadata = {}) {
    return await this.createWithBalanceUpdate(userId, 'DEDUCTION', source, amount, description, referenceId, metadata);
  }

  // Award coins (for earnings)
  static async awardCoins(userId, amount, source, description = '', referenceId = null, metadata = {}) {
    return await this.createWithBalanceUpdate(userId, 'EARN', source, amount, description, referenceId, metadata);
  }

  // Purchase with coins
  static async purchaseWithCoins(userId, amount, source, description = '', referenceId = null, metadata = {}) {
    return await this.createWithBalanceUpdate(userId, 'PURCHASE', source, amount, description, referenceId, metadata);
  }
}

module.exports = CoinTransactionService;
