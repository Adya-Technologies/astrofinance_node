import { PrismaClient, LoanStatus, InstallmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface TodaysCollectionsSummary {
    plannedAmount: number;
    collectedAmount: number;
    missingCollections: number;
    officersNotSynced: number;
    cashMismatchCount: number;
    collectionRate: number;
}

export interface MissingCollection {
    userId: string;
    userName: string;
    expectedAmount: number;
    centerName: string;
    lastPaymentDate: Date | null;
}

/**
 * Get today's collections summary for a branch
 */
export const getTodaysCollectionsSummary = async (branchId?: string): Promise<TodaysCollectionsSummary> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all installments due today
    const installmentsDueToday = await prisma.loanInstallment.findMany({
        where: {
            dueDate: {
                gte: today,
                lte: endOfDay
            },
            loan: {
                status: LoanStatus.ACTIVE
            }
        },
        select: {
            totalAmount: true,
            paidAmount: true,
            status: true
        }
    });

    // Calculate planned amount (all installments due today)
    const plannedAmount = installmentsDueToday.reduce(
        (sum, inst) => sum + Number(inst.totalAmount),
        0
    );

    // Get payments made today
    const paymentsToday = await prisma.loanPayment.findMany({
        where: {
            paymentDate: {
                gte: today,
                lte: endOfDay
            }
        },
        select: {
            amount: true
        }
    });

    const collectedAmount = paymentsToday.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
    );

    // Count missing collections (installments due today that are still pending)
    const missingCollections = installmentsDueToday.filter(
        inst => inst.status === InstallmentStatus.PENDING || inst.status === InstallmentStatus.PARTIAL
    ).length;

    // Get officers who haven't synced today
    const officersNotSynced = await prisma.staff.count({
        where: {
            status: 'ACTIVE',
            position: {
                contains: 'Officer',
                mode: 'insensitive'
            },
            collectionSessions: {
                none: {
                    startedAt: {
                        gte: today,
                        lte: endOfDay
                    }
                }
            }
        }
    });

    // Cash mismatch count (simplified - officers with variance)
    const cashMismatchCount = 0; // Would be calculated from cash reconciliation records

    const collectionRate = plannedAmount > 0 ? (collectedAmount / plannedAmount) * 100 : 0;

    return {
        plannedAmount,
        collectedAmount,
        missingCollections,
        officersNotSynced,
        cashMismatchCount,
        collectionRate
    };
};

/**
 * Get list of missing collections for today
 */
export const getMissingCollections = async (branchId?: string): Promise<MissingCollection[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const missingInstallments = await prisma.loanInstallment.findMany({
        where: {
            dueDate: {
                gte: today,
                lte: endOfDay
            },
            status: {
                in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIAL]
            },
            loan: {
                status: LoanStatus.ACTIVE,
                user: {
                    group: {
                        isActive: true
                    }
                }
            }
        },
        include: {
            loan: {
                include: {
                    user: {
                        include: {
                            group: {
                                include: {
                                    center: true
                                }
                            }
                        }
                    },
                    payments: {
                        orderBy: {
                            paymentDate: 'desc'
                        },
                        take: 1
                    }
                }
            }
        },
        take: 20 // Limit to top 20
    });

    return missingInstallments.map(inst => ({
        userId: inst.loan.userId,
        userName: inst.loan.user.fullName || 'Unknown',
        expectedAmount: Number(inst.totalAmount),
        centerName: inst.loan.user.group?.center?.name || 'Unknown',
        lastPaymentDate: inst.loan.payments[0]?.paymentDate || null
    }));
};
