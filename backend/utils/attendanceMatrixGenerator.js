const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate Monthly Attendance Matrix - PDF Format
 * Creates a date-wise attendance matrix with color coding
 */
const generateMonthlyAttendanceMatrixPDF = async (matrixRows, month, year, maxDay, holidaysRows = [], attendanceData = []) => {
  return new Promise(async (resolve, reject) => {
    try {
      const holidayMap = {};
      holidaysRows.forEach(h => {
        const day = new Date(h.holiday_date).getDate();
        holidayMap[day] = h;
      });

      const doc = new PDFDocument({ 
        size: 'A3', 
        layout: 'landscape',
        margin: 20
      });

      const fileName = `attendance_report_${month}_${year}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../temp', fileName);

      // Create temp directory if not exists
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Get days in month
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const employees = matrixRows;

      // Header
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('MONTHLY ATTENDANCE REPORT', { align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Month: ${getMonthName(month)} ${year}`, { align: 'center' })
         .moveDown();

      // Legend
      drawLegend(doc);
      doc.moveDown();

      // Calculate dimensions
      const startX = 20;
      const startY = 140;
      const nameColWidth = 120;
      const dateColWidth = 18;
      const rowHeight = 20;

      // Draw table header
      let currentY = startY;
      
      // Header background
      doc.rect(startX, currentY, nameColWidth + (daysInMonth * dateColWidth), rowHeight)
         .fill('#1F2937');

      // Employee Name header
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text('Employee Name', startX + 5, currentY + 6, { width: nameColWidth - 10 });

      // Date headers (1 to maxDay only)
      for (let day = 1; day <= maxDay; day++) {
        const x = startX + nameColWidth + ((day - 1) * dateColWidth);
        doc.text(day.toString(), x + 3, currentY + 6, { width: dateColWidth - 6, align: 'center' });
      }

      currentY += rowHeight;

      // Draw employee rows
      employees.forEach((employee, index) => {
        // Check if need new page
        if (currentY > 550) {
          doc.addPage({ size: 'A3', layout: 'landscape', margin: 20 });
          currentY = 50;
          
          // Redraw header on new page
          doc.rect(startX, currentY, nameColWidth + (daysInMonth * dateColWidth), rowHeight)
             .fill('#1F2937');
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor('#FFFFFF')
             .text('Employee Name', startX + 5, currentY + 6, { width: nameColWidth - 10 });
          for (let day = 1; day <= daysInMonth; day++) {
            const x = startX + nameColWidth + ((day - 1) * dateColWidth);
            doc.text(day.toString(), x + 3, currentY + 6, { width: dateColWidth - 6, align: 'center' });
          }
          currentY += rowHeight;
        }

        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(startX, currentY, nameColWidth + (daysInMonth * dateColWidth), rowHeight)
             .fill('#F9FAFB');
        }

        // Employee name
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#000000')
           .text(employee.employeeName, startX + 5, currentY + 6, { width: nameColWidth - 10 });

        // Draw attendance cells
        for (let day = 1; day <= maxDay; day++) {
          const x = startX + nameColWidth + ((day - 1) * dateColWidth);
          const attendanceCode = employee.days[day]?.code || null;
          const attendanceRecord = employee.days[day]?.record || null;
          
          // Get cell info (Sunday > Holiday > Attendance)
          const cellInfo = getDateCellInfo(day, parseInt(year), parseInt(month), holidayMap, attendanceCode);

          if (cellInfo.type !== 'empty') {
            const color = getStatusColor(cellInfo.code);

            // Cell background
            doc.rect(x, currentY, dateColWidth, rowHeight)
               .fill(color);

            // Determine display text (shorten for holidays)
            let displayText = cellInfo.text;
            let fontSize = 7;
            
            if (cellInfo.type === 'sunday') {
              displayText = 'Sun';
              fontSize = 6;
            } else if (cellInfo.type === 'holiday') {
              displayText = cellInfo.holidayType === 'Government Holiday' ? 'GovH' : 'OffH';
              fontSize = 5;
            } else if (cellInfo.type === 'attendance' && attendanceRecord) {
              if (attendanceRecord.validation_method === 'Manual' || attendanceRecord.absent_reason) {
                displayText += '*';
              }
            }
            
            // Draw horizontal text for all types
            doc.fontSize(fontSize)
               .font('Helvetica-Bold')
               .fillColor(cellInfo.code === 'P' ? '#FFFFFF' : '#000000')
               .text(displayText, x + 1, currentY + 6, { 
                 width: dateColWidth - 2, 
                 align: 'center' 
               });
          } else {
            // Leave cell blank (with light gray border)
            doc.rect(x, currentY, dateColWidth, rowHeight)
               .stroke('#E5E7EB');
          }
        }

        currentY += rowHeight;
      });

      // Add Holidays Table at the bottom
      if (holidaysRows.length > 0) {
        // Check if we need a new page for the holidays table
        const holidaysTableHeight = 80 + (holidaysRows.length * 20);
        if (currentY + holidaysTableHeight > 550) {
          doc.addPage({ size: 'A3', layout: 'landscape', margin: 20 });
          currentY = 50;
        } else {
          currentY += 30; // Add spacing before holidays table
        }

        // Holidays Table Title
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(`Holidays for ${getMonthName(month)} ${year}`, startX, currentY, { align: 'left' });
        
        currentY += 25;

        // Holidays Table Header
        const holidayTableWidth = 700;
        const dateColW = 80;
        const typeColW = 150;
        const titleColW = 250;
        const noteColW = 220;

        doc.rect(startX, currentY, holidayTableWidth, 20)
           .fill('#1F2937');

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#FFFFFF')
           .text('Date', startX + 5, currentY + 5, { width: dateColW - 10 })
           .text('Holiday Type', startX + dateColW + 5, currentY + 5, { width: typeColW - 10 })
           .text('Title', startX + dateColW + typeColW + 5, currentY + 5, { width: titleColW - 10 })
           .text('Remarks', startX + dateColW + typeColW + titleColW + 5, currentY + 5, { width: noteColW - 10 });

        currentY += 20;

        // Holiday rows
        holidaysRows.forEach((holiday, i) => {
          const holidayDate = new Date(holiday.holiday_date);
          const formattedDate = `${holidayDate.getDate()} ${getMonthName(holidayDate.getMonth() + 1).substring(0, 3)} ${holidayDate.getFullYear()}`;

          // Alternate row background
          if (i % 2 === 0) {
            doc.rect(startX, currentY, holidayTableWidth, 20)
               .fill('#F9FAFB');
          }

          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#000000')
             .text(formattedDate, startX + 5, currentY + 5, { width: dateColW - 10 })
             .text(holiday.holiday_type, startX + dateColW + 5, currentY + 5, { width: typeColW - 10 })
             .text(holiday.holiday_title, startX + dateColW + typeColW + 5, currentY + 5, { width: titleColW - 10 })
             .text(holiday.holiday_note || '-', startX + dateColW + typeColW + titleColW + 5, currentY + 5, { width: noteColW - 10 });

          // Draw cell borders
          doc.rect(startX, currentY, dateColW, 20).stroke('#E5E7EB');
          doc.rect(startX + dateColW, currentY, typeColW, 20).stroke('#E5E7EB');
          doc.rect(startX + dateColW + typeColW, currentY, titleColW, 20).stroke('#E5E7EB');
          doc.rect(startX + dateColW + typeColW + titleColW, currentY, noteColW, 20).stroke('#E5E7EB');

          currentY += 20;
        });
      }

      // Add Absent Reasons Table at the bottom
      const absentReasonsList = [];
      attendanceData.forEach(record => {
        if (record.attendance_date && record.attendance_status === 'Absent' && record.absent_reason) {
          absentReasonsList.push(record);
        }
      });
      
      // Sort absent reasons by date
      absentReasonsList.sort((a, b) => new Date(a.attendance_date) - new Date(b.attendance_date));

      if (absentReasonsList.length > 0) {
        const absentTableHeight = 80 + (absentReasonsList.length * 20);
        if (currentY + absentTableHeight > 550) {
          doc.addPage({ size: 'A3', layout: 'landscape', margin: 20 });
          currentY = 50;
        } else {
          currentY += 30; // Add spacing before absent reasons table
        }

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
           .text(`Absent Reasons for ${getMonthName(month)} ${year}`, startX, currentY, { align: 'left' });
        currentY += 25;

        const abTableWidth = 700;
        const abDateColW = 80;
        const abEmpColW = 150;
        const abReasonColW = 470;

        doc.rect(startX, currentY, abTableWidth, 20).fill('#1F2937');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
           .text('Date', startX + 5, currentY + 5, { width: abDateColW - 10 })
           .text('Employee', startX + abDateColW + 5, currentY + 5, { width: abEmpColW - 10 })
           .text('Reason', startX + abDateColW + abEmpColW + 5, currentY + 5, { width: abReasonColW - 10 });
        currentY += 20;

        absentReasonsList.forEach((ab, index) => {
          const abDate = new Date(ab.attendance_date);
          const fDate = `${abDate.getDate()} ${getMonthName(abDate.getMonth() + 1).substring(0, 3)} ${abDate.getFullYear()}`;

          if (index % 2 === 0) {
            doc.rect(startX, currentY, abTableWidth, 20).fill('#F9FAFB');
          }

          doc.fontSize(8).font('Helvetica').fillColor('#000000')
             .text(fDate, startX + 5, currentY + 5, { width: abDateColW - 10 })
             .text(`${ab.name} (${ab.employee_id})`, startX + abDateColW + 5, currentY + 5, { width: abEmpColW - 10 })
             .text(ab.absent_reason, startX + abDateColW + abEmpColW + 5, currentY + 5, { width: abReasonColW - 10 });

          doc.rect(startX, currentY, abDateColW, 20).stroke('#E5E7EB');
          doc.rect(startX + abDateColW, currentY, abEmpColW, 20).stroke('#E5E7EB');
          doc.rect(startX + abDateColW + abEmpColW, currentY, abReasonColW, 20).stroke('#E5E7EB');

          currentY += 20;
        });
      }

      // Footer — use bufferedPageRange to avoid out-of-bounds on single-page PDFs
      const range = doc.bufferedPageRange();
      const pageCount = range.count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(range.start + i);
        doc.fontSize(8)
           .fillColor('#6B7280')
           .text(
             `Page ${i + 1} of ${pageCount} | Generated on: ${new Date().toLocaleString()} | Showing dates 1-${maxDay}`,
             20,
             doc.page.height - 30,
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

/**
 * Generate Monthly Attendance Matrix - Excel Format
 */
const generateMonthlyAttendanceMatrixExcel = async (matrixRows, month, year, maxDay, holidaysRows = [], attendanceData = []) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    const holidayMap = {};
    holidaysRows.forEach(h => {
      const day = new Date(h.holiday_date).getDate();
      holidayMap[day] = h;
    });

    // Get days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const employees = matrixRows;

    // Configure worksheet properties for cleaner look
    worksheet.properties.defaultRowHeight = 18;

    // Title
    worksheet.mergeCells('A1', `${String.fromCharCode(65 + maxDay)}1`);
    worksheet.getCell('A1').value = 'MONTHLY ATTENDANCE REPORT';
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 25;

    // Subtitle
    worksheet.mergeCells('A2', `${String.fromCharCode(65 + maxDay)}2`);
    worksheet.getCell('A2').value = `${getMonthName(month)} ${year} (Showing dates 1-${maxDay})`;
    worksheet.getCell('A2').font = { bold: true, size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    // Legend
    worksheet.mergeCells('A3', `${String.fromCharCode(65 + maxDay)}3`);
    worksheet.getCell('A3').value = 'Legend: P = Present (Green) | Late = Late (Yellow) | HD = Half Day (Blue) | A = Absent (Red) | Sun = Sunday (Gray) | GovH = Government Holiday (Orange) | OffH = Office Holiday (Purple)';
    worksheet.getCell('A3').font = { size: 10, italic: true };
    worksheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(3).height = 20;

    // Header row
    const headerRow = worksheet.getRow(5);
    headerRow.getCell(1).value = 'Employee Name';
    headerRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' }
    };
    headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.getCell(1).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Date headers (1 to maxDay only)
    for (let day = 1; day <= maxDay; day++) {
      const cell = headerRow.getCell(day + 1);
      cell.value = day;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
    headerRow.height = 20;

    // Employee rows
    employees.forEach((employee, index) => {
      const row = worksheet.getRow(6 + index);
      
      // Employee name
      const nameCell = row.getCell(1);
      nameCell.value = employee.employeeName;
      nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
      nameCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Attendance cells (1 to maxDay only)
      for (let day = 1; day <= maxDay; day++) {
        const cell = row.getCell(day + 1);
        const attendanceCode = employee.days[day]?.code || null;
        const attendanceRecord = employee.days[day]?.record || null;
        
        // Get cell info (Sunday > Holiday > Attendance)
        const cellInfo = getDateCellInfo(day, parseInt(year), parseInt(month), holidayMap, attendanceCode);
        
        if (cellInfo.type !== 'empty') {
          // Determine display text (shortened for readability)
          let displayText = cellInfo.text;
          
          if (cellInfo.type === 'sunday') {
            displayText = 'Sun';
          } else if (cellInfo.type === 'holiday') {
            displayText = cellInfo.holidayType === 'Government Holiday' ? 'GovH' : 'OffH';
          }
          
          cell.value = displayText;
          cell.font = { bold: true, size: cellInfo.type === 'attendance' ? 9 : 7 };
          
          // Horizontal text for all (no rotation)
          cell.alignment = { 
            horizontal: 'center', 
            vertical: 'middle'
          };
          
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: getExcelStatusColor(cellInfo.code) }
          };
          
          // Add holiday note as comment if exists
          if (cellInfo.type === 'holiday' && cellInfo.note) {
            cell.note = {
              texts: [
                { 
                  font: { bold: true, size: 10, name: 'Calibri' },
                  text: `${cellInfo.title}\n\n`
                },
                {
                  font: { size: 9, name: 'Calibri' },
                  text: cellInfo.note
                }
              ],
              margins: {
                insetmode: 'custom',
                inset: [0.25, 0.25, 0.35, 0.35]
              }
            };
          }
        } else {
          // Leave blank with just border
          cell.value = '';
        }
        
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      row.height = 18;
    });

    // Add Holidays Table below the attendance matrix
    if (holidaysRows.length > 0) {
      const holidaysStartRow = 6 + employees.length + 3; // 3 rows gap after attendance matrix

      // Holidays Table Title - span across 4 columns (A to D)
      worksheet.mergeCells(`A${holidaysStartRow}`, `D${holidaysStartRow}`);
      const titleCell = worksheet.getCell(`A${holidaysStartRow}`);
      titleCell.value = `Holidays for ${getMonthName(month)} ${year}`;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getRow(holidaysStartRow).height = 22;

      // Holidays Table Header
      const headerRow = worksheet.getRow(holidaysStartRow + 1);
      
      // Date column
      const dateCell = headerRow.getCell(1);
      dateCell.value = 'Date';
      dateCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      dateCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      // Holiday Type column
      const typeCell = headerRow.getCell(2);
      typeCell.value = 'Holiday Type';
      typeCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      typeCell.alignment = { horizontal: 'center', vertical: 'middle' };
      typeCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      // Title column
      const titleColCell = headerRow.getCell(3);
      titleColCell.value = 'Title';
      titleColCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      titleColCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      titleColCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleColCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      // Remarks column
      const remarksCell = headerRow.getCell(4);
      remarksCell.value = 'Remarks';
      remarksCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      remarksCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      remarksCell.alignment = { horizontal: 'center', vertical: 'middle' };
      remarksCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      headerRow.height = 20;

      // Holidays Table Data Rows
      holidaysRows.forEach((holiday, index) => {
        const dataRow = worksheet.getRow(holidaysStartRow + 2 + index);
        const holidayDate = new Date(holiday.holiday_date);
        
        // Format date to match PDF: "15 Jun 2026" (not "15-Jun-2026")
        const day = holidayDate.getDate();
        const monthName = getMonthName(holidayDate.getMonth() + 1).substring(0, 3);
        const year = holidayDate.getFullYear();
        const formattedDate = `${day} ${monthName} ${year}`;
        
        // Date
        const dateCellData = dataRow.getCell(1);
        dateCellData.value = formattedDate;
        dateCellData.alignment = { horizontal: 'center', vertical: 'middle' };
        dateCellData.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        // Holiday Type
        const typeCellData = dataRow.getCell(2);
        typeCellData.value = holiday.holiday_type;
        typeCellData.alignment = { horizontal: 'left', vertical: 'middle' };
        typeCellData.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        // Color code the type cell
        if (holiday.holiday_type === 'Government Holiday') {
          typeCellData.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } }; // Light orange
        } else {
          typeCellData.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } }; // Light purple
        }
        
        // Title
        const titleCellData = dataRow.getCell(3);
        titleCellData.value = holiday.holiday_title;
        titleCellData.alignment = { horizontal: 'left', vertical: 'middle' };
        titleCellData.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        // Remarks
        const remarksCellData = dataRow.getCell(4);
        remarksCellData.value = holiday.holiday_note || '-';
        remarksCellData.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        remarksCellData.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        dataRow.height = 18;
      });
    }

    // Configure page setup for printing
    worksheet.pageSetup.paperSize = 9; // A4
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0; // As many pages as needed vertically

    // Auto-fit the Employee Name column based on content
    let maxNameLength = 15; // minimum width
    employees.forEach(emp => {
      if (emp.name && emp.name.length > maxNameLength) {
        maxNameLength = Math.min(emp.name.length, 35); // max 35 chars
      }
    });
    
    // Set column widths based on whether holidays table exists
    if (holidaysRows.length > 0) {
      // Holidays table exists - set widths for attendance matrix first
      worksheet.getColumn(1).width = maxNameLength; // Employee Name
      
      // Set date columns for attendance matrix
      for (let day = 1; day <= maxDay; day++) {
        worksheet.getColumn(day + 1).width = 5;
      }
      
      // Note: Holidays table uses columns A-D starting from a different row
      // So we don't override the attendance matrix columns
    } else {
      // No holidays table - use employee name width and date columns
      worksheet.getColumn(1).width = maxNameLength;
      // Ensure date columns are properly sized
      for (let day = 1; day <= maxDay; day++) {
        worksheet.getColumn(day + 1).width = 5;
      }
    }

    // Hide columns only after the attendance matrix ends
    const hideStartCol = maxDay + 2; // Hide columns after the last date column
    const maxExcelColumns = 100;
    for (let col = hideStartCol; col <= maxExcelColumns; col++) {
      worksheet.getColumn(col).hidden = true;
    }

    // Set print area - attendance matrix uses full width, holidays table below uses columns A-D
    const lastRow = 6 + employees.length - 1 + (holidaysRows.length > 0 ? (3 + holidaysRows.length + 1) : 0);
    const lastColLetter = String.fromCharCode(65 + maxDay); // Attendance matrix width
    worksheet.pageSetup.printArea = `A1:${lastColLetter}${lastRow}`;

    // Define worksheet dimensions and freeze panes
    const lastCol = maxDay + 1;
    
    // Set worksheet dimensions explicitly
    worksheet.lastRow = worksheet.getRow(lastRow);
    worksheet.lastColumn = worksheet.getColumn(lastCol);
    
    // Configure freeze panes (only Employee Name column and header rows)
    // This prevents duplicate appearing when scrolling
    worksheet.views = [
      { 
        state: 'frozen', 
        xSplit: 1,  // Freeze column A (Employee Name)
        ySplit: 5,  // Freeze rows 1-5 (Title, Legend, Headers)
        topLeftCell: 'B6', // Start scrolling from B6
        activeCell: 'A1'
      }
    ];

    // ── Absent Reasons Table ──────────────────────────────────────────────
    const absentReasonsList = [];
    attendanceData.forEach(record => {
      if (record.attendance_date && record.attendance_status === 'Absent' && record.absent_reason) {
        absentReasonsList.push(record);
      }
    });
    absentReasonsList.sort((a, b) => new Date(a.attendance_date) - new Date(b.attendance_date));

    if (absentReasonsList.length > 0) {
      // Calculate start row: after matrix + gap + holidays
      const matrixEndRow = 5 + employees.length; // rows 1-5 header, then employee rows
      const holidayBlockRows = holidaysRows.length > 0 ? (2 + holidaysRows.length + 2) : 0;
      const absentStartRow = matrixEndRow + holidayBlockRows + 3;

      // Title
      worksheet.mergeCells(`A${absentStartRow}`, `C${absentStartRow}`);
      const abTitleCell = worksheet.getCell(`A${absentStartRow}`);
      abTitleCell.value = `Absent Reasons – ${getMonthName(month)} ${year}`;
      abTitleCell.font = { bold: true, size: 13 };
      abTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getRow(absentStartRow).height = 22;

      // Header row
      const abHeaderRow = worksheet.getRow(absentStartRow + 1);

      const abH1 = abHeaderRow.getCell(1);
      abH1.value = 'Date';
      abH1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      abH1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      abH1.alignment = { horizontal: 'center', vertical: 'middle' };
      abH1.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      const abH2 = abHeaderRow.getCell(2);
      abH2.value = 'Employee';
      abH2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      abH2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      abH2.alignment = { horizontal: 'center', vertical: 'middle' };
      abH2.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      const abH3 = abHeaderRow.getCell(3);
      abH3.value = 'Reason';
      abH3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      abH3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      abH3.alignment = { horizontal: 'left', vertical: 'middle' };
      abH3.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      abHeaderRow.height = 20;

      absentReasonsList.forEach((ab, idx) => {
        const dataRow = worksheet.getRow(absentStartRow + 2 + idx);

        const abDate = new Date(ab.attendance_date);
        const fDate = `${abDate.getDate()} ${getMonthName(abDate.getMonth() + 1).substring(0, 3)} ${abDate.getFullYear()}`;

        const c1 = dataRow.getCell(1);
        c1.value = fDate;
        c1.alignment = { horizontal: 'center', vertical: 'middle' };
        c1.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const c2 = dataRow.getCell(2);
        c2.value = `${ab.name} (${ab.employee_id})`;
        c2.alignment = { horizontal: 'left', vertical: 'middle' };
        c2.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const c3 = dataRow.getCell(3);
        c3.value = ab.absent_reason;
        c3.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        c3.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        dataRow.height = 20;
      });

      // Widen columns A, B, C for the absent reasons table
      worksheet.getColumn(1).width = Math.max(worksheet.getColumn(1).width || 15, 15);
      worksheet.getColumn(2).width = Math.max(worksheet.getColumn(2).width || 30, 30);
      worksheet.getColumn(3).width = 50;
    }

    // Save file
    const fileName = `attendance_report_${month}_${year}_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../temp', fileName);
    
    await workbook.xlsx.writeFile(filePath);

    return { filePath, fileName };

  } catch (error) {
    throw error;
  }
};

// Helper functions
function getAttendanceCodeFromDB(record) {
  // Only return status if there's actual attendance data from database
  if (!record.login_time && record.attendance_status === 'Absent') {
    // True absent (has explicit absent record in DB)
    return 'A';
  }
  
  if (!record.login_time) {
    // No data - should not happen, but return null to leave blank
    return null;
  }
  
  const status = record.attendance_status;
  
  if (status === 'Late') return 'Late';
  if (status === 'Half Day') return 'HD';
  if (status === 'Present' || status === 'Work From Home') return 'P';
  if (status === 'Absent') return 'A';
  
  return null;
}

function getStatusColor(code) {
  const colors = {
    'P': '#10B981',      // Green
    'Late': '#FCD34D',   // Yellow
    'HD': '#60A5FA',     // Blue
    'A': '#EF4444',      // Red
    'Sunday': '#9CA3AF', // Gray
    'Government Holiday': '#F97316',  // Orange
    'Office Holiday': '#8B5CF6'  // Purple
  };
  return colors[code] || '#E5E7EB';
}

function getExcelStatusColor(code) {
  const colors = {
    'P': 'FF10B981',      // Green
    'Late': 'FFFCD34D',   // Yellow
    'HD': 'FF60A5FA',     // Blue
    'A': 'FFEF4444',      // Red
    'Sunday': 'FF9CA3AF', // Gray
    'Government Holiday': 'FFF97316',  // Orange
    'Office Holiday': 'FF8B5CF6'  // Purple
  };
  return colors[code] || 'FFE5E7EB';
}

// Check if date is Sunday
function isSunday(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

// Get holiday info for a specific date
function getHolidayForDate(day, holidayMap) {
  return holidayMap[day] || null;
}

// Get display text for date cell (handles Sunday/Holiday/Attendance)
function getDateCellInfo(day, year, month, holidayMap, attendanceCode) {
  // Priority: Sunday > Holiday > Attendance
  
  // Check Sunday
  if (isSunday(year, month, day)) {
    return {
      text: 'Sunday',
      code: 'Sunday',
      type: 'sunday'
    };
  }
  
  // Check Holiday
  const holiday = getHolidayForDate(day, holidayMap);
  if (holiday) {
    return {
      text: holiday.holiday_type,
      code: holiday.holiday_type,
      type: 'holiday',
      holidayType: holiday.holiday_type,
      title: holiday.holiday_title,
      note: holiday.holiday_note
    };
  }
  
  // Return attendance code
  if (attendanceCode) {
    return {
      text: attendanceCode,
      code: attendanceCode,
      type: 'attendance'
    };
  }
  
  // No data
  return {
    text: '',
    code: null,
    type: 'empty'
  };
}

function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

function drawLegend(doc) {
  const startX = 50;
  const startY = 100;
  const boxSize = 12;
  const spacing = 90;

  // Present
  doc.rect(startX, startY, boxSize, boxSize).fill('#10B981');
  doc.fontSize(9).font('Helvetica').fillColor('#000000')
     .text('P = Present', startX + boxSize + 5, startY + 2);

  // Late
  doc.rect(startX + spacing, startY, boxSize, boxSize).fill('#FCD34D');
  doc.text('Late', startX + spacing + boxSize + 5, startY + 2);

  // Half Day
  doc.rect(startX + (spacing * 2), startY, boxSize, boxSize).fill('#60A5FA');
  doc.text('HD = Half Day', startX + (spacing * 2) + boxSize + 5, startY + 2);

  // Absent
  doc.rect(startX + (spacing * 3), startY, boxSize, boxSize).fill('#EF4444');
  doc.text('A = Absent', startX + (spacing * 3) + boxSize + 5, startY + 2);

  // Row 2
  const startY2 = startY + 18;
  
  // Sunday
  doc.rect(startX, startY2, boxSize, boxSize).fill('#9CA3AF');
  doc.text('Sun = Sunday', startX + boxSize + 5, startY2 + 2);

  // Government Holiday
  doc.rect(startX + spacing, startY2, boxSize, boxSize).fill('#F97316');
  doc.text('GovH = Gov Holiday', startX + spacing + boxSize + 5, startY2 + 2);

  // Office Holiday
  doc.rect(startX + (spacing * 2), startY2, boxSize, boxSize).fill('#8B5CF6');
  doc.text('OffH = Office Holiday', startX + (spacing * 2) + boxSize + 5, startY2 + 2);

  // Note about blanks
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6B7280')
     .text('(Blank cells = No record, * = Manual / Absent Reason)', startX, startY2 + 20);
}

module.exports = {
  generateMonthlyAttendanceMatrixPDF,
  generateMonthlyAttendanceMatrixExcel
};
