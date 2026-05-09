const prisma = require('../lib/prisma');

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL Connected via Neon');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB, prisma };