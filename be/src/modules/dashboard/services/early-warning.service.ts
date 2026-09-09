import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DeterioratingCenter {
    centerId: string;
    centerName: string;
    trendScore: number;
    reasons: string[];
    lastMeetingDate: Date | null;
    assignedOfficer: string;
}

interface CenterMetrics {
    centerId: string;
    centerName: string;
    attendanceRate30d: number;
    attendanceRate60d: number;
    partialPaymentRate30d: number;
    partialPaymentRate60d: number;
    rescheduleCount30d: number;
    rescheduleCount60d: number;
    lastMeetingDate: Date | null;
    assignedOfficer: string;
}

/**
 * Calculate attendance rate for a center in a given time window
 */
const calculateAttendanceRate = async (
    centerId: string,
    startDate: Date,
    endDate: Date
): Promise<number> => {
    const sessions = await prisma.collectionSession.findMany({
        where: {
            centerId,
            startedAt: {
                gte: startDate,
                lte: endDate
            }
        },
        include: {
            attendance: true
        }
    });

    if (sessions.length === 0) return 100; // No sessions = no data, assume OK

    let totalMembers = 0;
    let presentCount = 0;

    for (const session of sessions) {
        totalMembers += session.attendance.length;
        presentCount += session.attendance.filter(a => a.status === 'PRESENT').length;
    }

    return totalMembers > 0 ? (presentCount / totalMembers) * 100 : 100;
};

/**
 * Calculate partial payment rate for a center in a given time window
 */
const calculatePartialPaymentRate = async (
    centerId: string,
    startDate: Date,
    endDate: Date
): Promise<number> => {
    const sessions = await prisma.collectionSession.findMany({
        where: {
            centerId,
            startedAt: {
                gte: startDate,
                lte: endDate
            }
        },
        include: {
            entries: true
        }
    });

    if (sessions.length === 0) return 0;

    let totalCollections = 0;
    let partialCollections = 0;

    for (const session of sessions) {
        for (const entry of session.entries) {
            if (entry.transactionType === 'LOAN_REPAYMENT') {
                totalCollections++;

                // Check if this is a partial payment (less than expected EMI)
                // This is simplified - in production, compare with actual EMI amount
                const amount = Number(entry.amount);
                if (amount > 0 && amount < 1000) { // Placeholder logic
                    partialCollections++;
                }
            }
        }
    }

    return totalCollections > 0 ? (partialCollections / totalCollections) * 100 : 0;
};

/**
 * Count reschedules for a center in a given time window
 */
