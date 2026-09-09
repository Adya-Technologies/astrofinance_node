import { PrismaClient, LoanStatus, InstallmentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export interface PortfolioHealthMetrics {
    totalOutstanding: number;
    par1: number;
    par7: number;
    par30: number;
    collectionEfficiencyToday: number;
    collectionEfficiencyMTD: number;
    activeCenters: number;
    atRiskCenters: number;
}

/**
 * Calculate Portfolio at Risk (PAR) for a given number of days
 * PAR = (Outstanding principal of loans with installments overdue by X days) / Total outstanding portfolio
 */
export const calculatePAR = async (days: 1 | 7 | 30): Promise<number> => {
    const today = new Date();
    const overdueDate = new Date(today);
    overdueDate.setDate(today.getDate() - days);

    // Get all active loans with overdue installments
    const loansWithOverdueInstallments = await prisma.loan.findMany({
        where: {
            status: LoanStatus.ACTIVE,
            installments: {
                some: {
                    status: {
                        in: [InstallmentStatus.OVERDUE, InstallmentStatus.PARTIAL]
                    },
                    dueDate: {
                        lte: overdueDate
                    }
                }
            }
        },
        select: {
            outstandingPrincipal: true
        }
    });

    // Calculate total outstanding principal of overdue loans
    const overdueOutstanding = loansWithOverdueInstallments.reduce(
        (sum, loan) => sum + Number(loan.outstandingPrincipal),
        0
    );

    // Get total outstanding portfolio
    const totalOutstanding = await getTotalOutstanding();

    // Calculate PAR percentage
    return totalOutstanding > 0 ? (overdueOutstanding / totalOutstanding) * 100 : 0;
};

/**
 * Get total outstanding portfolio (sum of all active loan principals)
 */
export const getTotalOutstanding = async (): Promise<number> => {
    const result = await prisma.loan.aggregate({
        where: {
            status: LoanStatus.ACTIVE
        },
        _sum: {
            outstandingPrincipal: true
        }
    });

    return Number(result._sum.outstandingPrincipal || 0);
};

/**
 * Calculate collection efficiency for a given period
 * Collection Efficiency = (Amount Collected / Amount Expected) * 100
 */
export const getCollectionEfficiency = async (
    period: 'TODAY' | 'MTD'
): Promise<number> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (period === 'TODAY') {
        startDate = today;
    } else {
        // Month to Date
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    // Get expected collections (installments due in period)
    const expectedInstallments = await prisma.loanInstallment.findMany({
        where: {
            dueDate: {
                gte: startDate,
                lte: endDate
            },
            loan: {
                status: LoanStatus.ACTIVE
            }
        },
        select: {
            totalAmount: true
        }
    });

    const expectedAmount = expectedInstallments.reduce(
        (sum, inst) => sum + Number(inst.totalAmount),
        0
    );

    // Get actual collections (payments made in period)
    const actualPayments = await prisma.loanPayment.findMany({
        where: {
            paymentDate: {
                gte: startDate,
                lte: endDate
            }
        },
        select: {
            amount: true
        }
    });

    const collectedAmount = actualPayments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
    );

    // Calculate efficiency percentage
    return expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0;
};

/**
 * Get count of active centers vs at-risk centers
 * At-risk centers are those with PAR > threshold or low collection efficiency
 */
export const getActiveVsRiskCenters = async (): Promise<{
    activeCenters: number;
    atRiskCenters: number;
}> => {
    // Get all active centers
    const allCenters = await prisma.center.findMany({
        where: {
            isActive: true
        },
        include: {
            groups: {
                include: {
                    users: {
                        include: {
                            loans: {
                                where: {
                                    status: LoanStatus.ACTIVE
                                },
                                include: {
                                    installments: {
                                        where: {
                                            status: {
                                                in: [InstallmentStatus.OVERDUE, InstallmentStatus.PARTIAL]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const PAR_THRESHOLD = 5; // 5% PAR threshold for risk
    let atRiskCount = 0;

    // Calculate risk for each center
    for (const center of allCenters) {
        let centerTotalOutstanding = 0;
        let centerOverdueOutstanding = 0;

        // Calculate center-level PAR
        for (const group of center.groups) {
            for (const user of group.users) {
                for (const loan of user.loans) {
                    centerTotalOutstanding += Number(loan.outstandingPrincipal);

                    if (loan.installments.length > 0) {
                        centerOverdueOutstanding += Number(loan.outstandingPrincipal);
                    }
                }
            }
        }

        const centerPAR = centerTotalOutstanding > 0
            ? (centerOverdueOutstanding / centerTotalOutstanding) * 100
            : 0;

        if (centerPAR > PAR_THRESHOLD) {
            atRiskCount++;
        }
    }

    return {
        activeCenters: allCenters.length,
        atRiskCenters: atRiskCount
    };
};

/**
 * Get complete portfolio health metrics
 */
export const getPortfolioHealthMetrics = async (): Promise<PortfolioHealthMetrics> => {
    const [
        totalOutstanding,
        par1,
        par7,
        par30,
        collectionEfficiencyToday,
        collectionEfficiencyMTD,
        centerCounts
    ] = await Promise.all([
        getTotalOutstanding(),
        calculatePAR(1),
        calculatePAR(7),
        calculatePAR(30),
        getCollectionEfficiency('TODAY'),
        getCollectionEfficiency('MTD'),
        getActiveVsRiskCenters()
    ]);

    return {
        totalOutstanding,
        par1,
        par7,
        par30,
        collectionEfficiencyToday,
        collectionEfficiencyMTD,
        activeCenters: centerCounts.activeCenters,
        atRiskCenters: centerCounts.atRiskCenters
    };
};
