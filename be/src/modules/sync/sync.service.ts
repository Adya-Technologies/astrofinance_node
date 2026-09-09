import prisma from '../../config/database';
import { createJournalEntryForUserTransaction } from '../user/utils/journal-entry-mapping.util';

export const downloadData = async (userId: string) => {
    // Find staff associated with the user/admin
    // Assuming the userId passed is the AdminUser ID, we need to find the Staff record linked to it?
    // Or if userId is Staff ID?
    // For now, let's assume the user is authenticated as an AdminUser who is a Staff.
    // We need to find the Staff ID.

    // Implementation note: Ideally we link AdminUser to Staff.
    // For Phase 1, we'll fetch ALL accessible data or data for a specific staff if provided.

    // Let's assume the request comes with specific staffId query param or we deduce it.
    // For MVP, return all Centers and Groups for now, or filter by Staff if we can.

    // Fetch Centers (and their Groups) assigned to this staff or all active ones
    const centers = await prisma.center.findMany({
        where: { isActive: true },
        include: {
            groups: {
                where: { isActive: true },
                include: {
                    users: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            fullName: true,
                            contactNumber: true,
                            // Include recent or expected installment info?
                            // For now, basic account info
                            accounts: {
                                where: { status: 'ACTIVE' },
                                select: { id: true, accountNumber: true, accountType: true, balance: true }
                            }
                        }
                    }
                }
            }
        }
    });

    return { centers };
};

export const uploadData = async (data: any) => {
    const { session, entries, attendance } = data;

    const stats = {
        session: { status: 'PENDING' as 'ADDED' | 'SKIPPED' | 'PENDING', id: '' },
        entries: { added: 0, skipped: 0, transactionsCreated: 0 },
        attendance: { added: 0, skipped: 0 }
    };

    // Wrap entire upload in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
        // 1. Create or Find Collection Session
        let collectionSession = await tx.collectionSession.findFirst({
            where: { offlineId: session.id }
        });

        if (!collectionSession) {
            collectionSession = await tx.collectionSession.create({
                data: {
                    staffId: session.staffId,
                    centerId: session.centerId,
                    startedAt: session.startedAt,
                    endedAt: session.endedAt,
                    status: 'SUBMITTED',
                    offlineId: session.id,
                    latitude: session.latitude,
                    longitude: session.longitude
                }
            });
            stats.session.status = 'ADDED';
        } else {
            stats.session.status = 'SKIPPED';
        }
        stats.session.id = collectionSession.id;

        // 2. Process Entries with Account Transaction Integration
        if (entries && Array.isArray(entries)) {
            for (const entry of entries) {
                const existing = await tx.collectionEntry.findFirst({
                    where: { offlineId: entry.id }
                });

                if (!existing) {
                    // Create collection entry
                    await tx.collectionEntry.create({
                        data: {
                            sessionId: collectionSession.id,
                            userId: entry.userId,
                            accountId: entry.accountId,
                            transactionType: entry.transactionType,
                            amount: entry.amount,
                            notes: entry.notes,
                            collectedAt: entry.collectedAt,
                            isSynced: true,
                            offlineId: entry.id,
                            latitude: entry.latitude,
                            longitude: entry.longitude
                        }
                    });
                    stats.entries.added++;

                    // **NEW: Post to Account if accountId is provided**
                    if (entry.accountId) {
                        // Fetch current account balance
                        const account = await tx.userAccount.findUnique({
                            where: { id: entry.accountId }
                        });

                        if (account) {
                            const amount = parseFloat(entry.amount.toString());
                            const newBalance = parseFloat(account.balance.toString()) + amount;

                            // Create account transaction
                            const accountTransaction = await tx.userAccountTransaction.create({
                                data: {
                                    accountId: entry.accountId,
                                    amount: amount,
                                    transactionType: entry.transactionType === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAWAL',
                                    transactionDate: new Date(entry.collectedAt),
                                    description: `Field collection - ${entry.notes || 'Collection'}`,
                                    referenceNumber: entry.id, // Use offlineId as reference
                                    runningBalance: newBalance
                                }
                            });

                            // **NEW: Create corresponding Journal Entry for double-entry accounting**
                            try {
                                const journalEntryId = await createJournalEntryForUserTransaction(
                                    {
                                        id: accountTransaction.id,
                                        transactionType: accountTransaction.transactionType,
                                        amount: accountTransaction.amount,
                                        description: accountTransaction.description,
                                        referenceNumber: accountTransaction.referenceNumber,
                                        transactionDate: accountTransaction.transactionDate
                                    },
                                    session.staffId // Now staffId is valid since JournalEntry uses Staff
                                );

                                // Link journal entry to transaction
                                await tx.userAccountTransaction.update({
                                    where: { id: accountTransaction.id },
                                    data: { journalEntryId }
                                });

                                console.log(`Created journal entry ${journalEntryId} for collection ${entry.id}`);
                            } catch (journalError) {
                                console.error('Error creating journal entry for collection:', journalError);
                                // Don't fail the entire upload if journal entry creation fails
                                // The transaction record still exists for reconciliation
                            }

                            // Update account balance
                            await tx.userAccount.update({
                                where: { id: entry.accountId },
                                data: {
                                    balance: newBalance,
                                    lastTransactionDate: new Date(entry.collectedAt)
                                }
                            });

                            stats.entries.transactionsCreated++;
                        } else {
                            console.warn(`Account not found for entry: ${entry.id}`);
                        }
                    }
                } else {
                    stats.entries.skipped++;
                }
            }
        }

        // 3. Process Attendance
        if (attendance && Array.isArray(attendance)) {
            for (const att of attendance) {
                const existing = await tx.collectionAttendance.findFirst({
                    where: { offlineId: att.id }
                });

                if (!existing) {
                    await tx.collectionAttendance.create({
                        data: {
                            sessionId: collectionSession.id,
                            userId: att.userId,
                            status: att.status,
                            notes: att.notes,
                            offlineId: att.id
                        }
                    });
                    stats.attendance.added++;
                } else {
                    stats.attendance.skipped++;
                }
            }
        }
    });

    return {
        success: true,
        sessionId: stats.session.id,
        processedEntries: stats.entries.added,
        processedAttendance: stats.attendance.added,
        stats
    };
};
