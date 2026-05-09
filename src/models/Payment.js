const { prisma } = require('../config/db');

class PaymentService {
  // Create a new payment
  static async create(paymentData) {
    return await prisma.payment.create({
      data: {
        ...paymentData,
        metadata: paymentData.metadata || {},
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Find payment by ID
  static async findById(id) {
    return await prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Update payment
  static async update(id, updateData) {
    return await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Delete payment
  static async delete(id) {
    return await prisma.payment.delete({
      where: { id }
    });
  }

  // Find all payments (with pagination and filters)
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      userId, 
      status, 
      paymentMethod,
      plan,
      startDate,
      endDate
    } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (plan) where.plan = plan;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find payments by user
  static async findByUser(userId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    const where = { userId };
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Find payment by PayPal order ID
  static async findByPayPalOrderId(paypalOrderId) {
    return await prisma.payment.findFirst({
      where: { paypalOrderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Find payment by M-Pesa checkout request ID
  static async findByMpesaCheckoutRequestId(mpesaCheckoutRequestID) {
    return await prisma.payment.findFirst({
      where: { mpesaCheckoutRequestID },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Update payment status
  static async updateStatus(id, status, additionalData = {}) {
    return await prisma.payment.update({
      where: { id },
      data: {
        status,
        ...additionalData,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Complete PayPal payment
  static async completePayPalPayment(id, paypalCaptureId, metadata = {}) {
    return await prisma.payment.update({
      where: { id },
      data: {
        status: 'completed',
        paypalCaptureId,
        metadata: {
          ...metadata,
          completedAt: new Date().toISOString(),
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Complete M-Pesa payment
  static async completeMpesaPayment(id, mpesaReceiptNumber, mpesaPhoneNumber, metadata = {}) {
    return await prisma.payment.update({
      where: { id },
      data: {
        status: 'completed',
        mpesaReceiptNumber,
        mpesaPhoneNumber,
        metadata: {
          ...metadata,
          completedAt: new Date().toISOString(),
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Fail payment
  static async failPayment(id, reason, metadata = {}) {
    return await prisma.payment.update({
      where: { id },
      data: {
        status: 'failed',
        metadata: {
          ...metadata,
          failedAt: new Date().toISOString(),
          failureReason: reason,
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Cancel payment
  static async cancelPayment(id, reason, metadata = {}) {
    return await prisma.payment.update({
      where: { id },
      data: {
        status: 'cancelled',
        metadata: {
          ...metadata,
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason,
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Get payment statistics
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
      totalPayments,
      completedPayments,
      failedPayments,
      pendingPayments,
      cancelledPayments,
      totalRevenue
    ] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...where, status: 'completed' } }),
      prisma.payment.count({ where: { ...where, status: 'failed' } }),
      prisma.payment.count({ where: { ...where, status: 'pending' } }),
      prisma.payment.count({ where: { ...where, status: 'cancelled' } }),
      prisma.payment.aggregate({
        where: { ...where, status: 'completed' },
        _sum: { amount: true }
      })
    ]);

    return {
      totalPayments,
      completedPayments,
      failedPayments,
      pendingPayments,
      cancelledPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      completionRate: totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0
    };
  }

  // Get revenue by period
  static async getRevenueByPeriod(period = 'month', options = {}) {
    const { userId, startDate, endDate } = options;

    // This would need to be implemented based on specific requirements
    // For now, return basic revenue data
    const where = { status: 'completed' };
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        currency: true,
        createdAt: true,
        plan: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    return payments;
  }

  // Get recent payments
  static async getRecentPayments(options = {}) {
    const { limit = 10, userId, status } = options;
    
    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return await prisma.payment.findMany({
      where,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

module.exports = PaymentService;

