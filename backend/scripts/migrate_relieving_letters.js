const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting Relieving Letters migration...');
    await client.query('BEGIN');

    // 1. Create relieving_letters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS relieving_letters (
        id SERIAL PRIMARY KEY,
        letter_number VARCHAR(50) UNIQUE NOT NULL,
        employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated')),
        issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
        resignation_date DATE,
        joining_date DATE NOT NULL,
        relieving_date DATE NOT NULL,

        salutation VARCHAR(20) NOT NULL DEFAULT 'Mr.',
        employee_name_snapshot VARCHAR(150) NOT NULL,
        employee_id_snapshot VARCHAR(50) NOT NULL,
        employee_email_snapshot VARCHAR(150),
        employee_phone_snapshot VARCHAR(20),
        employee_address_snapshot TEXT,

        job_title_snapshot VARCHAR(150) NOT NULL,
        department_snapshot VARCHAR(100),

        paragraph_1_snapshot TEXT,
        paragraph_2_snapshot TEXT,

        company_name_snapshot VARCHAR(200),
        header_address_snapshot TEXT,
        header_phone_snapshot VARCHAR(50),
        header_email_snapshot VARCHAR(100),
        header_website_snapshot VARCHAR(100),
        footer_line_1_snapshot TEXT,
        footer_line_2_snapshot TEXT,
        footer_line_3_snapshot TEXT,
        signatory_name VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed',
        signatory_designation VARCHAR(150) DEFAULT 'Authorized Signatory',
        signatory_email VARCHAR(150) DEFAULT 'connect@mstechnomedia.com',

        created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        generated_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Created relieving_letters table.');

    // 2. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_relieving_letters_emp_id ON relieving_letters(employee_id);
      CREATE INDEX IF NOT EXISTS idx_relieving_letters_status ON relieving_letters(status);
    `);
    console.log('Created indexes for relieving_letters.');

    await client.query('COMMIT');
    console.log('Relieving Letters migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Relieving Letters migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
