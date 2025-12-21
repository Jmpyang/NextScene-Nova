require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const adminEmail = 'admin@nextscenenova.com';
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('Admin already exists');
        } else {
            const admin = new User({
                name: 'Super Admin',
                email: adminEmail,
                password: 'NovaAdmin2025!', // Secure password
                role: 'admin',
                isVerified: true
            });

            await admin.save();
            console.log('Super Admin created successfully');
            console.log('Email: admin@nextscenenova.com');
            console.log('Password: NovaAdmin2025!');
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
