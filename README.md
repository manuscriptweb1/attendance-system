# Employee Attendance Management System

Full-stack attendance management system with location-based check-in/check-out.

## Tech Stack

**Frontend:** React.js, Tailwind CSS  
**Backend:** Node.js, Express.js  
**Database:** PostgreSQL

## Setup Instructions

### 1. Database Setup
```sql
-- Create database
CREATE DATABASE attendance_db;

-- Run schema
psql -U postgres -d attendance_db -f backend/config/schema.sql
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
node utils/createAdmin.js
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Default Credentials

**Admin:**  
Username: `admin`  
Password: `admin123`

**Employee:** Create from admin panel

## Features

- ✅ Admin & Employee separate login
- ✅ Location-based attendance (GPS validation)
- ✅ WFH (Work From Home) access control
- ✅ Real-time dashboard analytics
- ✅ Monthly PDF reports
- ✅ Admin settings page (change location from UI)
- ✅ Custom confirmation dialogs
- ✅ Session management (logout on browser close)

## Deployment

**DO NOT upload node_modules!**

Upload only:
- Backend source files (~25 files)
- Frontend build folder (run `npm run build`)
- .env file with your settings

Server will run `npm install` to download dependencies.

See `.gitignore` for excluded files.

## Ports

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

## Admin Settings

Change office location and attendance rules from:  
**Admin → Settings**

No need to edit files manually!
