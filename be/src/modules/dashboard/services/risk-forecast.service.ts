import { PrismaClient, InstallmentStatus, LoanStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface RiskForecast {
    expectedDefaults30Days: number;
    centersAtRiskPAR7: number;
    branchRiskScore?: number;
}

/**
 * Predict number of expected defaults in next N days
 * Based on overdue patterns and payment history
 */
export const predictDefaults = async (days: number = 30): Promise<number> => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    // Get loans with installments due in the next N days
    const upcomingInstallments = await prisma.loanInstallment.findMany({
        where: {
            dueDate: {
                gte: today,
                lte: futureDate
            },
            status: InstallmentStatus.PENDING,
            loan: {
                status: LoanStatus.ACTIVE
            }
        },
        include: {
            loan: {
                include: {
                    installments: {
                        where: {
                            status: {
                                in: [InstallmentStatus.OVERDUE, InstallmentStatus.PARTIAL]
                            }
                        }
                    },
                    user: {
                        include: {
                            attendance: {
                                where: {
                                    createdAt: {
                                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                                    }
                                },
                                select: {
                                    status: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    let expectedDefaults = 0;

    for (const installment of upcomingInstallments) {
        const loan = installment.loan;
        let riskScore = 0;

        // Factor 1: Current overdue count (weight: 40%)
        const overdueCount = loan.installments.length;
        if (overdueCount > 0) riskScore += 40;
        if (overdueCount > 2) riskScore += 20; // Extra penalty for multiple overdues

        // Factor 2: Attendance rate (weight: 30%)
        const attendanceRecords = loan.user.attendance;
        if (attendanceRecords.length > 0) {
            const presentCount = attendanceRecords.filter(a => a.status === 'PRESENT').length;
            const attendanceRate = (presentCount / attendanceRecords.length) * 100;

            if (attendanceRate < 50) riskScore += 30;
            else if (attendanceRate < 70) riskScore += 15;
        }

        // Factor 3: Payment history (weight: 30%)
        const paidInstallments = await prisma.loanInstallment.count({
            where: {
                loanId: loan.id,
                status: InstallmentStatus.PAID
            }
        });

        const totalInstallments = await prisma.loanInstallment.count({
            where: {
                loanId: loan.id
            }
        });

        const paymentRate = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 100;

        if (paymentRate < 50) riskScore += 30;
        else if (paymentRate < 70) riskScore += 15;

        // If risk score > 50%, count as expected default
        if (riskScore > 50) {
            expectedDefaults++;
        }
    }

    return expectedDefaults;
};

/**
 * Get centers at risk of slipping into PAR 7
 * These are centers currently in PAR 1-6 with worsening trends
 */
export const getCentersAtRiskPAR7 = async (): Promise<number> => {
    const today = new Date();
    const date6DaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    const date1DayAgo = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);

    // Get all centers
    const centers = await prisma.center.findMany({
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

    let atRiskCount = 0;

    for (const center of centers) {
        let hasRecentOverdue = false; // Overdue in last 1-6 days
        let hasLoansNearing7Days = false;

        for (const group of center.groups) {
            for (const user of group.users) {
                for (const loan of user.loans) {
                    for (const installment of loan.installments) {
                        const overdueDays = Math.floor(
                            (today.getTime() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        // Check if overdue between 1-6 days
                        if (overdueDays >= 1 && overdueDays < 7) {
                            hasRecentOverdue = true;
                        }

                        // Check if installment is about to hit 7 days
                        if (overdueDays >= 5 && overdueDays < 7) {
                            hasLoansNearing7Days = true;
                        }
                    }
                }
            }
        }

        // Center is at risk if it has recent overdues and loans nearing 7 days
        if (hasRecentOverdue && hasLoansNearing7Days) {
            atRiskCount++;
        }
    }

    return atRiskCount;
};

/**
 * Calculate aggregate risk score for a branch
 */
export const getBranchRiskScore = async (branchId?: string): Promise<number> => {
    // In a real system, filter by branch
    // For now, calculate overall risk score

    // First, get total outstanding
    const totalOutstandingResult = await prisma.loan.aggregate({
        where: { status: LoanStatus.ACTIVE },
        _sum: { outstandingPrincipal: true }
    });

    const totalOutstanding = Number(totalOutstandingResult._sum.outstandingPrincipal || 0);

    // Then get other metrics
    const [
        par30Value,
        expectedDefaults,
        centersAtRisk
    ] = await Promise.all([
        // Get PAR 30 percentage
        (async (): Promise<number> => {
            const overdueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const loansWithOverdue = await prisma.loan.findMany({
                where: {
                    status: LoanStatus.ACTIVE,
                    installments: {
                        some: {
                            status: { in: [InstallmentStatus.OVERDUE, InstallmentStatus.PARTIAL] },
                            dueDate: { lte: overdueDate }
                        }
                    }
                },
                select: { outstandingPrincipal: true }
            });

            const overdueSum = loansWithOverdue.reduce((sum, l) => sum + Number(l.outstandingPrincipal), 0);
            return totalOutstanding > 0 ? (overdueSum / totalOutstanding) * 100 : 0;
        })(),
        predictDefaults(30),
        getCentersAtRiskPAR7()
    ]);

    // Calculate weighted risk score (0-100)
    let riskScore = 0;

    // PAR 30 (weight: 40%)
    if (par30Value > 10) riskScore += 40;
    else if (par30Value > 5) riskScore += 25;
    else if (par30Value > 2) riskScore += 10;

    // Expected defaults (weight: 30%)
    if (expectedDefaults > 20) riskScore += 30;
    else if (expectedDefaults > 10) riskScore += 20;
    else if (expectedDefaults > 5) riskScore += 10;

    // Centers at risk (weight: 30%)
    if (centersAtRisk > 10) riskScore += 30;
    else if (centersAtRisk > 5) riskScore += 20;
    else if (centersAtRisk > 2) riskScore += 10;

    return riskScore;
};

/**
 * Get complete risk forecast
 */
export const getRiskForecast = async (branchId?: string): Promise<RiskForecast> => {
    const [expectedDefaults30Days, centersAtRiskPAR7, branchRiskScore] = await Promise.all([
        predictDefaults(30),
        getCentersAtRiskPAR7(),
        getBranchRiskScore(branchId)
    ]);

    return {
        expectedDefaults30Days,
        centersAtRiskPAR7,
        branchRiskScore
    };
};