const countReschedules = async (
    centerId: string,
    startDate: Date,
    endDate: Date
): Promise<number> => {
    // Get all users in this center's groups
    const center = await prisma.center.findUnique({
        where: { id: centerId },
        include: {
            groups: {
                include: {
                    users: {
                        include: {
                            loans: {
                                where: {
                                    updatedAt: {
                                        gte: startDate,
                                        lte: endDate
                                    }
                                },
                                include: {
                                    installments: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!center) return 0;

    let rescheduleCount = 0;

    // Count installments that were rescheduled (simplified logic)
    for (const group of center.groups) {
        for (const user of group.users) {
            for (const loan of user.loans) {
                // In a real implementation, track reschedules via audit logs or status changes
                // For now, count overdue installments as potential reschedules
                rescheduleCount += loan.installments.filter(i => i.status === 'OVERDUE').length;
            }
        }
    }

    return rescheduleCount;
};

/**
 * Get metrics for a center across different time windows
 */
const getCenterMetrics = async (centerId: string): Promise<CenterMetrics | null> => {
    const center = await prisma.center.findUnique({
        where: { id: centerId },
        include: {
            staff: true,
            sessions: {
                orderBy: { startedAt: 'desc' },
                take: 1
            }
        }
    });

    if (!center) return null;

    const now = new Date();
    const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const date60DaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
        attendanceRate30d,
        attendanceRate60d,
        partialPaymentRate30d,
        partialPaymentRate60d,
        rescheduleCount30d,
        rescheduleCount60d
    ] = await Promise.all([
        calculateAttendanceRate(centerId, date30DaysAgo, now),
        calculateAttendanceRate(centerId, date60DaysAgo, now),
        calculatePartialPaymentRate(centerId, date30DaysAgo, now),
        calculatePartialPaymentRate(centerId, date60DaysAgo, now),
        countReschedules(centerId, date30DaysAgo, now),
        countReschedules(centerId, date60DaysAgo, now)
    ]);

    return {
        centerId: center.id,
        centerName: center.name,
        attendanceRate30d,
        attendanceRate60d,
        partialPaymentRate30d,
        partialPaymentRate60d,
        rescheduleCount30d,
        rescheduleCount60d,
        lastMeetingDate: center.sessions[0]?.startedAt || null,
        assignedOfficer: center.staff?.firstName + ' ' + center.staff?.lastName || 'Unassigned'
    };
};

/**
 * Calculate trend score for a center
 * Higher score = more deterioration
 */
const calculateTrendScore = (metrics: CenterMetrics): number => {
    let score = 0;

    // Attendance declining (weight: 40%)
    const attendanceTrend = metrics.attendanceRate30d - metrics.attendanceRate60d;
    if (attendanceTrend < -5) score += 40; // Drop of >5%
    else if (attendanceTrend < 0) score += 20; // Any decline

    // Partial payments increasing (weight: 30%)
    const partialPaymentTrend = metrics.partialPaymentRate30d - metrics.partialPaymentRate60d;
    if (partialPaymentTrend > 5) score += 30; // Increase of >5%
    else if (partialPaymentTrend > 0) score += 15; // Any increase

    // Reschedules spiking (weight: 30%)
    const rescheduleTrend = metrics.rescheduleCount30d - (metrics.rescheduleCount60d - metrics.rescheduleCount30d);
    if (rescheduleTrend > 3) score += 30; // 3+ more reschedules
    else if (rescheduleTrend > 0) score += 15; // Any increase

    return score;
};

/**
 * Determine deterioration reasons based on metrics
 */
const getReasons = (metrics: CenterMetrics): string[] => {
    const reasons: string[] = [];

    const attendanceTrend = metrics.attendanceRate30d - metrics.attendanceRate60d;
    if (attendanceTrend < -5) {
        reasons.push('attendance_drop');
    }

    const partialPaymentTrend = metrics.partialPaymentRate30d - metrics.partialPaymentRate60d;
    if (partialPaymentTrend > 5) {
        reasons.push('partial_payments_rising');
    }

    const rescheduleTrend = metrics.rescheduleCount30d - (metrics.rescheduleCount60d - metrics.rescheduleCount30d);
    if (rescheduleTrend > 2) {
        reasons.push('reschedules_spike');
    }

    // Officer anomaly detection (simplified)
    if (metrics.lastMeetingDate) {
        const daysSinceLastMeeting = (Date.now() - metrics.lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastMeeting > 14) {
            reasons.push('officer_anomaly');
        }
    }

    return reasons;
};

/**
 * Get top N deteriorating centers based on trend analysis
 * This is the "killer feature" - Early Warning Radar
 */
export const getDeterioratingCenters = async (limit: number = 5): Promise<DeterioratingCenter[]> => {
    // Get all active centers
    const centers = await prisma.center.findMany({
        where: {
            isActive: true
        },
        select: {
            id: true
        }
    });

    // Calculate metrics and scores for all centers
    const centerScores: DeterioratingCenter[] = [];

    for (const center of centers) {
        const metrics = await getCenterMetrics(center.id);

        if (!metrics) continue;

        const trendScore = calculateTrendScore(metrics);

        // Only include centers with deterioration (score > 0)
        if (trendScore > 0) {
            centerScores.push({
                centerId: metrics.centerId,
                centerName: metrics.centerName,
                trendScore,
                reasons: getReasons(metrics),
                lastMeetingDate: metrics.lastMeetingDate,
                assignedOfficer: metrics.assignedOfficer
            });
        }
    }

    // Sort by trend score (worst first) and return top N
    return centerScores
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, limit);
};

/**
 * Analyze a specific center's trend
 */
export const analyzeCenterTrend = async (centerId: string): Promise<DeterioratingCenter | null> => {
    const metrics = await getCenterMetrics(centerId);

    if (!metrics) return null;

    const trendScore = calculateTrendScore(metrics);

    return {
        centerId: metrics.centerId,
        centerName: metrics.centerName,
        trendScore,
        reasons: getReasons(metrics),
        lastMeetingDate: metrics.lastMeetingDate,
        assignedOfficer: metrics.assignedOfficer
    };
};
