const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateMonthlyAttendancePDF = (attendanceData, month, year) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'landscape',
        margin: 30 
      });

      const fileName = `attendance_${month}_${year}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../temp', fileName);

      // Create temp directory if not exists
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('Employee Attendance Report', { align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Month: ${month}/${year}`, { align: 'center' })
         .moveDown();

      doc.fontSize(10)
         .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
         .moveDown(2);

      // Table Header
      const tableTop = 150;
      const rowHeight = 25;
      let currentY = tableTop;

      // Column positions
      const cols = {
        empId: 30,
        name: 70,
        dept: 140,
        role: 200,
        mobile: 260,
        date: 320,
        login: 375,
        logout: 420,
        hours: 465,
        status: 505,
        reason: 555,
        wfh: 715
      };

      // Draw header background
      doc.rect(cols.empId, currentY - 5, 750, rowHeight)
         .fill('#4B5563');

      // Header text
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text('Emp ID', cols.empId + 2, currentY + 5, { width: 38 })
         .text('Name', cols.name + 2, currentY + 5, { width: 68 })
         .text('Dept', cols.dept + 2, currentY + 5, { width: 58 })
         .text('Role', cols.role + 2, currentY + 5, { width: 58 })
         .text('Mobile', cols.mobile + 2, currentY + 5, { width: 58 })
         .text('Date', cols.date + 2, currentY + 5, { width: 53 })
         .text('Login', cols.login + 2, currentY + 5, { width: 43 })
         .text('Logout', cols.logout + 2, currentY + 5, { width: 43 })
         .text('Hours', cols.hours + 2, currentY + 5, { width: 38 })
         .text('Status', cols.status + 2, currentY + 5, { width: 48 })
         .text('Reason', cols.reason + 2, currentY + 5, { width: 158 })
         .text('WFH', cols.wfh + 2, currentY + 5, { width: 33 });

      currentY += rowHeight;

      // Table rows
      doc.font('Helvetica').fontSize(7).fillColor('#000000');

      attendanceData.forEach((record, index) => {
        // Check if we need a new page
        if (currentY > 520) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
          currentY = 50;
        }

        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(cols.empId, currentY - 5, 750, rowHeight)
             .fill('#F3F4F6');
        }

        const truncate = (text, maxLength) => {
          if (!text) return '-';
          return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        doc.fillColor('#000000')
           .text(record.employee_id || '-', cols.empId + 2, currentY + 5, { width: 38 })
           .text(truncate(record.name, 12), cols.name + 2, currentY + 5, { width: 68 })
           .text(truncate(record.department, 10), cols.dept + 2, currentY + 5, { width: 58 })
           .text(truncate(record.job_role, 10), cols.role + 2, currentY + 5, { width: 58 })
           .text(record.mobile || '-', cols.mobile + 2, currentY + 5, { width: 58 })
           .text(record.attendance_date ? new Date(record.attendance_date).toLocaleDateString() : '-', cols.date + 2, currentY + 5, { width: 53 })
           .text(record.login_time ? new Date(record.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-', cols.login + 2, currentY + 5, { width: 43 })
           .text(record.logout_time ? new Date(record.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-', cols.logout + 2, currentY + 5, { width: 43 })
           .text(record.total_working_hours ? `${record.total_working_hours}h` : '-', cols.hours + 2, currentY + 5, { width: 38 })
           .text((record.attendance_status || '-') + (record.validation_method === 'Manual' ? ' (M)' : ''), cols.status + 2, currentY + 5, { width: 48 })
           .text(truncate(record.absent_reason, 35), cols.reason + 2, currentY + 5, { width: 158 })
           .text(record.is_wfh ? 'Yes' : 'No', cols.wfh + 2, currentY + 5, { width: 33 });

        currentY += rowHeight;
      });

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#6B7280')
           .text(
             `Page ${i + 1} of ${pageCount}`,
             30,
             doc.page.height - 50,
             { align: 'center' }
           );
      }

      doc.end();

      stream.on('finish', () => {
        resolve({ filePath, fileName });
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

const generateAdminLoginLogsPDF = (logsData, startDate, endDate) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'landscape',
        margin: 30 
      });

      const fileName = `admin_login_logs_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../temp', fileName);

      // Create temp directory if not exists
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('Admin Login Logs Report', { align: 'center' });
      
      if (startDate && endDate) {
        doc.fontSize(12)
           .font('Helvetica')
           .text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, { align: 'center' })
           .moveDown();
      }

      doc.fontSize(10)
         .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
         .text(`Total Logins: ${logsData.length}`, { align: 'center' })
         .moveDown(2);

      // Table Header
      const tableTop = 150;
      const rowHeight = 30;
      let currentY = tableTop;

      // Column positions
      const cols = {
        id: 30,
        username: 80,
        loginTime: 180,
        ipAddress: 300,
        browser: 400,
        device: 580
      };

      // Draw header background
      doc.rect(cols.id, currentY - 5, 730, rowHeight)
         .fill('#4B5563');

      // Header text
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text('ID', cols.id + 5, currentY + 8, { width: 45 })
         .text('Username', cols.username + 5, currentY + 8, { width: 95 })
         .text('Login Time', cols.loginTime + 5, currentY + 8, { width: 115 })
         .text('IP Address', cols.ipAddress + 5, currentY + 8, { width: 95 })
         .text('Browser', cols.browser + 5, currentY + 8, { width: 175 })
         .text('Device', cols.device + 5, currentY + 8, { width: 175 });

      currentY += rowHeight;

      // Table rows
      doc.font('Helvetica').fontSize(8).fillColor('#000000');

      logsData.forEach((log, index) => {
        // Check if we need a new page
        if (currentY > 500) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
          currentY = 50;
        }

        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(cols.id, currentY - 5, 730, rowHeight)
             .fill('#F3F4F6');
        }

        // Truncate long text
        const truncate = (text, maxLength) => {
          if (!text) return '-';
          return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        doc.fillColor('#000000')
           .text(log.id || '-', cols.id + 5, currentY + 8, { width: 45 })
           .text(log.username || '-', cols.username + 5, currentY + 8, { width: 95 })
           .text(log.login_time ? new Date(log.login_time).toLocaleString() : '-', cols.loginTime + 5, currentY + 8, { width: 115 })
           .text(log.ip_address || '-', cols.ipAddress + 5, currentY + 8, { width: 95 })
           .text(truncate(log.browser_info, 30), cols.browser + 5, currentY + 8, { width: 175 })
           .text(truncate(log.device_info, 30), cols.device + 5, currentY + 8, { width: 175 });

        currentY += rowHeight;
      });

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#6B7280')
           .text(
             `Page ${i + 1} of ${pageCount}`,
             30,
             doc.page.height - 50,
             { align: 'center' }
           );
      }

      doc.end();

      stream.on('finish', () => {
        resolve({ filePath, fileName });
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateMonthlyAttendancePDF, generateAdminLoginLogsPDF };
