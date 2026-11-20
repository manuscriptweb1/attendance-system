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

## Smart Attendance (QR / Barcode / Face scan)

Automatic attendance at the entrance, an HR Scanner mobile app and attendance corrections with notes.
All of it is additive: the existing employee check-in, manual attendance and reports are unchanged.

**How it works (Auto mode, the default):** before **2:00 PM** a scan only checks in. A second scan by mistake shows "Already checked in" instead of checking out.
From 2:00 PM a scan checks out, and a first scan after 2:00 PM is still a check-in. The time can be changed in **Smart Attendance → Kiosks & Settings → Scan rules**.
Late, half-day, Sunday and holiday rules come from the normal attendance Settings.

**Manual buttons** (HR Scanner app and kiosks): **Check-in**, **Check-out** (for example, leaving early) and **Special leave**.
A manual mode applies to one scan only and then goes back to Auto. On a kiosk it also goes back to Auto after 30 seconds.

**Special leave** (for example 11 AM – 3 PM): the first scan in Special leave mode marks the employee as out, and the next scan (any mode except Check-out) marks them back.
Attendance shows "Special leave 11:00 AM – 3:00 PM (240 min)". The minutes are unpaid: payroll adds `minutes ÷ working-day minutes` (office start to end, for example 480) to LOP days.
Special leave does not make the day a Half Day, and worked hours exclude it. If the employee never comes back, the auto-checkout job sets their check-out to the leave start time.
HR/Admin can remove a mistaken special leave in **Corrections** (reason required).

| Where | URL | Who |
|---|---|---|
| Admin page | `/admin/smart-attendance` | Super Admin, or a Limited Admin with the *Smart Attendance* permission |
| HR Scanner app (installable PWA) | `/scanner` | **HR Scanner** accounts only |
| Entrance kiosk (PC / tablet) | `/kiosk` | Any device paired with a kiosk key |

**Setup**
1. Run `npm install` in both `backend` and `frontend` (adds `bwip-js`, `html5-qrcode` and `@vladmandic/face-api`).
2. Run `npm run setup-db`. The tables are also created automatically when the server starts.
3. **Admin Management → Add Admin → HR Scanner** creates the HR login. HR accounts cannot open the admin panel.
4. **Smart Attendance → QR Badges & Faces**: generate, print or email each employee's QR/barcode, and register faces by camera or photo upload.
5. **Smart Attendance → Kiosks & Settings**: add a kiosk (card, face or both), open `/kiosk` on the entrance device and paste the key.
   A USB/Bluetooth barcode scanner works out of the box because it types like a keyboard.
6. On the HR phone, open `/scanner`, sign in and use **Add to Home Screen / Install**.

**Corrections:** HR (in the app), Admin and Super Admin can change the check-in/out times or add a note for any past day.
A reason is always required (for example "Scanner machine was not working"). The old values, new values and author are kept.

**Privacy:** face recognition runs in the browser. Only a 128-number face descriptor and a small thumbnail are stored.
Camera access needs HTTPS (or localhost).
