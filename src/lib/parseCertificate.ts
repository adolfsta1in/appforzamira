// PDF certificate parser for Tajikistan conformity certificates (Tojikstandart)

export interface CertificateData {
  A: string; // № п/п
  B: string; // № с ведущим нулём
  C: string; // № сертификата
  D: string; // всегда пустой
  E: string; // № копии
  F: string; // Дата выдачи
  G: string; // Срок действия до
  H: string; // Наименование предприятия и адрес
  I: string; // пустой
  J: string; // пустой
  K: string; // пустой
  L: string; // Оформление (обычно "1")
  M: string; // Наименование продукции
  N: string; // Количество
  O: string; // На основании какого документа
  P: string; // Страна происхождения
  Q: string; // Стоимость
  R: string; // Сумма к оплате
  S: string; // Испытаний
  T: string; // Номер фактуры
  U: string; // Дата
  V: string; // ИНН
}

const MONTHS: Record<string, string> = {
  'январи': '01', 'январ': '01', 'января': '01', 'январь': '01',
  'феврали': '02', 'феврал': '02', 'февраля': '02', 'февраль': '02',
  'марти': '03', 'март': '03', 'марта': '03',
  'апрели': '04', 'апрел': '04', 'апреля': '04', 'апрель': '04',
  'майи': '05', 'май': '05', 'мая': '05',
  'июни': '06', 'июн': '06', 'июня': '06', 'июнь': '06',
  'июли': '07', 'июл': '07', 'июля': '07', 'июль': '07',
  'августи': '08', 'август': '08', 'августа': '08',
  'сентябри': '09', 'сентябр': '09', 'сентября': '09', 'сентябрь': '09',
  'октябри': '10', 'октябр': '10', 'октября': '10', 'октябрь': '10',
  'ноябри': '11', 'ноябр': '11', 'ноября': '11', 'ноябрь': '11',
  'декабри': '12', 'декабр': '12', 'декабря': '12', 'декабрь': '12',
};

function convertDate(raw: string): string {
  // Input like "30 январи 2026" → "30.01.26"
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');
  if (parts.length < 3) return raw;

  const day = parts[0].padStart(2, '0');
  const monthStr = parts[1].toLowerCase();
  const year = parts[2].replace(/[^\d]/g, '');

  const month = MONTHS[monthStr];
  if (!month) return raw;

  const shortYear = year.length === 4 ? year.slice(2) : year;
  return `${day}.${month}.${shortYear}`;
}

function extractBetween(text: string, startMarkers: string[], endMarkers: string[]): string {
  const lower = text.toLowerCase();
  let startIdx = -1;

  for (const marker of startMarkers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1) {
      startIdx = idx + marker.length;
      break;
    }
  }
  if (startIdx === -1) return '';

  let endIdx = text.length;
  for (const marker of endMarkers) {
    const idx = lower.indexOf(marker.toLowerCase(), startIdx);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }

  return text.substring(startIdx, endIdx).trim();
}

function extractDateRange(text: string): { from: string; to: string } {
  // Find section with validity dates
  const validityMarkers = [
    'эътибор дорад аз', 'срок действия с', 'действителен с',
    'эътибор дорад:', 'срок действия'
  ];

  let section = '';
  const lower = text.toLowerCase();
  for (const marker of validityMarkers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      section = text.substring(idx, Math.min(idx + 200, text.length));
      break;
    }
  }

  if (!section) section = text;

  const dates: string[] = [];
  let match;
  const sectionDatePattern = /(\d{1,2})\s+(январ[ьи]?|феврал[ьи]?|март[аи]?|апрел[ьи]?|ма[йяи]|июн[ьяи]?|июл[ьяи]?|август[аи]?|сентябр[ьяи]?|октябр[ьяи]?|ноябр[ьяи]?|декабр[ьяи]?)\s+(\d{4})/gi;

  while ((match = sectionDatePattern.exec(section)) !== null) {
    dates.push(`${match[1]} ${match[2]} ${match[3]}`);
  }

  return {
    from: dates.length > 0 ? convertDate(dates[0]) : '',
    to: dates.length > 1 ? convertDate(dates[1]) : '',
  };
}

