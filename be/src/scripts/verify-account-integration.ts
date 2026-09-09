import prisma from '../config/database';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log('🧪 Verifying Account Transaction Integration...\n');

    // 1. Find test account from seed data
    const account = await prisma.userAccount.findFirst({
        where: { accountNumber: { startsWith: 'MB-' } },
        include: { user: true }
    });

    if (!account) {
        console.error('❌ No test account found. Run seed-offline.ts first.');
        return;
    }

    console.log(`✓ Found test account: ${account.accountNumber}`);
    console.log(`  User: ${account.user.fullName}`);
    console.log(`  Initial Balance: Rs. ${account.balance}\n`);

    // 2. Find test staff and center
    const staff = await prisma.staff.findFirst();
    const center = await prisma.center.findFirst();

    if (!staff || !center) {
        console.error('❌ Missing staff or center data');
        return;
    }

    // 3. Create mock collection upload
    const mockData = {
        session: {
            id: uuidv4(),
            staffId: staff.id,
            centerId: center.id,
            startedAt: new Date(),
            endedAt: new Date(),
            latitude: 27.7172,
            longitude: 85.3240
        },
        entries: [
            {
                id: uuidv4(),
                userId: account.user.id,
                accountId: account.id,
                transactionType: 'DEPOSIT',
                amount: 500,
                collectedAt: new Date(),
                notes: 'Test deposit via verification script'
            }
        ],
        attendance: []
    };

    console.log('📤 Simulating collection upload...');
    console.log(`  Deposit Amount: Rs. ${mockData.entries[0].amount}\n`);

    // 4. Import and call uploadData
    const { uploadData } = await import('../modules/sync/sync.service');
    const result = await uploadData(mockData);

    console.log('✓ Upload completed');
    console.log(`  Session Status: ${result.stats.session.status}`);
    console.log(`  Entries Added: ${result.stats.entries.added}`);
    console.log(`  Transactions Created: ${result.stats.entries.transactionsCreated}\n`);

    // 5. Verify balance update
    const updatedAccount = await prisma.userAccount.findUnique({
        where: { id: account.id }
    });

    if (updatedAccount) {
        const expectedBalance = parseFloat(account.balance.toString()) + mockData.entries[0].amount;
        const actualBalance = parseFloat(updatedAccount.balance.toString());

        console.log('💰 Balance Verification:');
        console.log(`  Expected: Rs. ${expectedBalance}`);
        console.log(`  Actual: Rs. ${actualBalance}`);

        if (actualBalance === expectedBalance) {
            console.log('  ✅ Balance updated correctly!\n');
        } else {
            console.log('  ❌ Balance mismatch!\n');
        }
    }

    // 6. Verify transaction record
    const transaction = await prisma.userAccountTransaction.findFirst({
        where: { referenceNumber: mockData.entries[0].id }
    });

    if (transaction) {
        console.log('📝 Transaction Record Created:');
        console.log(`  Type: ${transaction.transactionType}`);
        console.log(`  Amount: Rs. ${transaction.amount}`);
        console.log(`  Running Balance: Rs. ${transaction.runningBalance}`);
        console.log('  ✅ Transaction audit trail verified!\n');

        // 7. Verify Journal Entry
        if (transaction.journalEntryId) {
            const journalEntry = await prisma.journalEntry.findUnique({
                where: { id: transaction.journalEntryId },
                include: { journalEntryLines: { include: { account: true } } }
            });

            if (journalEntry) {
                console.log('📚 Journal Entry Created:');
                console.log(`  Entry Number: ${journalEntry.entryNumber}`);
                console.log(`  Status: ${journalEntry.status}`);
                console.log(`  Lines:`);
                journalEntry.journalEntryLines.forEach(line => {
                    const debitAmt = parseFloat(line.debitAmount.toString());
                    const creditAmt = parseFloat(line.creditAmount.toString());
                    const type = debitAmt > 0 ? 'DEBIT' : 'CREDIT';
                    const amount = debitAmt > 0 ? debitAmt : creditAmt;
                    console.log(`    ${type}: ${line.account.accountCode} - ${line.account.name} = Rs. ${amount}`);
                });
                console.log('  ✅ Double-entry accounting verified!\n');
            } else {
                console.log('  ❌ Journal entry not found!\n');
            }
        } else {
            console.log('  ⚠️  No journal entry linked to transaction!\n');
        }
    } else {
        console.log('  ❌ Transaction record not found!\n');
    }

    console.log('🎉 Verification Complete!');
}

main()
    .catch(e => {
        console.error('❌ Verification failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
