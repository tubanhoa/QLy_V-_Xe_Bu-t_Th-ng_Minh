/**
 * Chuyển đổi số tiền thành chữ tiếng Việt chuẩn hóa đơn tài chính
 */
const NUMBERS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readGroup(group: string, isFirstGroup: boolean): string {
  const [c, b, a] = group.padStart(3, '0').split('').map(Number);
  let res = '';

  if (c !== 0 || b !== 0 || a !== 0) {
    if (c !== 0) {
      res += `${NUMBERS[c]} trăm `;
    } else if (!isFirstGroup) {
      res += 'không trăm ';
    }

    if (b === 0 && a !== 0) {
      if (c !== 0 || !isFirstGroup) {
        res += 'linh ';
      }
    } else if (b === 1) {
      res += 'mười ';
    } else if (b > 1) {
      res += `${NUMBERS[b]} mươi `;
    }

    if (a === 1 && b > 1) {
      res += 'mốt ';
    } else if (a === 5 && b > 0) {
      res += 'lăm ';
    } else if (a !== 0) {
      res += `${NUMBERS[a]} `;
    }
  }
  return res.trim();
}

export function numberToVietnameseWords(amount: number): string {
  const num = Math.round(Math.abs(amount));
  if (num === 0) return 'Không đồng chẵn';

  const str = num.toString();
  const groups: string[] = [];
  for (let i = str.length; i > 0; i -= 3) {
    groups.unshift(str.substring(Math.max(0, i - 3), i));
  }

  let words = '';
  for (let i = 0; i < groups.length; i++) {
    const isFirstGroup = i === 0;
    const groupWords = readGroup(groups[i], isFirstGroup);
    if (groupWords) {
      const scaleIndex = groups.length - 1 - i;
      words += `${groupWords} ${SCALES[scaleIndex]} `;
    }
  }

  words = words.trim().replace(/\s+/g, ' ');
  if (!words) return 'Không đồng chẵn';

  const formatted = words.charAt(0).toUpperCase() + words.slice(1) + ' đồng chẵn';
  return formatted;
}

export const vietnameseNumberToWords = numberToVietnameseWords;
