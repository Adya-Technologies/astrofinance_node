import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ComplianceMetrics {
    daysSinceReconciliation: number;
    unpostedJournals: number;
    auditExceptions: number;
    nrbReportReadiness: NRBReportReadiness;
}

export interface NRBReportReadiness {
    status: 'READY' | 'INCOMPLETE';
    missingItems: string[];
}

/**
 * Get days since last successful reconciliation
 */
export const getDaysSinceLastReconciliation = async (): Promise<number> => {
    const lastReconciliation = await prisma.dayBook.findFirst({
        where: {
            isReconciled: true,
            isClosed: true
        },
        orderBy: {
            transactionDate: 'desc'
        }
    });

    if (!lastReconciliation) {
        return 999; // No reconciliation found
    }

    const daysDiff = Math.floor(
        (Date.now() - lastReconciliation.transactionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysDiff;
};

/**
 * Get count of unposted journal entries
 */
export const getUnpostedJournals = async (): Promise<number> => {
    const count = await prisma.journalEntry.count({
        where: {
            status: 'DRAFT'
        }
    });

    return count;
};

/**
 * Get audit exceptions count
 * These are flagged transactions that need review
 */
export const getAuditExceptions = async (): Promise<number> => {
    // Check for various audit red flags

    const promises = [
        // 1. Day books with discrepancies
        prisma.dayBook.count({
            where: {
                discrepancyAmount: {
                    not: null
                },
                NOT: {
                    discrepancyAmount: 0
                }
            }
        }),

        // 2. Large transactions without approval (> 100,000)
        prisma.expense.count({
            where: {
                totalAmount: {
                    gt: 100000
                },
                status: 'PENDING'
            }
        }),

        // 3. Loan payments without proper journal entries
        prisma.loanPayment.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                },
                receivedById: null // No receiver recorded
            }
        }),

        // 4. User transactions with missing journal entries
        prisma.userAccountTransaction.count({
            where: {
                journalEntryId: null,
                transactionDate: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            }
        })
    ];

    const results = await Promise.all(promises);
    const totalExceptions = results.reduce((sum, count) => sum + count, 0);

    return totalExceptions;
};

/**
 * Check NRB (Nepal Rastra Bank) report readiness
 */
export const getNRBReportReadiness = async (): Promise<NRBReportReadiness> => {
    const missingItems: string[] = [];

    // Check if there are any loans without proper classification
    const loansWithoutProvision = await prisma.loan.count({
        where: {
            status: 'ACTIVE',
            provisions: {
                none: {}
            }
        }
    });

    if (loansWithoutProvision > 0) {
        missingItems.push(`${loansWithoutProvision} active loans without loss provisioning classification`);
    }

    // Check if all TDS is calculated for the current month
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const interestTransactions = await prisma.userAccountTransaction.count({
        where: {
            transactionType: 'INTEREST_CREDIT',
            transactionDate: {
                gte: currentMonthStart
            }
        }
    });

    const tdsCalculations = await prisma.tdsCalculation.count({
        where: {
            calculationDate: {
                gte: currentMonthStart
            }
        }
    });

    if (interestTransactions > tdsCalculations) {
        missingItems.push(`${interestTransactions - tdsCalculations} interest transactions without TDS calculation`);
    }

    // Check if chart of accounts is balanced
    const journalEntries = await prisma.journalEntry.findMany({
        where: {
            status: 'POSTED',
            entryDate: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        },
        include: {
            journalEntryLines: true
        }
    });

    let unbalancedEntries = 0;
    for (const entry of journalEntries) {
        const totalDebit = entry.journalEntryLines.reduce(
            (sum, line) => sum + Number(line.debitAmount),
            0
        );
        const totalCredit = entry.journalEntryLines.reduce(
            (sum, line) => sum + Number(line.creditAmount),
            0
        );

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            unbalancedEntries++;
        }
    }

    if (unbalancedEntries > 0) {
        missingItems.push(`${unbalancedEntries} unbalanced journal entries`);
    }

    // Check if fiscal year is properly set
    const currentFiscalYear = await prisma.fiscalYear.findFirst({
        where: {
            isCurrent: true
        }
    });

    if (!currentFiscalYear) {
        missingItems.push('No current fiscal year set');
    }

    return {
        status: missingItems.length === 0 ? 'READY' : 'INCOMPLETE',
        missingItems
    };
};

/**
 * Get complete compliance metrics
 */
export const getComplianceMetrics = async (): Promise<ComplianceMetrics> => {
    const [
        daysSinceReconciliation,
        unpostedJournals,
        auditExceptions,
        nrbReportReadiness
    ] = await Promise.all([
        getDaysSinceLastReconciliation(),
        getUnpostedJournals(),
        getAuditExceptions(),
        getNRBReportReadiness()
    ]);

    return {
        daysSinceReconciliation,
        unpostedJournals,
        auditExceptions,
        nrbReportReadiness
    };
};
