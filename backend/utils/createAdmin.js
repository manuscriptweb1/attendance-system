// Script to create admin user
const bcrypt = require('bcrypt');
const pool = require('../config/database');
require('dotenv').config();

const createAdmin = async () => {
  try {
    const username = 'admin';
    const email = 'admin@company.com';
    const password = 'admin123';

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin
    const result = await pool.query(
      `INSERT INTO admins (username, email, password) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (username) DO UPDATE 
       SET password = $3, email = $2
       RETURNING *`,
      [username, email, hashedPassword]
    );

    console.log('✅ Admin created successfully!');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\n⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();
