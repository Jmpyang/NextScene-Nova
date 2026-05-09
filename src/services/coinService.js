const UserService = require('../models/User');
const CoinTransactionService = require('../models/CoinTransaction');

/**
 * Coin Management Service
 * Handles all coin-related operations and calculations
 */
class CoinService {
  /**
   * Add coins to user account
   * @param {string} userId - User ID
   * @param {number} amount - Coins to add
   * @param {string} source - Source of coins (SIGNUP, LIKE, etc.)
   * @param {string} description - Optional description
   * @param {object} metadata - Optional metadata for tracking
   * @returns {object} Transaction record and updated user
   */
  static async addCoins(userId, amount, source, description = '', metadata = null) {
    try {
      const user = await UserService.findById(userId);
      if (!user) throw new Error('User not found');

      const previousBalance = user.coins;

      // Use CoinTransactionService to handle the transaction and balance update
      const transaction = await CoinTransactionService.createWithBalanceUpdate(
        userId, 'EARN', source, amount, description, null, metadata
      );

      return {
        success: true,
        transaction,
        user: {
          id: user.id,
          coins: transaction.balanceAfter,
          previousBalance,
          amountAdded: amount
        }
      };
    } catch (error) {
      console.error('Error adding coins:', error);
      throw error;
    }
  }

  /**
   * Deduct coins from user account
   * @param {string} userId - User ID
   * @param {number} amount - Coins to deduct
   * @param {string} reason - Reason for deduction
   * @param {object} metadata - Optional metadata
   * @returns {object} Transaction record
   */
  static async deductCoins(userId, amount, reason, metadata = null) {
    try {
      const user = await UserService.findById(userId);
      if (!user) throw new Error('User not found');

      if (user.coins < amount) {
        throw new Error('Insufficient coins');
      }

      // Use CoinTransactionService to handle the transaction and balance update
      const transaction = await CoinTransactionService.createWithBalanceUpdate(
        userId, 'DEDUCTION', 'VIOLATION_PENALTY', amount, reason, null, metadata
      );

      return {
        success: true,
        transaction,
        user: { id: user.id, coins: transaction.balanceAfter }
      };
    } catch (error) {
      console.error('Error deducting coins:', error);
      throw error;
    }
  }

  /**
   * Award coins for user actions
   */
  static async awardCoins(userId, action) {
    const coinRewards = {
      SIGNUP: parseInt(process.env.SIGNUP_BONUS_COINS || 10),
      LIKE: parseInt(process.env.LIKE_COMMENT_RATING_COINS || 5),
      COMMENT: parseInt(process.env.LIKE_COMMENT_RATING_COINS || 5),
      RATING: parseInt(process.env.LIKE_COMMENT_RATING_COINS || 5),
      AD_WATCH: parseInt(process.env.AD_WATCH_COINS || 20),
      CONTENT_UPLOAD: parseInt(process.env.CONTENT_UPLOAD_COINS || 20),
      PREMIUM_MONTHLY: parseInt(process.env.PREMIUM_MONTHLY_COINS || 100),
      PREMIUM_YEARLY: parseInt(process.env.PREMIUM_YEARLY_COINS || 500)
    };

    const amount = coinRewards[action];
    if (!amount) throw new Error(`Invalid action: ${action}`);

    return CoinTransactionService.awardCoins(userId, amount, action, `Awarded for ${action.toLowerCase()}`);
  }

  /**
   * Get coin balance
   */
  static async getBalance(userId) {
    const balance = await CoinTransactionService.getUserBalance(userId);
    return balance.coins;
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(userId, limit = 50, skip = 0) {
    const result = await CoinTransactionService.findByUser(userId, { 
      limit, 
      page: Math.floor(skip / limit) + 1 
    });

    return { 
      transactions: result.transactions, 
      total: result.pagination.total 
    };
  }

  /**
   * Convert coins to KES (Kenyan Shillings)
   */
  static convertCoinsToKES(coins) {
    const coinValue = parseFloat(process.env.COIN_VALUE_KES || 0.1);
    return coins * coinValue;
  }

  /**
   * Check if user is eligible for monetization
   */
  static async checkMonetizationEligibility(userId) {
    try {
      const user = await UserService.findById(userId);
      if (!user) throw new Error('User not found');

      const threshold = parseInt(process.env.MONETIZATION_THRESHOLD || 500);
      const isEligible =
        user.coins >= threshold &&
        user.isPremium === true &&
        user.isVerified === true &&
        user.accountStatus === 'ACTIVE';

      return {
        eligible: isEligible,
        coins: user.coins,
        threshold,
        coinsNeeded: Math.max(0, threshold - user.coins),
        isPremium: user.isPremium,
        isVerified: user.isVerified,
        accountStatus: 'ACTIVE'
      };
    } catch (error) {
      console.error('Error checking monetization eligibility:', error);
      throw error;
    }
  }

  /**
   * Award coins for signup
   */
  static async awardSignupBonus(userId) {
    return CoinTransactionService.awardCoins(userId, 10, 'SIGNUP', 'Welcome bonus for signing up!');
  }

  /**
   * Get coin earnings summary for user
   */
  static async getEarningsSummary(userId, months = 3) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return await CoinTransactionService.getEarningsBySource({ 
      userId, 
      startDate 
    });
  }

  /**
   * Verify monthly monetization renewal
   */
  static async verifyMonetizationRenewal(userId) {
    try {
      const user = await UserService.findById(userId);
      if (!user) throw new Error('User not found');

      // Simplified renewal check - this would need more complex logic in production
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // For now, just return that renewal is not needed
      // In production, this would check against monetization application records
      return { needsRenewal: false, message: 'Monetization still active' };
    } catch (error) {
      console.error('Error verifying monetization renewal:', error);
      throw error;
    }
  }
}

module.exports = CoinService;
