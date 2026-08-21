const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMasterMigration() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'attendance_db';

  console.log(`🚀 Starting Database Synchronization for database "${dbName}"...`);

  // Step 1: Ensure database exists
  const rootClient = new Client({ host, port, user, password, database: 'postgres' });
  try {
    await rootClient.connect();
    const checkDb = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
    );
    if (checkDb.rows.length === 0) {
      await rootClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    } else {
      console.log(`✅ Database "${dbName}" exists.`);
    }
  } catch (err) {
    console.error('❌ Root connection error:', err.message);
  } finally {
    await rootClient.end();
  }

  // Step 2: Connect to attendance_db and run schema.sql
  const dbClient = new Client({ host, port, user, password, database: dbName });
  try {
    await dbClient.connect();
    console.log(`✅ Connected to "${dbName}".`);

    // 2a. Run consolidated schema.sql
    console.log('📌 Executing config/schema.sql...');
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await dbClient.query(schemaSql);
      console.log('✅ Master schema.sql executed successfully.');
    } else {
      console.warn('⚠️ schema.sql not found at', schemaPath);
    }

    // 2c. Run manual attendance migration queries
    console.log('📌 Ensuring attendance columns...');
    await dbClient.query(`
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS absent_reason TEXT,
      ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Attendance columns checked/added.');

    // 2d. Run admin assistant settings migration
    console.log('📌 Ensuring settings columns...');
    await dbClient.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS admin_assistant_enabled BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Settings columns checked/added.');

    // 2e. Run RBAC migrations (admins, admin_pages, admin_permissions)
    console.log('📌 Ensuring RBAC tables and admin columns...');
    await dbClient.query(`
      ALTER TABLE admins 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin',
      ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'));
    `);

    await dbClient.query(`
      UPDATE admins SET role = 'super_admin', is_super_admin = true WHERE is_super_admin IS NOT TRUE;
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS admin_pages (
        id SERIAL PRIMARY KEY,
        page_key VARCHAR(100) UNIQUE NOT NULL,
        page_name VARCHAR(150) NOT NULL,
        route_path VARCHAR(200) NOT NULL,
        sidebar_section VARCHAR(100),
        icon_key VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        page_key VARCHAR(100) NOT NULL,
        can_view BOOLEAN DEFAULT false,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_delete BOOLEAN DEFAULT false,
        can_export BOOLEAN DEFAULT false,
        can_clear BOOLEAN DEFAULT false,
        can_calculate BOOLEAN DEFAULT false,
        can_approve BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(admin_id, page_key)
      );
    `);

    await dbClient.query(`
      INSERT INTO admin_pages (page_key, page_name, route_path, sidebar_section, sort_order)
      VALUES
      ('dashboard', 'Dashboard', '/admin/dashboard', 'Overview', 1),
      ('employees', 'Employees', '/admin/employees', 'People', 2),
      ('departments', 'Departments', '/admin/departments', 'People', 3),
      ('admin_management', 'Admin Management', '/admin/admin-management', 'People', 4),
      ('attendance', 'Attendance', '/admin/attendance', 'Time & Attendance', 5),
      ('manual_attendance', 'Manual Attendance', '/admin/manual-attendance', 'Time & Attendance', 6),
      ('absent_reasons', 'Absent Reasons', '/admin/absent-reasons', 'Time & Attendance', 7),
      ('holidays', 'Holidays', '/admin/holidays', 'Time & Attendance', 8),
      ('payroll', 'Payroll', '/admin/payroll', 'HR & Finance', 9),
      ('expenses', 'Expenses', '/admin/expenses', 'HR & Finance', 10),
      ('reports', 'Reports', '/admin/reports', 'HR & Finance', 11),
      ('permissions', 'Permissions', '/admin/permissions', 'Time & Attendance', 12),
      ('settings', 'Settings', '/admin/settings', 'System', 13),
      ('manage', 'Manage', '/admin/manage', 'System', 14),
      ('database_monitor', 'Database Monitor', '/admin/database-monitor', 'System', 15),
      ('trusted_devices', 'Trusted Devices', '/admin/trusted-devices', 'System', 16),
      ('activity_logs', 'Activity Logs', '/admin/activity-logs', 'System', 17),
      ('otp_settings', 'OTP Settings', '/admin/otp-settings', 'System', 18),
      ('security_logs', 'Security Logs', '/admin/security-logs', 'System', 19)
      ON CONFLICT (page_key) DO NOTHING;
    `);

    console.log('✅ RBAC setup completed.');

    // 2g. Ensure resigned_employees table exists
    console.log('📌 Ensuring resigned_employees table...');
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS resigned_employees (
        id SERIAL PRIMARY KEY,
        original_id INTEGER,
        employee_id VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        job_role VARCHAR(100) NOT NULL,
        mobile VARCHAR(15),
        email VARCHAR(150),
        personal_email VARCHAR(150),
        password VARCHAR(255),
        status VARCHAR(20) DEFAULT 'Resigned',
        date_of_birth DATE,
        joining_date DATE,
        resigned_date DATE DEFAULT CURRENT_DATE,
        resigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        monthly_salary NUMERIC(12,2) DEFAULT 0,
        basic_salary NUMERIC(12,2) DEFAULT 0,
        hra NUMERIC(12,2) DEFAULT 0,
        special_allowance NUMERIC(12,2) DEFAULT 0,
        staff_advance NUMERIC(12,2) DEFAULT 0,
        professional_tax NUMERIC(12,2) DEFAULT 0,
        tds NUMERIC(12,2) DEFAULT 0,
        bank_name VARCHAR(150),
        bank_address TEXT,
        account_holder_name VARCHAR(150),
        account_number VARCHAR(50),
        ifsc_code VARCHAR(20),
        pan_card_number VARCHAR(20),
        aadhar_card_number VARCHAR(20),
        permanent_address TEXT,
        alternate_phone_number VARCHAR(20),
        created_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ resigned_employees table checked/added.');

    // 2i. Run Offer Letter migrations
    console.log('📌 Ensuring Offer Letter tables and settings...');
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS offer_letter_settings (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(200) NOT NULL DEFAULT 'Manuscript TechnoMedia LLP',
        logo_path VARCHAR(500),
        logo_width INTEGER NOT NULL DEFAULT 160,
        logo_height INTEGER NOT NULL DEFAULT 60,
        header_address TEXT NOT NULL DEFAULT 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India',
        header_phone VARCHAR(50) NOT NULL DEFAULT '91-9686980760',
        header_email VARCHAR(100) NOT NULL DEFAULT 'connect@mstechnomedia.com',
        header_website VARCHAR(100) NOT NULL DEFAULT 'www.mstechnomedia.com',
        footer_line_1 TEXT NOT NULL DEFAULT 'Manuscript Technomedia LLP',
        footer_line_2 TEXT NOT NULL DEFAULT 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.',
        footer_line_3 TEXT NOT NULL DEFAULT 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV',
        footer_accent_color VARCHAR(20) DEFAULT '#E11D48',
        signatory_name VARCHAR(150) NOT NULL DEFAULT 'Dr. Mueen Ahmed KK',
        signatory_designation VARCHAR(150) NOT NULL DEFAULT 'Designated Partner',
        signatory_email VARCHAR(150) NOT NULL DEFAULT 'contact@mstechnomedia.com',
        signature_path VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE offer_letter_settings ADD COLUMN IF NOT EXISTS footer_line_3 TEXT DEFAULT 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV';

      INSERT INTO offer_letter_settings (
        id, company_name, logo_path, header_address, header_phone, header_email, header_website,
        footer_line_1, footer_line_2, footer_line_3, signatory_name, signatory_designation, signatory_email
      )
      VALUES (
        1,
        'Manuscript TechnoMedia LLP',
        NULL,
        'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India',
        '91-9686980760',
        'connect@mstechnomedia.com',
        'www.mstechnomedia.com',
        'Manuscript Technomedia LLP',
        'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.',
        'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV',
        'Dr. Mueen Ahmed KK',
        'Designated Partner',
        'contact@mstechnomedia.com'
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        footer_line_1 = 'Manuscript Technomedia LLP',
        footer_line_2 = 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.',
        footer_line_3 = 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV',
        updated_at = CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS role_responsibility_templates (
        id SERIAL PRIMARY KEY,
        job_role VARCHAR(150) NOT NULL UNIQUE,
        categories JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS offer_letters (
        id SERIAL PRIMARY KEY,
        offer_number VARCHAR(50) UNIQUE NOT NULL,
        employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated')),
        offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
        interview_date DATE,
        joining_date DATE NOT NULL,
        acceptance_deadline_date DATE,
        
        employee_name_snapshot VARCHAR(150) NOT NULL,
        employee_id_snapshot VARCHAR(50) NOT NULL,
        employee_email_snapshot VARCHAR(150),
        employee_phone_snapshot VARCHAR(20),
        employee_address_snapshot TEXT,

        job_title_snapshot VARCHAR(150) NOT NULL,
        department_snapshot VARCHAR(100),
        reporting_to VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK, [Managing Director]',
        work_location VARCHAR(150) DEFAULT 'Office Premises',
        employment_type VARCHAR(50) DEFAULT 'Full-time',
        work_hours VARCHAR(100) DEFAULT '9:30 AM – 6:30 PM, Monday–Saturday',
        probation_period VARCHAR(150) DEFAULT '3 months, extendable at the company''s discretion.',

        responsibilities_snapshot JSONB NOT NULL DEFAULT '[]',

        monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
        annual_fixed_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
        variable_percentage NUMERIC(5, 2) DEFAULT 0,
        variable_amount NUMERIC(12, 2) DEFAULT 0,
        total_ctc NUMERIC(12, 2) NOT NULL DEFAULT 0,
        annual_paid_leaves INTEGER DEFAULT 12,
        pf_applicable VARCHAR(50) DEFAULT 'Not Applicable',
        esi_applicable VARCHAR(50) DEFAULT 'Not Applicable',
        gratuity_applicable VARCHAR(50) DEFAULT 'Not Applicable',
        other_allowances VARCHAR(50) DEFAULT 'Not Applicable',

        company_name_snapshot VARCHAR(200),
        header_address_snapshot TEXT,
        header_phone_snapshot VARCHAR(50),
        header_email_snapshot VARCHAR(100),
        header_website_snapshot VARCHAR(100),
        footer_line_1_snapshot TEXT,
        footer_line_2_snapshot TEXT,
        signatory_name VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK',
        signatory_designation VARCHAR(150) DEFAULT 'Designated Partner',
        signatory_email VARCHAR(150) DEFAULT 'contact@mstechnomedia.com',

        created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        generated_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_offer_letters_emp_id ON offer_letters(employee_id);
      CREATE INDEX IF NOT EXISTS idx_offer_letters_status ON offer_letters(status);
      CREATE INDEX IF NOT EXISTS idx_offer_letters_offer_num ON offer_letters(offer_number);

      INSERT INTO admin_pages (page_key, page_name, route_path, sidebar_section, sort_order)
      VALUES ('offer_letters', 'Offer Letters', '/admin/offer-letters', 'People', 4)
      ON CONFLICT (page_key) DO NOTHING;

      -- Seed super_admin permissions for offer_letters
      INSERT INTO admin_permissions (admin_id, page_key, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      SELECT id, 'offer_letters', true, true, true, true, true, true
      FROM admins
      WHERE is_super_admin = true
      ON CONFLICT (admin_id, page_key) DO UPDATE
      SET can_view = true, can_create = true, can_edit = true, can_delete = true, can_export = true, can_approve = true;
    `);

    // Seed default role responsibility templates if not already existing
    const editorialExists = await dbClient.query(`SELECT 1 FROM role_responsibility_templates WHERE job_role = 'Editorial Assistant'`);
    if (editorialExists.rows.length === 0) {
      await dbClient.query(`
        INSERT INTO role_responsibility_templates (job_role, categories)
        VALUES ('Editorial Assistant', $1)
      `, [JSON.stringify([
        {
          category: '1. Content Quality Assurance',
          items: [
            'Review manuscripts, articles, and documents for grammatical, spelling, and punctuation accuracy.',
            'Ensure consistency in language, tone, formatting, and referencing styles.',
            'Check adherence to journal/organization guidelines and publishing standards.',
            'Identify errors, ambiguities, and inconsistencies, and suggest improvements.'
          ]
        },
        {
          category: '2. Proofreading & Editing',
          items: [
            'Perform line-by-line proofreading to eliminate typographical and syntax errors.',
            'Edit content for clarity, flow, and readability while maintaining the author’s original intent.',
            'Verify facts, figures, tables, and references for accuracy and consistency.',
            'Ensure that images, tables, and figures are correctly labelled and placed.'
          ]
        },
        {
          category: '3. Quality Control & Validation',
          items: [
            'Conduct plagiarism checks and ensure originality of content.',
            'Validate citations and references.',
            'Ensure formatting compliance with journal requirements (APA, Vancouver, etc.).'
          ]
        },
        {
          category: '4. Technical & Production Support',
          items: [
            'Assist in the preparation of galley proofs and final versions for publication.',
            'Coordinate with typesetters, graphic designers, and authors for corrections.',
            'Check for proper file formats, layout consistency, and metadata accuracy before uploading.',
            'Verify DOI, ISSN, and other publication identifiers.'
          ]
        },
        {
          category: '5. Communication & Coordination',
          items: [
            'Liaise with authors regarding revisions and clarifications.',
            'Coordinate with editors, reviewers, and the production team for workflow efficiency.',
            'Track manuscript progress from submission to final publication.',
            'Maintain communication logs and update project status regularly.'
          ]
        },
        {
          category: '6. Administrative & Documentation',
          items: [
            'Maintain records of edited/proofread documents.',
            'Prepare quality reports and track recurring errors for process improvement.',
            'Support the editorial board with content posting, website updates, and indexing tasks.',
            'Ensure compliance with organizational and publishing policies.'
          ]
        }
      ])]);
    }

    const webDevExists = await dbClient.query(`SELECT 1 FROM role_responsibility_templates WHERE job_role = 'Web Developer'`);
    if (webDevExists.rows.length === 0) {
      await dbClient.query(`
        INSERT INTO role_responsibility_templates (job_role, categories)
        VALUES ('Web Developer', $1)
      `, [JSON.stringify([
        {
          category: '1. Web Application Development',
          items: [
            'Design, develop, test and maintain high-performance web applications and backend APIs.',
            'Write clean, modular, scalable, and well-documented code adhering to industry standards.',
            'Implement responsive, dynamic, and intuitive user interfaces and workflows.'
          ]
        },
        {
          category: '2. Code Review & Performance Optimization',
          items: [
            'Participate actively in peer code reviews and architectural design reviews.',
            'Optimize frontend bundle sizes, rendering cycles, and backend database query performance.',
            'Ensure application security, data integrity, and adhere to secure coding practices.'
          ]
        },
        {
          category: '3. Technical Collaboration & Maintenance',
          items: [
            'Collaborate closely with designers, product managers, and QA teams.',
            'Debug, troubleshoot, and resolve issues reported in production environments.',
            'Maintain comprehensive technical documentation and assist in CI/CD pipeline automation.'
          ]
        }
      ])]);
    }
    console.log('✅ Offer Letter setup and templates completed.');

    // 2f. Verification of database tables count & names
    const tablesRes = await dbClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n========================================');
    console.log(`🎉 ALL DATABASE TABLES SUCCESSFULLY VERIFIED AND UPDATED! (${tablesRes.rows.length} Tables)`);
    console.log('========================================');
    tablesRes.rows.forEach(r => console.log(`  - ${r.table_name}`));

  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    await dbClient.end();
  }
}

runMasterMigration();
