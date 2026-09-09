import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding offline mode data...');

    // 1. Create Field Officer (as Staff with auth fields)
    const passwordHash = await hash('password123', 10);

    // Removed AdminUser creation as it's consolidated into Staff

    const staff = await prisma.staff.upsert({
        where: { employeeId: 'FO001' },
        update: {},
        create: {
            employeeId: 'FO001',
            username: 'fieldofficer',
            passwordHash,
            firstName: 'Field',
            lastName: 'Officer',
            email: 'officer@example.com',
            phone: '9800000000',
            address: 'Kathmandu',
            dateOfBirth: new Date('1990-01-01'),
            joinDate: new Date(),
            department: 'Field',
            position: 'Officer',
            status: 'ACTIVE',
        },
    });

    console.log(`Created Field Officer: ${staff.firstName} ${staff.lastName}`);

    // 2. Create Center
    const center = await prisma.center.upsert({
        where: { code: 'CTR-001' },
        update: { staffId: staff.id },
        create: {
            name: 'Kathmandu Center 1',
            code: 'CTR-001',
            address: 'Baneshwor',
            meetingDay: 1, // Sunday
            staffId: staff.id,
        },
    });

    console.log(`Created Center: ${center.name}`);

    // 3. Create Group
    const group = await prisma.group.upsert({
        where: { code: 'GRP-001' },
        update: {},
        create: {
            name: 'Mahila Samuha 1',
            code: 'GRP-001',
            centerId: center.id,
        },
    });

    console.log(`Created Group: ${group.name}`);

    // 4. Create Client (User)
    const user = await prisma.user.create({
        data: {
            fullName: 'Sita Sharma',
            dateOfBirth: new Date('1985-05-15'),
            gender: 'FEMALE',
            contactNumber: '9841000000',
            address: 'Baneshwor',
            idType: 'CITIZENSHIP',
            idNumber: '123-456-789',
            userType: 'MB', // Microbanking
            groupId: group.id,
            isActive: true,
        },
    });

    // 5. Create Account for Client
    const account = await prisma.userAccount.create({
        data: {
            accountNumber: `MB-${Date.now()}`,
            userId: user.id,
            balance: 1000.00,
            interestRate: 5.00,
            openingDate: new Date(),
            status: 'ACTIVE',
            accountType: 'SAVING',
        },
    });

    console.log(`Created Client: ${user.fullName} with Account: ${account.accountNumber}`);
    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
