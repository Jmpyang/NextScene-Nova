const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

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
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const previousBalance = user.coins;
      user.coins += amount;

      // Create transaction record
      const transaction = await CoinTransaction.create({
        userId,
        type: 'EARN',
        source,
        amount,
        balanceAfter: user.coins,
        description,
        metadata
      });

      await user.save();

      return {
        success: true,
        transaction,
        user: {
          id: user._id,
          coins: user.coins,
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
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      if (user.coins < amount) {
        throw new Error('Insufficient coins');
      }

      user.coins -= amount;

      const transaction = await CoinTransaction.create({
        userId,
        type: 'DEDUCTION',
        source: 'VIOLATION_PENALTY',
        amount,
        balanceAfter: user.coins,
        description: reason,
        metadata
      });

      await user.save();

      return {
        success: true,
        transaction,
        user: { id: user._id, coins: user.coins }
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

    return this.addCoins(userId, amount, action, `Awarded for ${action.toLowerCase()}`);
  }

  /**
   * Get coin balance
   */
  static async getBalance(userId) {
    const user = await User.findById(userId).select('coins');
    return user ? user.coins : 0;
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(userId, limit = 50, skip = 0) {
    const transactions = await CoinTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await CoinTransaction.countDocuments({ userId });

    return { transactions, total };
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
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const threshold = parseInt(process.env.MONETIZATION_THRESHOLD || 500);
      const isEligible =
        user.coins >= threshold &&
        user.isPremium === true &&
        user.verificationStatus === 'VERIFIED' &&
        user.monetizationStatus !== 'BANNED' &&
        user.accountStatus === 'ACTIVE';

      if (isEligible && !user.monetizationEligible) {
        user.monetizationEligible = true;
        await user.save();
      }

      return {
        eligible: isEligible,
        coins: user.coins,
        threshold,
        coinsNeeded: Math.max(0, threshold - user.coins),
        isPremium: user.isPremium,
        verificationStatus: user.verificationStatus,
        monetizationStatus: user.monetizationStatus,
        accountStatus: user.accountStatus
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
    return this.awardCoins(userId, 'SIGNUP');
  }

  /**
   * Get coin earnings summary for user
   */
  static async getEarningsSummary(userId, months = 3) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const summary = await CoinTransaction.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          type: 'EARN',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$source',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    return summary;
  }

  /**
   * Verify monthly monetization renewal
   */
  static async verifyMonetizationRenewal(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Check if renewal is needed
      const lastRenewal = user.monetizationLastRenewed;
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (!lastRenewal || lastRenewal < monthAgo) {
        // Renewal needed - reset status to PENDING for re-verification
        user.monetizationStatus = 'PENDING';
        await user.save();
        return { needsRenewal: true, message: 'Monthly renewal required' };
      }

      return { needsRenewal: false, message: 'Monetization still active' };
    } catch (error) {
      console.error('Error verifying monetization renewal:', error);
      throw error;
    }
  }
}

module.exports = CoinService;
