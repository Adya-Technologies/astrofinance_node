import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';

/**
 * Get admin dashboard summary
 */
export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const adminId = req.staff?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get total users count
    const totalUsersCount = await prisma.user.count();
    const activeUsersCount = await prisma.user.count({
      where: { isActive: true }
    });

    // Get staff count
    const totalStaffCount = await prisma.staff.count();
    const activeStaffCount = await prisma.staff.count({
      where: { status: 'ACTIVE' }
    });

    // Get loan statistics
    const totalLoansCount = await prisma.loan.count();
    const activeLoansCount = await prisma.loan.count({
      where: { status: 'ACTIVE' }
    });
    const totalLoanAmount = await prisma.loan.aggregate({
      _sum: {
        principalAmount: true
      }
    });
    const outstandingLoanAmount = await prisma.loan.aggregate({
      where: { status: 'ACTIVE' },
      _sum: {
        outstandingPrincipal: true
      }
    });

    // Get pending applications count
    const pendingApplicationsCount = await prisma.loanApplication.count({
      where: { status: 'PENDING' }
    });

    // Get recent activities
    // Get recent loan applications
    const recentApplications = await prisma.loanApplication.findMany({
      take: 3,
      orderBy: { appliedDate: 'desc' },
      include: {
        user: true
      }
    });

    // Get recent loan payments
    const recentPayments = await prisma.loanPayment.findMany({
      take: 2,
      orderBy: { paymentDate: 'desc' },
      include: {
        loan: {
          include: {
            user: true
          }
        }
      }
    });

    // Get recent staff logins
    const recentStaffLogins = await prisma.staff.findMany({
      take: 2,
      where: {
        lastLogin: { not: null }
      },
      orderBy: { lastLogin: 'desc' }
    });

    // Combine and format activities
    const recentActivities = [
      ...recentApplications.map(app => ({
        id: app.id,
        type: 'LOAN_APPLICATION',
        description: 'New loan application submitted',
        timestamp: app.appliedDate.toISOString(),
        user: {
          id: app.userId,
          name: app.user.fullName
        },
        details: {
          amount: app.amount,
          status: app.status
        }
      })),
      ...recentPayments.map(payment => ({
        id: payment.id,
        type: 'PAYMENT',
        description: 'Loan payment received',
        timestamp: payment.paymentDate.toISOString(),
        user: {
          id: payment.loan.userId,
          name: payment.loan.user.fullName
        },
        details: {
          amount: payment.amount,
          loanId: payment.loanId
        }
      })),
      ...recentStaffLogins.map(staff => ({
        id: staff.id,
        type: 'STAFF_LOGIN',
        description: 'Staff member logged in',
        timestamp: staff.lastLogin?.toISOString() || new Date().toISOString(),
        user: {
          id: staff.id,
          name: `${staff.firstName} ${staff.lastName}`
        },
        details: {
          department: staff.department,
          position: staff.position
        }
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5); // Return top 5 activities

    // Return dashboard summary
    return res.status(200).json({
      users: {
        total: totalUsersCount,
        active: activeUsersCount
      },
      staff: {
        total: totalStaffCount,
        active: activeStaffCount
      },
      loans: {
        total: totalLoansCount,
        active: activeLoansCount,
        totalAmount: totalLoanAmount._sum.principalAmount || 0,
        outstandingAmount: outstandingLoanAmount._sum.outstandingPrincipal || 0
      },
      pendingApplications: pendingApplicationsCount,
      recentActivities
    });
  } catch (error) {
    logger.error('Get admin dashboard summary error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};