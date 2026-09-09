import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OfficerWithLateUpload {
    officerId: string;
    officerName: string;
    lastUploadTime: Date | null;
    hoursSinceUpload: number;
}

export interface OfficerWithGPSAnomaly {
    officerId: string;
    officerName: string;
    anomalyType: 'MISSING_GPS' | 'IMPOSSIBLE_MOVEMENT';
    details: string;
}

export interface OfficerWithCashVariance {
    officerId: string;
    officerName: string;
    variance: number;
    cashInHand: number;
    expectedCash: number;
}

export interface OfficerPerformance {
    officerId: string;
    officerName: string;
    routeCoverage: number; // percentage
    collectionRate: number; // percentage
    assignedCenters: number;
    visitedCenters: number;
    totalCollected: number;
    expectedCollection: number;
}

/**
 * Get officers who haven't uploaded data within threshold hours
 */
export const getLateUploads = async (thresholdHours: number = 24): Promise<OfficerWithLateUpload[]> => {
    const cutoffTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    const allOfficers = await prisma.staff.findMany({
        where: {
            status: 'ACTIVE',
            position: {
                contains: 'Officer',
                mode: 'insensitive'
            }
        },
        include: {
            collectionSessions: {
                orderBy: {
                    startedAt: 'desc'
                },
                take: 1
            }
        }
    });

    const lateOfficers: OfficerWithLateUpload[] = [];

    for (const officer of allOfficers) {
        const lastSession = officer.collectionSessions[0];
        const lastUploadTime = lastSession?.startedAt || null;

        if (!lastUploadTime || lastUploadTime < cutoffTime) {
            const hoursSinceUpload = lastUploadTime
                ? (Date.now() - lastUploadTime.getTime()) / (1000 * 60 * 60)
                : 999;

            lateOfficers.push({
                officerId: officer.id,
                officerName: `${officer.firstName} ${officer.lastName}`,
                lastUploadTime,
                hoursSinceUpload: Math.round(hoursSinceUpload)
            });
        }
    }

    return lateOfficers;
};

/**
 * Detect GPS anomalies (missing GPS data or impossible movements)
 */
export const getGPSAnomalies = async (): Promise<OfficerWithGPSAnomaly[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await prisma.collectionSession.findMany({
        where: {
            startedAt: {
                gte: today
            }
        },
        include: {
            staff: true
        },
        orderBy: {
            startedAt: 'asc'
        }
    });

    const anomalies: OfficerWithGPSAnomaly[] = [];
    const officerLastLocation: Map<string, { lat: number; lng: number; time: Date }> = new Map();

    for (const session of sessions) {
        const officerId = session.staffId;
        const officerName = `${session.staff.firstName} ${session.staff.lastName}`;

        // Check for missing GPS
        if (!session.latitude || !session.longitude) {
            anomalies.push({
                officerId,
                officerName,
                anomalyType: 'MISSING_GPS',
                details: `Session at ${session.startedAt.toLocaleTimeString()} has no GPS data`
            });
            continue;
        }

        // Check for impossible movement
        const lastLoc = officerLastLocation.get(officerId);
        if (lastLoc) {
            const distance = calculateDistance(
                Number(lastLoc.lat),
                Number(lastLoc.lng),
                Number(session.latitude),
                Number(session.longitude)
            );

            const timeDiff = (session.startedAt.getTime() - lastLoc.time.getTime()) / (1000 * 60 * 60); // hours
            const speed = distance / timeDiff; // km/h

            // Flag if speed > 100 km/h (impossible for field officers on bikes/foot)
            if (speed > 100) {
                anomalies.push({
                    officerId,
                    officerName,
                    anomalyType: 'IMPOSSIBLE_MOVEMENT',
                    details: `Traveled ${distance.toFixed(1)}km in ${timeDiff.toFixed(1)}h (${speed.toFixed(0)}km/h)`
                });
            }
        }

        // Update last location
        officerLastLocation.set(officerId, {
            lat: Number(session.latitude),
            lng: Number(session.longitude),
            time: session.startedAt
        });
    }

    return anomalies;
};

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
};

/**
 * Get officers with cash-in-hand variance
 */
export const getCashVariances = async (): Promise<OfficerWithCashVariance[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const officers = await prisma.staff.findMany({
        where: {
            status: 'ACTIVE',
            position: {
                contains: 'Officer',
                mode: 'insensitive'
            }
        },
        include: {
            collectionSessions: {
                where: {
                    startedAt: {
                        gte: today
                    }
                },
                include: {
                    entries: true
                }
            }
        }
    });

    const variances: OfficerWithCashVariance[] = [];

    for (const officer of officers) {
        let totalCollected = 0;

        for (const session of officer.collectionSessions) {
            for (const entry of session.entries) {
                totalCollected += Number(entry.amount);
            }
        }

        // In a real system, compare with cash deposit records
        // For now, assume expected cash = collected (variance would come from deposits not matching)
        const expectedCash = totalCollected;
        const cashInHand = totalCollected; // Placeholder - would check actual cash deposits
        const variance = cashInHand - expectedCash;

        // Flag if variance > threshold (e.g., 1000)
        if (Math.abs(variance) > 1000) {
            variances.push({
                officerId: officer.id,
                officerName: `${officer.firstName} ${officer.lastName}`,
                variance,
                cashInHand,
                expectedCash
            });
        }
    }

    return variances;
};

/**
 * Get performance metrics for a specific officer
 */
export const getOfficerPerformance = async (officerId: string): Promise<OfficerPerformance | null> => {
    const officer = await prisma.staff.findUnique({
        where: { id: officerId },
        include: {
            centers: true,
            collectionSessions: {
                where: {
                    startedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                },
                include: {
                    entries: true,
                    center: true
                }
            }
        }
    });

    if (!officer) return null;

    const assignedCenters = officer.centers.length;
    const visitedCenterIds = new Set(officer.collectionSessions.map(s => s.centerId));
    const visitedCenters = visitedCenterIds.size;

    let totalCollected = 0;
    for (const session of officer.collectionSessions) {
        for (const entry of session.entries) {
            totalCollected += Number(entry.amount);
        }
    }

    // Calculate expected collection (simplified - would use actual EMI schedules)
    const expectedCollection = assignedCenters * 50000; // Placeholder

    return {
        officerId: officer.id,
        officerName: `${officer.firstName} ${officer.lastName}`,
        routeCoverage: assignedCenters > 0 ? (visitedCenters / assignedCenters) * 100 : 0,
        collectionRate: expectedCollection > 0 ? (totalCollected / expectedCollection) * 100 : 0,
        assignedCenters,
        visitedCenters,
        totalCollected,
        expectedCollection
    };
};
