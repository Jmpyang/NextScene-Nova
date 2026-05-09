require('dotenv').config();
const { prisma } = require('./src/config/db');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
    try {
        console.log('Seeding admin user...');

        const adminEmail = 'admin@nextscenenova.com';
        const existingAdmin = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (existingAdmin) {
            console.log('Admin already exists');
        } else {
            const hashedPassword = await bcrypt.hash('NovaAdmin2025!', 10);
            
            const admin = await prisma.user.create({
                data: {
                    name: 'Super Admin',
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                    isVerified: true
                }
            });

            console.log('Super Admin created successfully');
            console.log('Email: admin@nextscenenova.com');
            console.log('Password: NovaAdmin2025!');
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('Error seeding admin:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
};

seedAdmin();
