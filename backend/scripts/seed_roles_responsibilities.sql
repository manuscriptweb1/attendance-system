-- Seed 11 Standard Roles & Responsibilities Templates (6 Categories with 3 Bullets each = 18 Bullets per Role)

INSERT INTO role_responsibility_templates (job_role, categories)
VALUES
  -- 1. Office Staff
  (
    'Office Staff',
    '[
      {
        "category": "1. Office Administration & Coordination",
        "items": [
          "Handle routine office activities and administrative tasks.",
          "Maintain company files, records, forms, and documents in an organized and accessible manner.",
          "Coordinate daily communication and administrative requirements between different departments."
        ]
      },
      {
        "category": "2. Documentation & Data Management",
        "items": [
          "Update employee, client, project, and office records accurately.",
          "Organize important documents and maintain proper physical and digital filing systems.",
          "Assist with data entry, document verification, and preparation of routine administrative reports."
        ]
      },
      {
        "category": "3. Communication & Department Support",
        "items": [
          "Respond to routine internal and external queries professionally.",
          "Coordinate emails, calls, meetings, and other office communications as required.",
          "Provide administrative support to editorial, production, accounts, and management teams."
        ]
      },
      {
        "category": "4. Publishing Workflow Support",
        "items": [
          "Assist with journal and publishing-related documentation.",
          "Track assigned tasks and workflow updates across relevant departments.",
          "Support editorial and production teams with routine publishing activities and documentation requirements."
        ]
      },
      {
        "category": "5. Office Operations",
        "items": [
          "Monitor stationery and general office requirements.",
          "Coordinate meetings, schedules, office arrangements, and other daily administrative activities.",
          "Ensure smooth day-to-day office operations and timely completion of assigned responsibilities."
        ]
      },
      {
        "category": "6. Records & Compliance",
        "items": [
          "Maintain confidential company and employee records.",
          "Follow internal procedures and documentation standards while handling company information.",
          "Assist management with reports, records, and other administrative documentation as required."
        ]
      }
    ]'::jsonb
  ),

  -- 2. Assistant Accountant
  (
    'Assistant Accountant',
    '[
      {
        "category": "1. Accounting & Bookkeeping",
        "items": [
          "Record daily financial transactions accurately.",
          "Maintain invoices, bills, vouchers, receipts, and supporting financial documents in an organized manner.",
          "Assist in maintaining accurate books of accounts and completing routine accounting activities."
        ]
      },
      {
        "category": "2. Accounts Payable & Receivable",
        "items": [
          "Track client invoices and outstanding payments.",
          "Process vendor bills and verify supporting documents before payment processing.",
          "Maintain accurate payable and receivable records and follow up on pending transactions."
        ]
      },
      {
        "category": "3. Expense & Payment Management",
        "items": [
          "Record and verify company expenses.",
          "Maintain supporting documents for employee reimbursements and business expenses.",
          "Assist in preparing expense summaries and ensuring all transactions are properly documented."
        ]
      },
      {
        "category": "4. Bank & Transaction Reconciliation",
        "items": [
          "Assist with bank statement reconciliation.",
          "Verify financial transactions and account entries against relevant supporting records.",
          "Identify transaction discrepancies and report them to the appropriate accountant or manager."
        ]
      },
      {
        "category": "5. Payroll & Employee Records",
        "items": [
          "Assist with payroll-related calculations and records.",
          "Maintain employee financial documentation and supporting salary records accurately.",
          "Support salary, reimbursement, and other employee payment processing activities when required."
        ]
      },
      {
        "category": "6. Reporting & Compliance",
        "items": [
          "Assist in preparing financial reports and summaries.",
          "Maintain organized accounting records and supporting documents for audits and internal reviews.",
          "Follow company accounting procedures and applicable financial documentation requirements."
        ]
      }
    ]'::jsonb
  ),

  -- 3. Office Manager
  (
    'Office Manager',
    '[
      {
        "category": "1. Office Administration & Operations",
        "items": [
          "Manage daily office operations efficiently.",
          "Coordinate office resources, facilities, supplies, and operational requirements to maintain a productive workplace.",
          "Ensure smooth functioning of the office and timely completion of administrative responsibilities."
        ]
      },
      {
        "category": "2. Team Coordination & Support",
        "items": [
          "Coordinate administrative activities across departments.",
          "Assign and monitor routine office responsibilities while ensuring timely completion.",
          "Support employees and department heads with operational requirements and administrative assistance."
        ]
      },
      {
        "category": "3. Documentation & Record Management",
        "items": [
          "Maintain company documents and administrative records.",
          "Ensure important documentation is properly organized, updated, and securely maintained.",
          "Maintain confidentiality of sensitive employee, company, client, and business information."
        ]
      },
      {
        "category": "4. Vendor & Facility Management",
        "items": [
          "Coordinate with vendors and service providers.",
          "Monitor office supplies, equipment, facilities, and maintenance requirements.",
          "Resolve routine facility issues and coordinate with relevant service providers when required."
        ]
      },
      {
        "category": "5. Communication & Scheduling",
        "items": [
          "Coordinate meetings and appointments.",
          "Support management with schedules, internal communications, and administrative tasks.",
          "Maintain effective communication between management, employees, and different departments."
        ]
      },
      {
        "category": "6. Process Improvement & Reporting",
        "items": [
          "Monitor administrative workflows and identify improvements.",
          "Prepare routine operational reports and updates for management when required.",
          "Ensure office activities follow established internal procedures and operational standards."
        ]
      }
    ]'::jsonb
  ),

  -- 4. Senior Manager
  (
    'Senior Manager',
    '[
      {
        "category": "1. Department Management & Planning",
        "items": [
          "Plan and oversee departmental activities.",
          "Allocate resources, responsibilities, and workloads according to business requirements and project priorities.",
          "Monitor departmental progress and ensure assigned objectives are achieved within agreed timelines."
        ]
      },
      {
        "category": "2. Team Leadership & Performance",
        "items": [
          "Lead and support team members.",
          "Assign responsibilities, monitor performance, and ensure accountability for departmental deliverables.",
          "Encourage collaboration, professional development, knowledge sharing, and continuous improvement within the team."
        ]
      },
      {
        "category": "3. Publishing Operations & Coordination",
        "items": [
          "Oversee publishing-related workflows.",
          "Coordinate journal, editorial, production, website, and technology activities according to project requirements.",
          "Ensure projects follow agreed processes, quality standards, priorities, and delivery timelines."
        ]
      },
      {
        "category": "4. Client & Stakeholder Coordination",
        "items": [
          "Maintain professional communication with clients and partners.",
          "Understand business requirements and coordinate appropriate solutions with relevant internal teams.",
          "Resolve operational issues and escalate critical matters when necessary."
        ]
      },
      {
        "category": "5. Performance & Quality Management",
        "items": [
          "Monitor team productivity and work quality.",
          "Identify workflow issues and implement appropriate corrective and improvement measures.",
          "Ensure services and deliverables meet company standards, project requirements, and client expectations."
        ]
      },
      {
        "category": "6. Reporting & Strategic Support",
        "items": [
          "Prepare management reports and performance updates.",
          "Support business planning, operational decisions, and departmental strategy.",
          "Drive continuous improvement initiatives and support overall organizational objectives."
        ]
      }
    ]'::jsonb
  ),

  -- 5. Production Assistant
  (
    'Production Assistant',
    '[
      {
        "category": "1. Production Workflow Support",
        "items": [
          "Assist with daily journal production activities.",
          "Track articles through typesetting, proofreading, correction, and final production stages.",
          "Ensure assigned production activities are completed accurately and within scheduled timelines."
        ]
      },
      {
        "category": "2. Article & Content Preparation",
        "items": [
          "Check article files and production requirements.",
          "Organize manuscripts, images, figures, tables, supplementary files, and related publication materials.",
          "Assist production teams in preparing scholarly content for print and digital publication."
        ]
      },
      {
        "category": "3. Typesetting & Formatting Support",
        "items": [
          "Assist with journal article formatting and typesetting.",
          "Check layouts and article presentation against required journal and publication standards.",
          "Support XML, PDF, ePub, pagination, and other digital production workflows where required."
        ]
      },
      {
        "category": "4. Quality Checking",
        "items": [
          "Perform quality checks on production files.",
          "Identify formatting, content, layout, and presentation issues during production.",
          "Report corrections clearly to the appropriate production or editorial team for resolution."
        ]
      },
      {
        "category": "5. Coordination & Tracking",
        "items": [
          "Coordinate with editorial and production teams.",
          "Update article and production status records and follow up on pending activities.",
          "Ensure assigned production tasks progress according to the required schedule and workflow."
        ]
      },
      {
        "category": "6. Publication Support",
        "items": [
          "Assist with final proof and publication preparation.",
          "Support web, PDF, XML, and other digital publication workflows as required.",
          "Maintain accurate production documentation and ensure required publication files are properly organized."
        ]
      }
    ]'::jsonb
  ),

  -- 6. Editorial Assistant
  (
    'Editorial Assistant',
    '[
      {
        "category": "1. Editorial Workflow Support",
        "items": [
          "Assist with daily editorial activities.",
          "Track manuscripts through submission, technical check, peer review, revision, and editorial stages.",
          "Ensure manuscript records and workflow updates are maintained accurately and within required timelines."
        ]
      },
      {
        "category": "2. Manuscript Management",
        "items": [
          "Check submitted manuscripts for basic requirements.",
          "Organize manuscript files, author information, figures, references, and supporting documents.",
          "Update manuscript records and assist editors in maintaining an organized editorial workflow."
        ]
      },
      {
        "category": "3. Peer Review Coordination",
        "items": [
          "Assist with reviewer assignments and invitations.",
          "Monitor review progress, pending responses, deadlines, and reviewer availability throughout the workflow.",
          "Maintain accurate reviewer and manuscript records while supporting timely editorial decisions."
        ]
      },
      {
        "category": "4. Editorial Quality Support",
        "items": [
          "Assist with manuscript formatting and basic quality checks.",
          "Verify references, citations, required information, and submission requirements.",
          "Identify missing or inconsistent information and forward editorial issues to the appropriate team."
        ]
      },
      {
        "category": "5. Author & Editor Communication",
        "items": [
          "Coordinate routine communication with authors and editors.",
          "Send manuscript status updates, revision requests, and other required communications.",
          "Maintain professional, accurate, and timely correspondence throughout the editorial workflow."
        ]
      },
      {
        "category": "6. Publishing Documentation",
        "items": [
          "Maintain editorial workflow documentation.",
          "Prepare manuscript reports and status summaries when required by editors or management.",
          "Support the smooth transition of approved manuscripts from the editorial stage to production."
        ]
      }
    ]'::jsonb
  ),

  -- 7. Senior Editor
  (
    'Senior Editor',
    '[
      {
        "category": "1. Editorial Management",
        "items": [
          "Manage editorial workflows for assigned journals.",
          "Review manuscripts for editorial quality, completeness, consistency, and adherence to journal requirements.",
          "Ensure editorial activities are completed efficiently while maintaining journal policies and publishing standards."
        ]
      },
      {
        "category": "2. Manuscript & Content Review",
        "items": [
          "Review manuscripts for quality and consistency.",
          "Ensure manuscripts follow journal formatting, referencing, language, and content guidelines.",
          "Coordinate required revisions and corrections with authors, editors, and relevant publishing teams."
        ]
      },
      {
        "category": "3. Peer Review Management",
        "items": [
          "Oversee reviewer selection and review workflows.",
          "Monitor review quality, response rates, deadlines, and overall manuscript turnaround times.",
          "Coordinate reviewer feedback and support editors in reaching appropriate editorial decisions."
        ]
      },
      {
        "category": "4. Copyediting & Proofreading",
        "items": [
          "Review grammar, language, style, and consistency.",
          "Verify references, citations, figures, tables, and other manuscript elements.",
          "Ensure manuscripts meet required editorial and publication standards before moving to production."
        ]
      },
      {
        "category": "5. Author & Editorial Coordination",
        "items": [
          "Communicate with authors regarding revisions and corrections.",
          "Coordinate with editors, reviewers, production teams, and other publishing stakeholders.",
          "Resolve routine editorial issues and ensure required actions are completed within agreed timelines."
        ]
      },
      {
        "category": "6. Quality & Process Improvement",
        "items": [
          "Maintain high editorial and publishing standards.",
          "Identify workflow improvements, recurring quality issues, and opportunities for better editorial processes.",
          "Mentor editorial team members and support the implementation of consistent editorial best practices."
        ]
      }
    ]'::jsonb
  ),

  -- 8. Production Head
  (
    'Production Head',
    '[
      {
        "category": "1. Production Management",
        "items": [
          "Lead end-to-end journal production activities.",
          "Manage article production schedules, priorities, resources, and delivery requirements across assigned projects.",
          "Ensure production work is completed accurately, efficiently, and within agreed publication timelines."
        ]
      },
      {
        "category": "2. Typesetting & Digital Production",
        "items": [
          "Oversee XML, PDF, ePub, and typesetting workflows.",
          "Ensure article layouts and digital outputs meet journal-specific publication and formatting standards.",
          "Monitor production quality across print, web, and digital publishing formats."
        ]
      },
      {
        "category": "3. Production Quality Control",
        "items": [
          "Monitor quality checks across production stages.",
          "Review production outputs for formatting, content, layout, and technical issues.",
          "Ensure identified corrections are completed before final publication and delivery."
        ]
      },
      {
        "category": "4. Team Leadership & Coordination",
        "items": [
          "Lead production assistants and specialists.",
          "Allocate workloads, monitor team performance, and ensure production responsibilities are completed on schedule.",
          "Coordinate closely with editorial and web teams to ensure smooth movement of content through production."
        ]
      },
      {
        "category": "5. Workflow & Process Optimization",
        "items": [
          "Improve production workflows and turnaround times.",
          "Identify bottlenecks and implement corrective actions to improve efficiency and production quality.",
          "Maintain efficient and standardized production processes across assigned journal and publishing projects."
        ]
      },
      {
        "category": "6. Publication & Client Delivery",
        "items": [
          "Oversee final publication and delivery activities.",
          "Coordinate publication schedules with relevant stakeholders and internal teams.",
          "Ensure projects meet required quality standards, delivery timelines, and client requirements."
        ]
      }
    ]'::jsonb
  ),

  -- 9. Website Management
  (
    'Website Management',
    '[
      {
        "category": "1. Journal Website Management",
        "items": [
          "Manage and maintain journal websites.",
          "Update journal information, articles, issues, announcements, and publication details.",
          "Ensure websites accurately represent the latest approved journal and article information."
        ]
      },
      {
        "category": "2. Content Publishing & Updates",
        "items": [
          "Publish approved articles and journal content online.",
          "Update author information, article details, references, metadata, and publication records.",
          "Maintain consistent website content, structure, formatting, and presentation across assigned journal websites."
        ]
      },
      {
        "category": "3. Website Quality & User Experience",
        "items": [
          "Monitor website functionality and content accuracy.",
          "Ensure journal websites provide a clear, accessible, responsive, and user-friendly reading experience.",
          "Identify broken links, display problems, missing content, and other website issues for timely correction."
        ]
      },
      {
        "category": "4. Publishing Platform Coordination",
        "items": [
          "Coordinate website activities with editorial and production teams.",
          "Upload and verify publication-ready content and ensure required information is correctly displayed.",
          "Support journal publishing workflows through online platforms and coordinate updates with relevant teams."
        ]
      },
      {
        "category": "5. SEO & Discoverability",
        "items": [
          "Maintain basic SEO elements and publication metadata.",
          "Support article discoverability through accurate journal, article, author, and publication information.",
          "Ensure journal pages follow consistent content standards and provide appropriate publication details."
        ]
      },
      {
        "category": "6. Monitoring & Support",
        "items": [
          "Monitor websites for errors and publishing issues.",
          "Coordinate technical issues with the web development team and follow up until resolution.",
          "Maintain website update records and publishing documentation to support accurate content management."
        ]
      }
    ]'::jsonb
  ),

  -- 10. Web Developer
  (
    'Web Developer',
    '[
      {
        "category": "1. Web Application Development",
        "items": [
          "Design, develop, test, and maintain web applications and backend APIs.",
          "Write clean, modular, scalable, and well-documented code following industry standards.",
          "Implement responsive, dynamic, and intuitive user interfaces for journal publishing and business workflows."
        ]
      },
      {
        "category": "2. Code Review & Performance Optimization",
        "items": [
          "Participate actively in peer code reviews and architectural design reviews.",
          "Optimize frontend bundle sizes, rendering performance, backend services, and database queries.",
          "Ensure application security, data integrity, reliability, and adherence to secure coding practices."
        ]
      },
      {
        "category": "3. Technical Collaboration & Maintenance",
        "items": [
          "Collaborate closely with editorial, production, and website management teams.",
          "Debug, troubleshoot, and resolve application, integration, and production issues.",
          "Maintain technical documentation and assist with CI/CD, deployment, and system maintenance."
        ]
      },
      {
        "category": "4. Frontend Development & User Experience",
        "items": [
          "Develop responsive and cross-browser-compatible web interfaces.",
          "Improve website usability, accessibility, performance, and overall user experience.",
          "Integrate frontend components with backend services, APIs, and publishing platforms efficiently."
        ]
      },
      {
        "category": "5. Backend & Database Management",
        "items": [
          "Develop and maintain secure backend services and APIs.",
          "Design, optimize, and maintain databases, queries, and data-processing workflows.",
          "Implement proper data validation, error handling, authentication, and authorization mechanisms."
        ]
      },
      {
        "category": "6. Deployment, Monitoring & Continuous Improvement",
        "items": [
          "Deploy web applications across development, staging, and production environments.",
          "Monitor application performance, availability, errors, integrations, and production issues.",
          "Continuously improve applications through bug fixes, feature enhancements, security updates, and technical improvements."
        ]
      }
    ]'::jsonb
  ),

  -- 11. Quality Analyst
  (
    'Quality Analyst',
    '[
      {
        "category": "1. Quality Assurance & Testing",
        "items": [
          "Perform quality checks on applications and publishing workflows.",
          "Identify defects, inconsistencies, and deviations from defined functional, technical, and publishing standards.",
          "Ensure completed work meets required quality, functionality, accuracy, and performance expectations."
        ]
      },
      {
        "category": "2. Functional & Workflow Testing",
        "items": [
          "Test application features, forms, workflows, and publishing processes.",
          "Verify that expected functionality works correctly across different scenarios and user workflows.",
          "Perform regression testing after fixes, updates, and new feature releases to ensure existing functionality remains stable."
        ]
      },
      {
        "category": "3. Content & Publishing Quality",
        "items": [
          "Review articles, metadata, layouts, and digital content.",
          "Verify formatting, links, references, figures, tables, and publication details for accuracy and consistency.",
          "Ensure published content follows journal-specific requirements and established company publishing quality standards."
        ]
      },
      {
        "category": "4. Defect Tracking & Resolution",
        "items": [
          "Document defects with clear steps and supporting evidence.",
          "Coordinate with developers, editorial, and production teams to investigate issues and implement appropriate resolutions.",
          "Retest corrected issues and verify that fixes do not introduce new defects into existing applications or workflows."
        ]
      },
      {
        "category": "5. Quality Documentation & Reporting",
        "items": [
          "Maintain test cases, checklists, quality records, and issue logs.",
          "Prepare quality reports and communicate testing results, critical issues, and pending defects to relevant teams.",
          "Track recurring issues and analyze defect patterns to recommend corrective actions and improve overall quality."
        ]
      },
      {
        "category": "6. Process Improvement & Compliance",
        "items": [
          "Monitor testing, publishing, and operational workflows for quality gaps.",
          "Recommend improvements to testing procedures, quality controls, publishing workflows, and team processes to reduce errors.",
          "Ensure assigned work follows defined quality procedures, company standards, security practices, and applicable publishing requirements."
        ]
      }
    ]'::jsonb
  ),

  -- 12. Quality Assurance (Alias)
  (
    'Quality Assurance',
    '[
      {
        "category": "1. Quality Assurance & Testing",
        "items": [
          "Perform quality checks on applications and publishing workflows.",
          "Identify defects, inconsistencies, and deviations from defined functional, technical, and publishing standards.",
          "Ensure completed work meets required quality, functionality, accuracy, and performance expectations."
        ]
      },
      {
        "category": "2. Functional & Workflow Testing",
        "items": [
          "Test application features, forms, workflows, and publishing processes.",
          "Verify that expected functionality works correctly across different scenarios and user workflows.",
          "Perform regression testing after fixes, updates, and new feature releases to ensure existing functionality remains stable."
        ]
      },
      {
        "category": "3. Content & Publishing Quality",
        "items": [
          "Review articles, metadata, layouts, and digital content.",
          "Verify formatting, links, references, figures, tables, and publication details for accuracy and consistency.",
          "Ensure published content follows journal-specific requirements and established company publishing quality standards."
        ]
      },
      {
        "category": "4. Defect Tracking & Resolution",
        "items": [
          "Document defects with clear steps and supporting evidence.",
          "Coordinate with developers, editorial, and production teams to investigate issues and implement appropriate resolutions.",
          "Retest corrected issues and verify that fixes do not introduce new defects into existing applications or workflows."
        ]
      },
      {
        "category": "5. Quality Documentation & Reporting",
        "items": [
          "Maintain test cases, checklists, quality records, and issue logs.",
          "Prepare quality reports and communicate testing results, critical issues, and pending defects to relevant teams.",
          "Track recurring issues and analyze defect patterns to recommend corrective actions and improve overall quality."
        ]
      },
      {
        "category": "6. Process Improvement & Compliance",
        "items": [
          "Monitor testing, publishing, and operational workflows for quality gaps.",
          "Recommend improvements to testing procedures, quality controls, publishing workflows, and team processes to reduce errors.",
          "Ensure assigned work follows defined quality procedures, company standards, security practices, and applicable publishing requirements."
        ]
      }
    ]'::jsonb
  )

ON CONFLICT (job_role) 
DO UPDATE SET 
  categories = EXCLUDED.categories,
  updated_at = CURRENT_TIMESTAMP;
