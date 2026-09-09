import { PrismaClient, InstallmentStatus, LoanStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CenterWatchlistItem {
    centerId: string;
    centerName: string;
    issue: 'ABSENCE_STREAK' | 'REPAYMENT_DECAY' | 'MULTIPLE_RESCHEDULES';
    severity: 'high' | 'medium' | 'low';
    details: string;
    lastMeetingDate: Date | null;
    assignedOfficer: string;
    suggestedAction: string;
}

/**
 * Get centers with absence streaks (consecutive meetings with low attendance)
 */
const getCentersWithAbsenceStreaks = async (): Promise<CenterWatchlistItem[]> => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const centers = await prisma.center.findMany({
        where: {
            isActive: true,
            sessions: {
                some: {
                    startedAt: {
                        gte: fourteenDaysAgo
                    }
                }
            }
        },
        include: {
            staff: true,
            sessions: {
                where: {
                    startedAt: {
                        gte: fourteenDaysAgo
                    }
                },
                include: {
                    attendance: true
                },
                orderBy: {
                    startedAt: 'desc'
                },
                take: 4 // Last 4 sessions
            }
        }
    });

    const watchlistItems: CenterWatchlistItem[] = [];

    for (const center of centers) {
        if (center.sessions.length < 2) continue;

        // Calculate average attendance rate
        let totalAttendance = 0;
        let totalMembers = 0;

        for (const session of center.sessions) {
            totalMembers += session.attendance.length;
            totalAttendance += session.attendance.filter(a => a.status === 'PRESENT').length;
        }

        const attendanceRate = totalMembers > 0 ? (totalAttendance / totalMembers) * 100 : 100;

        // Flag if attendance rate < 70%
        if (attendanceRate < 70) {
            watchlistItems.push({
                centerId: center.id,
                centerName: center.name,
                issue: 'ABSENCE_STREAK',
                severity: attendanceRate < 50 ? 'high' : attendanceRate < 60 ? 'medium' : 'low',
                details: `Attendance rate: ${attendanceRate.toFixed(1)}% over last ${center.sessions.length} meetings`,
                lastMeetingDate: center.sessions[0]?.startedAt || null,
                assignedOfficer: center.staff ? `${center.staff.firstName} ${center.staff.lastName}` : 'Unassigned',
                suggestedAction: 'Schedule home visits for absent members'
            });
        }
    }

    return watchlistItems;
};

/**
 * Get centers with repayment decay (deteriorating payment performance)
 */
const getCentersWithRepaymentDecay = async (): Promise<CenterWatchlistItem[]> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const centers = await prisma.center.findMany({
        where: {
            isActive: true
        },
        include: {
            staff: true,
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
            },
            sessions: {
                orderBy: {
                    startedAt: 'desc'
                },
                take: 1
            }
        }
    });

    const watchlistItems: CenterWatchlistItem[] = [];

    for (const center of centers) {
        let overdueCount30d = 0;
        let overdueCount60d = 0;

        for (const group of center.groups) {
            for (const user of group.users) {
                for (const loan of user.loans) {
                    for (const inst of loan.installments) {
                        const daysOverdue = Math.floor(
                            (Date.now() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        if (daysOverdue <= 30) overdueCount30d++;
                        if (daysOverdue <= 60) overdueCount60d++;
                    }
                }
            }
        }

        // Repayment is decaying if recent overdues increased
        const isDecaying = overdueCount30d > overdueCount60d * 0.5; // 30-day overdues > 50% of 60-day

        if (isDecaying && overdueCount30d > 2) {
            watchlistItems.push({
                centerId: center.id,
                centerName: center.name,
                issue: 'REPAYMENT_DECAY',
                severity: overdueCount30d > 5 ? 'high' : 'medium',
                details: `${overdueCount30d} overdue installments in last 30 days`,
                lastMeetingDate: center.sessions[0]?.startedAt || null,
                assignedOfficer: center.staff ? `${center.staff.firstName} ${center.staff.lastName}` : 'Unassigned',
                suggestedAction: 'Review loan terms and consider restructuring'
            });
        }
    }

    return watchlistItems;
};

/**
 * Get centers with multiple reschedules
 */
const getCentersWithMultipleReschedules = async (): Promise<CenterWatchlistItem[]> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // In a real system, track reschedules in a separate table
    // For now, we'll use overdue installments as a proxy
    const centers = await prisma.center.findMany({
        where: {
            isActive: true,
            groups: {
                some: {
                    users: {
                        some: {
                            loans: {
                                some: {
                                    status: LoanStatus.ACTIVE,
                                    updatedAt: {
                                        gte: thirtyDaysAgo
                                    },
                                    installments: {
                                        some: {
                                            status: InstallmentStatus.OVERDUE
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        include: {
            staff: true,
            groups: {
                include: {
                    users: {
                        include: {
                            loans: {
                                where: {
                                    status: LoanStatus.ACTIVE,
                                    updatedAt: {
                                        gte: thirtyDaysAgo
                                    }
                                }
                            }
                        }
                    }
                }
            },
            sessions: {
                orderBy: {
                    startedAt: 'desc'
                },
                take: 1
            }
        },
        take: 10
    });

    return centers.map(center => {
        const rescheduleCount = center.groups.reduce((total, group) =>
            total + group.users.reduce((sum, user) => sum + user.loans.length, 0)
            , 0);

        return {
            centerId: center.id,
            centerName: center.name,
            issue: 'MULTIPLE_RESCHEDULES',
            severity: rescheduleCount > 5 ? 'high' : rescheduleCount > 3 ? 'medium' : 'low',
            details: `${rescheduleCount} potential reschedules in last 30 days`,
            lastMeetingDate: center.sessions[0]?.startedAt || null,
            assignedOfficer: center.staff ? `${center.staff.firstName} ${center.staff.lastName}` : 'Unassigned',
            suggestedAction: 'Investigate root cause and tighten approval criteria'
        };
    });
};

/**
 * Get complete center watchlist
 */
export const getCenterWatchlist = async (branchId?: string): Promise<CenterWatchlistItem[]> => {
    const [absenceStreaks, repaymentDecay, multipleReschedules] = await Promise.all([
        getCentersWithAbsenceStreaks(),
        getCentersWithRepaymentDecay(),
        getCentersWithMultipleReschedules()
    ]);

    // Combine and sort by severity
    const allItems = [...absenceStreaks, ...repaymentDecay, ...multipleReschedules];

    return allItems.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
};