function extractCertNumber(text: string): string {
  // Look for certificate number after "СИЛСИЛАИ ТЈТ" or "№"
  const patterns = [
    /СИЛСИЛАИ\s+ТЈТ[^№]*№\s*(\d{4,})/i,
    /№\s*(\d{6})/,
    /ТЈ\s*[\-]?\s*(\d{6})/,
    /сертификат[аи]?\s*(?:мутобиқат)?\s*№?\s*(\d{6})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  // Fallback: find any 6-digit number near the top
  const topSection = text.substring(0, 500);
  const sixDigit = topSection.match(/\b(\d{6})\b/);
  if (sixDigit) return sixDigit[1];

  return '';
}

function extractOrganization(text: string): string {
  const markers = ['сертификат дода шуд', 'сертификат выдан'];
  const endMarkers = ['маҳсулот', 'продукция', 'дар асоси', 'на основании', 'бо талаботи'];

  let result = extractBetween(text, markers, endMarkers);

  // Clean up common prefixes
  result = result.replace(/^[:\s]+/, '');

  // Remove lines that are just field labels
  const lines = result.split('\n').filter(line => {
    const trimmed = line.trim().toLowerCase();
    return trimmed.length > 0 &&
      !trimmed.startsWith('сертификат') &&
      !trimmed.startsWith('certificate');
  });

  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function extractProduct(text: string): string {
  const markers = ['маҳсулот', 'продукция'];
  const endMarkers = ['ба миқдори', 'дар асоси', 'на основании', 'истеҳсол', 'изготовлен',
    'бо талаботи', 'соответствует требованиям'];

  let result = extractBetween(text, markers, endMarkers);
  result = result.replace(/^[:\s\/]+/, '');

  return result.replace(/\s+/g, ' ').trim();
}

function extractQuantity(text: string): string {
  // Look for quantity patterns: "ба миқдори 1000кг" or just "1000кг", "200дона"
  const patterns = [
    /ба миқдори\s+([^\n,]+)/i,
    /количеств[оа]\s*[:\-]?\s*([^\n,]+)/i,
    /(\d+\s*(?:кг|тонна|дона|шт|штук|литр|м|метр|упак)[а-яё]*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

function extractBasis(text: string): string {
  const markers = ['дар асоси', 'на основании'];
  const endMarkers = ['истеҳсол', 'изготовлен', 'страна', 'мамлакат', 'сертификат дода'];

  let result = extractBetween(text, markers, endMarkers);
  result = result.replace(/^[:\s]+/, '');

  return result.replace(/\s+/g, ' ').trim();
}

function extractCountry(text: string): string {
  const markers = ['истеҳсол шудааст', 'изготовлен'];
  const endMarkers = ['эътибор', 'срок действия', 'сертификат'];

  let section = extractBetween(text, markers, endMarkers);
  if (!section) section = text;

  const lower = section.toLowerCase();

  if (lower.includes('тоҷикистон') || lower.includes('таджикистан')) return 'Тоҷикистон';
  if (lower.includes('эрон') || lower.includes('иран')) return 'Эрон';
  if (lower.includes('хитой') || lower.includes('китай')) return 'Хитой';
  if (lower.includes('туркия') || lower.includes('турция')) return 'Туркия';
  if (lower.includes('русия') || lower.includes('россия')) return 'Русия';
  if (lower.includes('ҳиндустон') || lower.includes('индия')) return 'Ҳиндустон';
  if (lower.includes('покистон') || lower.includes('пакистан')) return 'Покистон';
  if (lower.includes('узбекистон') || lower.includes('узбекистан')) return 'Узбекистон';
  if (lower.includes('қирғизистон') || lower.includes('кыргызстан')) return 'Қирғизистон';
  if (lower.includes('қазоқистон') || lower.includes('казахстан')) return 'Қазоқистон';

  return '';
}

export function parseCertificateText(text: string): CertificateData {
  const dates = extractDateRange(text);

  return {
    A: '',
    B: '',
    C: extractCertNumber(text),
    D: '',
    E: '',
    F: dates.from,
    G: dates.to,
    H: extractOrganization(text),
    I: '',
    J: '',
    K: '',
    L: '1',
    M: extractProduct(text),
    N: extractQuantity(text),
    O: extractBasis(text),
    P: extractCountry(text),
    Q: '',
    R: '',
    S: '',
    T: '',
    U: '',
    V: '',
  };
}

export const COLUMN_LABELS: Record<string, string> = {
  A: '№ п/п',
  B: '№',
  C: '№ сертификата',
  D: '*',
  E: '№ копии',
  F: 'Дата выдачи',
  G: 'Срок действия до',
  H: 'Наименование предприятия и адрес',
  I: 'Оформл. 1',
  J: 'Оформл. 2',
  K: 'Оформл. 3',
  L: 'Оформл. 4',
  M: 'Наименование продукции',
  N: 'Кол-во',
  O: 'На основании документа',
  P: 'Страна',
  Q: 'Стоимость (сомони)',
  R: 'Сумма к оплате',
  S: 'Испытаний',
  T: '№ фактуры',
  U: 'Дата',
  V: 'ИНН',
};

export const ALL_COLUMNS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'] as const;
export type ColumnKey = typeof ALL_COLUMNS[number];

export const DISABLED_COLUMNS: ColumnKey[] = ['D', 'I', 'J', 'K'];
export const AUTO_COLUMNS: ColumnKey[] = ['B'];
