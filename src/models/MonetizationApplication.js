const { prisma } = require('../config/db');

class MonetizationApplicationService {
  // Create a new monetization application
  static async create(applicationData) {
    const { submittedDocuments, contentOwnershipProof, ...data } = applicationData;
    
    return await prisma.monetizationApplication.create({
      data: {
        ...data,
        submittedDocuments: submittedDocuments || [],
        contentOwnershipProofUrl: contentOwnershipProof?.url || null,
        contentOwnershipPublicId: contentOwnershipProof?.publicId || null,
        contentOwnershipType: contentOwnershipProof?.documentType || 'COPYRIGHT_CERTIFICATE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Find application by ID
  static async findById(id) {
    return await prisma.monetizationApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Find application by user ID
  static async findByUserId(userId) {
    return await prisma.monetizationApplication.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Update application
  static async update(id, updateData) {
    const { submittedDocuments, contentOwnershipProof, ...data } = updateData;
    
    const updatePayload = { ...data };
    if (submittedDocuments !== undefined) {
      updatePayload.submittedDocuments = submittedDocuments;
    }
    if (contentOwnershipProof !== undefined) {
      updatePayload.contentOwnershipProofUrl = contentOwnershipProof?.url || null;
      updatePayload.contentOwnershipPublicId = contentOwnershipProof?.publicId || null;
      updatePayload.contentOwnershipType = contentOwnershipProof?.documentType || 'COPYRIGHT_CERTIFICATE';
    }

    return await prisma.monetizationApplication.update({
      where: { id },
      data: updatePayload,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Delete application
  static async delete(id) {
    return await prisma.monetizationApplication.delete({
      where: { id }
    });
  }

  // Find all applications (with pagination and filters)
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      reviewedById,
      startDate,
      endDate
    } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (reviewedById) where.reviewedById = reviewedById;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [applications, total] = await Promise.all([
      prisma.monetizationApplication.findMany({
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
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.monetizationApplication.count({ where })
    ]);

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Approve application
  static async approve(id, reviewedById, reviewNotes = '', monthlyMonetizationCap = null) {
    return await prisma.monetizationApplication.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewNotes,
        monthlyMonetizationCap,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Reject application
  static async reject(id, reviewedById, rejectionReason, reviewNotes = '') {
    return await prisma.monetizationApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById,
        rejectionReason,
        reviewNotes,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  }

  // Add document to application
  static async addDocument(id, documentData) {
    const application = await prisma.monetizationApplication.findUnique({
      where: { id },
      select: { submittedDocuments: true }
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const updatedDocuments = [...application.submittedDocuments, {
      ...documentData,
      uploadedAt: new Date(),
      verificationStatus: 'PENDING'
    }];

    return await prisma.monetizationApplication.update({
      where: { id },
      data: {
        submittedDocuments: updatedDocuments
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

  // Update document verification status
  static async updateDocumentStatus(id, documentIndex, verificationStatus) {
    const application = await prisma.monetizationApplication.findUnique({
      where: { id },
      select: { submittedDocuments: true }
    });

    if (!application) {
      throw new Error('Application not found');
    }

    if (documentIndex < 0 || documentIndex >= application.submittedDocuments.length) {
      throw new Error('Invalid document index');
    }

    const updatedDocuments = [...application.submittedDocuments];
    updatedDocuments[documentIndex] = {
      ...updatedDocuments[documentIndex],
      verificationStatus
    };

    return await prisma.monetizationApplication.update({
      where: { id },
      data: {
        submittedDocuments: updatedDocuments
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

  // Remove document from application
  static async removeDocument(id, documentIndex) {
    const application = await prisma.monetizationApplication.findUnique({
      where: { id },
      select: { submittedDocuments: true }
    });

    if (!application) {
      throw new Error('Application not found');
    }

    if (documentIndex < 0 || documentIndex >= application.submittedDocuments.length) {
      throw new Error('Invalid document index');
    }

    const updatedDocuments = application.submittedDocuments.filter((_, index) => index !== documentIndex);

    return await prisma.monetizationApplication.update({
      where: { id },
      data: {
        submittedDocuments: updatedDocuments
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

  // Set content ownership proof
  static async setContentOwnershipProof(id, url, publicId, documentType = 'COPYRIGHT_CERTIFICATE') {
    return await prisma.monetizationApplication.update({
      where: { id },
      data: {
        contentOwnershipProofUrl: url,
        contentOwnershipPublicId: publicId,
        contentOwnershipType: documentType,
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

  // Get applications pending review
  static async getPendingReview(options = {}) {
    const { limit = 10 } = options;

    return await prisma.monetizationApplication.findMany({
      where: { status: 'PENDING' },
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
      orderBy: { submissionDate: 'asc' }
    });
  }

  // Get applications by reviewer
  static async findByReviewer(reviewedById, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    const where = { reviewedById };
    if (status) where.status = status;

    const [applications, total] = await Promise.all([
      prisma.monetizationApplication.findMany({
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
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.monetizationApplication.count({ where })
    ]);

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get application statistics
  static async getStatistics(options = {}) {
    const { startDate, endDate } = options;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications
    ] = await Promise.all([
      prisma.monetizationApplication.count({ where }),
      prisma.monetizationApplication.count({ where: { ...where, status: 'PENDING' } }),
      prisma.monetizationApplication.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.monetizationApplication.count({ where: { ...where, status: 'REJECTED' } })
    ]);

    return {
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      approvalRate: totalApplications > 0 ? (approvedApplications / totalApplications) * 100 : 0
    };
  }

  // Check if user has existing application
  static async userHasApplication(userId) {
    const application = await prisma.monetizationApplication.findUnique({
      where: { userId },
      select: { id: true }
    });

    return !!application;
  }

  // Get recent applications
  static async getRecentApplications(options = {}) {
    const { limit = 10, status } = options;
    
    const where = {};
    if (status) where.status = status;

    return await prisma.monetizationApplication.findMany({
      where,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        reviewedBy: {
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

module.exports = MonetizationApplicationService;
