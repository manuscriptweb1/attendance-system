const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Project-attendance/backend/controllers/attendanceController.js');
let content = fs.readFileSync(targetFile, 'utf8');

const blockToRemove = `    // Check WFH permission
    const wfhResult = await pool.query(
      'SELECT is_enabled FROM wfh_permissions WHERE employee_id = $1',
      [employeeCode]
    );

    const isWFH = wfhResult.rows.length > 0 && wfhResult.rows[0].is_enabled;`;

// normalize line endings to do search
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedBlock = blockToRemove.replace(/\r\n/g, '\n');

if (normalizedContent.indexOf(normalizedBlock) !== -1) {
    const updatedContent = normalizedContent.replace(normalizedBlock, '');
    fs.writeFileSync(targetFile, updatedContent);
    console.log("Removed duplicate successfully");
} else {
    console.log("Block not found. Looking manually...");
    // Fallback: regex to find the duplicate block
    const fallbackRegex = /\s*\/\/ Check WFH permission\s*const wfhResult = await pool\.query\(\s*'SELECT is_enabled FROM wfh_permissions WHERE employee_id = \$1',\s*\[employeeCode\]\s*\);\s*const isWFH = wfhResult\.rows\.length > 0 && wfhResult\.rows\[0\]\.is_enabled;/;
    
    if (fallbackRegex.test(content)) {
        content = content.replace(fallbackRegex, '');
        fs.writeFileSync(targetFile, content);
        console.log("Removed duplicate successfully using fallback regex");
    } else {
        console.log("Could not find the block.");
    }
}
