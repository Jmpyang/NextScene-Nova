const User = require('../models/User');
const MonetizationApplication = require('../models/MonetizationApplication');
const cloudinary = require('../config/cloudinary');

/**
 * Monetization Management Service
 * Handles application, verification, and enforcement of monetization policies
 */
class MonetizationService {
  /**
   * Submit monetization application
   */
  static async submitApplication(userId, documents) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Check if user already has a pending application
      const existing = await MonetizationApplication.findOne({ userId });
      if (existing && existing.status === 'PENDING') {
        throw new Error('You already have a pending application');
      }

      // Create new application
      let application = await MonetizationApplication.create({
        userId,
        status: 'PENDING',
        submittedDocuments: documents
      });

      // Update user status
      user.monetizationStatus = 'PENDING';
      user.verificationStatus = 'SUBMITTED';
      await user.save();

      return {
        success: true,
        application: application._id,
        message: 'Application submitted successfully. Our team will review it within 48 hours.'
      };
    } catch (error) {
      console.error('Error submitting monetization application:', error);
      throw error;
    }
  }

  /**
   * Approve monetization application
   */
  static async approveApplication(applicationId, reviewedBy, notes = '') {
    try {
      const application = await MonetizationApplication.findById(applicationId);
      if (!application) throw new Error('Application not found');

      application.status = 'APPROVED';
      application.reviewedBy = reviewedBy;
      application.reviewDate = new Date();
      application.reviewNotes = notes;
      application.lastRenewalDate = new Date();
      
      // Set next renewal in 30 days
      const nextRenewal = new Date();
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      application.nextRenewalRequired = nextRenewal;
      
      await application.save();

      // Update user
      const user = await User.findById(application.userId);
      user.monetizationStatus = 'APPROVED';
      user.verificationStatus = 'VERIFIED';
      user.monetizationLastRenewed = new Date();
      user.badges.monetized = true;
      await user.save();

      return {
        success: true,
        message: 'Monetization approved',
        user: user._id
      };
    } catch (error) {
      console.error('Error approving application:', error);
      throw error;
    }
  }

  /**
   * Reject monetization application
   */
  static async rejectApplication(applicationId, reviewedBy, rejectionReason, notes = '') {
    try {
      const application = await MonetizationApplication.findById(applicationId);
      if (!application) throw new Error('Application not found');

      application.status = 'REJECTED';
      application.reviewedBy = reviewedBy;
      application.reviewDate = new Date();
      application.rejectionReason = rejectionReason;
      application.reviewNotes = notes;
      
      await application.save();

      // Update user
      const user = await User.findById(application.userId);
      user.monetizationStatus = 'DENIED';
      user.verificationStatus = 'REJECTED';
      await user.save();

      return {
        success: true,
        message: 'Application rejected',
        user: user._id,
        reason: rejectionReason
      };
    } catch (error) {
      console.error('Error rejecting application:', error);
      throw error;
    }
  }

  /**
   * Ban user from monetization
   */
  static async banUserFromMonetization(userId, reason, severity = 'BAN') {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Add violation flag
      user.violationFlags.push({
        type: 'PAYMENT_FRAUD',
        reason,
        severity
      });

      if (severity === 'BAN') {
        user.monetizationStatus = 'BANNED';
        user.badges.monetized = false;
      } else if (severity === 'SUSPENSION') {
        user.accountStatus = 'SUSPENDED';
      }

      await user.save();

      return {
        success: true,
        message: `User banned from monetization: ${reason}`,
        user: user._id
      };
    } catch (error) {
      console.error('Error banning user:', error);
      throw error;
    }
  }

  /**
   * Verify monthly monetization renewal
   */
  static async renewMonetizationStatus(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const application = await MonetizationApplication.findOne({ userId });
      if (!application) {
        throw new Error('No monetization application found');
      }

      // Check if renewal is needed
      if (application.nextRenewalRequired <= new Date()) {
        application.renewalStatus = 'PENDING_RENEWAL';
        user.monetizationStatus = 'PENDING';
        await application.save();
        await user.save();
        return { renewed: false, message: 'Renewal required' };
      }

      return { renewed: true, message: 'Monetization still active' };
    } catch (error) {
      console.error('Error renewing monetization:', error);
      throw error;
    }
  }

  /**
   * Check for policy violations
   */
  static async detectViolations(userId, violationType) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Check for multiple accounts (example check)
      if (violationType === 'MULTIPLE_ACCOUNTS') {
        const similarIPs = await User.findOne({
          _id: { $ne: userId },
          $expr: { $eq: ['$ip', `$${userId}.ip`] }
        });
        if (similarIPs) return true;
      }

      return false;
    } catch (error) {
      console.error('Error detecting violations:', error);
      throw error;
    }
  }

  /**
   * Enforce automatic restrictions based on flags
   */
  static async enforceAutomaticRestrictions(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Count severe violations
      const severeViolations = user.violationFlags.filter(
        f => f.severity === 'BAN'
      ).length;

      if (severeViolations > 0) {
        user.monetizationStatus = 'BANNED';
        user.accountStatus = 'BANNED';
        user.badges.monetized = false;
      } else {
        const suspensionCount = user.violationFlags.filter(
          f => f.severity === 'SUSPENSION'
        ).length;

        if (suspensionCount > 2) {
          user.accountStatus = 'SUSPENDED';
        }
      }

      await user.save();
      return { enforced: true, user };
    } catch (error) {
      console.error('Error enforcing restrictions:', error);
      throw error;
    }
  }

  /**
   * Get monetization status for user
   */
  static async getMonetizationStatus(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const application = await MonetizationApplication.findOne({ userId });

      return {
        user: {
          id: user._id,
          name: user.name,
          coins: user.coins,
          isPremium: user.isPremium,
          badges: user.badges,
          monetizationStatus: user.monetizationStatus,
          verificationStatus: user.verificationStatus,
          accountStatus: user.accountStatus,
          monetizationEligible: user.monetizationEligible,
          monetizationLastRenewed: user.monetizationLastRenewed,
          violationFlags: user.violationFlags.length
        },
        application: application ? {
          id: application._id,
          status: application.status,
          submissionDate: application.submissionDate,
          nextRenewalRequired: application.nextRenewalRequired,
          renewalStatus: application.renewalStatus
        } : null
      };
    } catch (error) {
      console.error('Error getting monetization status:', error);
      throw error;
    }
  }

  /**
   * Get all pending applications (admin only)
   */
  static async getPendingApplications(limit = 20, skip = 0) {
    try {
      const applications = await MonetizationApplication.find({ status: 'PENDING' })
        .populate('userId', 'name email coins')
        .sort({ submissionDate: 1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await MonetizationApplication.countDocuments({ status: 'PENDING' });

      return { applications, total };
    } catch (error) {
      console.error('Error fetching pending applications:', error);
      throw error;
    }
  }

  /**
   * Upload verification document
   */
  static async uploadVerificationDocument(userId, file, idType) {
    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `nextscene/monetization/${userId}`,
        resource_type: 'auto',
        access_control: [{ access_type: 'token' }]
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        idType
      };
    } catch (error) {
      console.error('Error uploading verification document:', error);
      throw error;
    }
  }
}

module.exports = MonetizationService;
