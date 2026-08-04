const fs = require('fs');
const path = require('path');
const { generateSinglePayslipBuffer, getSignaturePath } = require('../utils/payslipGenerator');

async function testPayslipPDF() {
  console.log('🧪 Testing Payslip PDF Generator...');

  const sigPath = getSignaturePath();
  console.log('📌 Signature path resolved:', sigPath);

  const mockRecord = {
    employee_id: 'EMP001',
    employee_code: 'EMP001',
    employee_name: 'John Doe',
    job_role: 'Software Engineer',
    department_name: 'Engineering',
    total_days: 30,
    working_days: 22,
    paid_days: 22,
    present_days: 22,
    absent_days: 0,
    basic_salary: 30000,
    hra: 15000,
    special_allowance: 5000,
    lop_amount: 0,
    professional_tax: 200,
    tds: 0,
    staff_advance: 0,
    net_payable: 49800
  };

  try {
    // 1. Test Without Signature
    const unsignedBuffer = await generateSinglePayslipBuffer(mockRecord, 8, 2026, { includeSignature: false });
    const unsignedPath = path.join(__dirname, '../temp/test_payslip_unsigned.pdf');
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(unsignedPath, unsignedBuffer);
    console.log(`✅ Unsigned PDF generated (${unsignedBuffer.length} bytes): ${unsignedPath}`);

    // 2. Test With Signature
    const signedBuffer = await generateSinglePayslipBuffer(mockRecord, 8, 2026, { includeSignature: true });
    const signedPath = path.join(__dirname, '../temp/test_payslip_signed.pdf');
    fs.writeFileSync(signedPath, signedBuffer);
    console.log(`✅ Signed PDF generated (${signedBuffer.length} bytes): ${signedPath}`);

    console.log('🎉 ALL PAYSLIP PDF TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ PDF Test Error:', err);
  }
}

testPayslipPDF();
