/**
 * Converts a numeric amount into words formatted in the Indian numbering system.
 * e.g., 15000 -> "Fifteen Thousand Only"
 * e.g., 25500.50 -> "Twenty Five Thousand Five Hundred and Fifty Paise Only"
 * e.g., 150000 -> "One Lakh Fifty Thousand Only"
 */
export function numberToWordsINR(amount) {
  if (amount === undefined || amount === null || amount === '') return '';

  const num = Math.round(Number(amount));
  if (isNaN(num) || num <= 0) return '';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertTwoDigits(n) {
    if (n < 20) return ones[n];
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    return `${tens[ten]}${unit ? ' ' + ones[unit] : ''}`.trim();
  }

  function convertThreeDigits(n) {
    if (n === 0) return '';
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += `${ones[hundred]} Hundred`;
    }
    if (rest > 0) {
      res += `${res ? ' ' : ''}${convertTwoDigits(rest)}`;
    }
    return res.trim();
  }

  // Indian Numbering System: Crores, Lakhs, Thousands, Hundreds
  let crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;

  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  let thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  let hundred = remainder;

  let words = [];

  if (crore > 0) {
    words.push(`${convertTwoDigits(crore)} Crore`);
  }
  if (lakh > 0) {
    words.push(`${convertTwoDigits(lakh)} Lakh`);
  }
  if (thousand > 0) {
    words.push(`${convertTwoDigits(thousand)} Thousand`);
  }
  if (hundred > 0) {
    words.push(convertThreeDigits(hundred));
  }

  if (words.length === 0) return 'Zero Only';

  return `${words.join(' ')} Only`;
}

export default numberToWordsINR;
