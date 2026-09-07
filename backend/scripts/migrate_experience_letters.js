const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting Experience Letters migration...');
    await client.query('BEGIN');

    // 1. Add experience_work_summary column to role_responsibility_templates
    await client.query(`
      ALTER TABLE role_responsibility_templates 
      ADD COLUMN IF NOT EXISTS experience_work_summary TEXT;
    `);
    console.log('Added experience_work_summary to role_responsibility_templates.');

    // 2. Set default work summaries for existing roles if NULL
    await client.query(`
      UPDATE role_responsibility_templates
      SET experience_work_summary = 'During his tenure of work, he participated in executing projects for Manuscript TechnoMedia LLP and executed many publishing projects successfully.'
      WHERE experience_work_summary IS NULL;
    `);

    // 3. Create experience_letters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS experience_letters (
        id SERIAL PRIMARY KEY,
        letter_number VARCHAR(50) UNIQUE NOT NULL,
        employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated')),
        issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
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

        monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
        salary_in_words VARCHAR(255),

        paragraph_1_snapshot TEXT,
        paragraph_2_snapshot TEXT,
        paragraph_3_snapshot TEXT,
        paragraph_4_snapshot TEXT,
        paragraph_5_snapshot TEXT,

        company_name_snapshot VARCHAR(200),
        header_address_snapshot TEXT,
        header_phone_snapshot VARCHAR(50),
        header_email_snapshot VARCHAR(100),
        header_website_snapshot VARCHAR(100),
        footer_line_1_snapshot TEXT,
        footer_line_2_snapshot TEXT,
        footer_line_3_snapshot TEXT,
        signatory_name VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK',
        signatory_designation VARCHAR(150) DEFAULT 'Authorized Signatory',
        signatory_email VARCHAR(150) DEFAULT 'connect@mstechnomedia.com',

        created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        generated_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Created experience_letters table.');

    // 4. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_experience_letters_emp_id ON experience_letters(employee_id);
      CREATE INDEX IF NOT EXISTS idx_experience_letters_status ON experience_letters(status);
    `);
    console.log('Created indexes for experience_letters.');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
