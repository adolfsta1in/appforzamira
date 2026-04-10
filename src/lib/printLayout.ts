// Print layout configuration — field positions on A4 blank (in mm)
// These are configurable and can be adjusted via the settings page

export interface FieldPosition {
  top: number;
  left: number;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  maxWidth?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  paddingLeft?: number;
  width?: number;
}

export interface PrintLayoutConfig {
  dateStartDay: FieldPosition;
  dateStartMonth: FieldPosition;
  dateStartYear: FieldPosition;
  dateEndDay: FieldPosition;
  dateEndMonth: FieldPosition;
  dateEndYear: FieldPosition;
  certBodyName: FieldPosition;
  certBodyAddress: FieldPosition;
  certBodyNumber: FieldPosition;
  products: FieldPosition;
  codeNUM: FieldPosition;
  codeNM: FieldPosition;
  normDocs: FieldPosition;
  country: FieldPosition;
  issuedToOrg: FieldPosition;
  issuedToAddress: FieldPosition;
  basis: FieldPosition;
  additionalInfo: FieldPosition;
  headName: FieldPosition;
  deptHeadName: FieldPosition;
}

export const DEFAULT_PRINT_LAYOUT: PrintLayoutConfig = {
  // Срок действия — 6 полей в ряд (y≈47mm), каждое центрировано в своей ячейке
  dateStartDay: { top: 47, left: 18, fontSize: 11, bold: true, width: 9, textAlign: 'center' },
  dateStartMonth: { top: 47, left: 28, fontSize: 11, bold: true, width: 33, textAlign: 'center' },
  dateStartYear: { top: 47, left: 62, fontSize: 11, bold: true, width: 18, textAlign: 'center' },
  dateEndDay: { top: 47, left: 103, fontSize: 11, bold: true, width: 9, textAlign: 'center' },
  dateEndMonth: { top: 47, left: 113, fontSize: 11, bold: true, width: 38, textAlign: 'center' },
  dateEndYear: { top: 47, left: 152, fontSize: 11, bold: true, width: 18, textAlign: 'center' },

  // Орган по сертификации — центрирован (y≈57, 65)
  certBodyName: { top: 57, left: 18, fontSize: 10, bold: true, italic: true, width: 175, textAlign: 'center' },
  certBodyAddress: { top: 65, left: 18, fontSize: 10, bold: true, italic: true, width: 175, textAlign: 'center' },
  // Рег. номер органа — верх по центру (y≈19)
  certBodyNumber: { top: 19, left: 18, fontSize: 10, bold: true, width: 175, textAlign: 'center' },

  // Продукция — широкий блок, центрирован (y≈79)
  products: { top: 79, left: 18, fontSize: 10, bold: true, italic: true, maxWidth: 175, lineHeight: 14, textAlign: 'center' },

  // Коды — центрирован в правой части (y≈101, 109)
  codeNUM: { top: 101, left: 73, fontSize: 8, width: 120, textAlign: 'center' },
  codeNM: { top: 109, left: 73, fontSize: 8, width: 120, textAlign: 'center' },

  // Нормативные документы — центрирован (y≈126)
  normDocs: { top: 126, left: 18, fontSize: 10, bold: true, italic: true, maxWidth: 175, lineHeight: 14, textAlign: 'center' },

  // Страна изготовления — центрирован (y≈142)
  country: { top: 142, left: 18, fontSize: 10, bold: true, italic: true, width: 175, textAlign: 'center' },

  // Кому выдан — центрирован (y≈150, 163)
  issuedToOrg: { top: 150, left: 18, fontSize: 10, bold: true, italic: true, width: 175, textAlign: 'center' },
  issuedToAddress: { top: 163, left: 18, fontSize: 10, bold: true, italic: true, width: 175, textAlign: 'center' },

  // На основании — центрирован (y≈174)
  basis: { top: 174, left: 18, fontSize: 10, bold: true, italic: true, maxWidth: 175, lineHeight: 14, textAlign: 'center' },

  // Дополнительная информация — слева (y≈190)
  additionalInfo: { top: 190, left: 18, fontSize: 9, italic: true, maxWidth: 178, textAlign: 'left' },

  // ФИО руководителя — центрирован в правой части (y≈212)
  headName: { top: 212, left: 107, fontSize: 11, bold: true, width: 86, textAlign: 'center' },

  // ФИО начальника отдела — центрирован в правой части (y≈222)
  deptHeadName: { top: 222, left: 107, fontSize: 11, bold: true, width: 86, textAlign: 'center' },
};

export const LAYOUT_FIELD_LABELS: Record<keyof PrintLayoutConfig, string> = {
  dateStartDay: 'Дата начала: день',
  dateStartMonth: 'Дата начала: месяц',
  dateStartYear: 'Дата начала: год',
  dateEndDay: 'Дата окончания: день',
  dateEndMonth: 'Дата окончания: месяц',
  dateEndYear: 'Дата окончания: год',
  certBodyName: 'Орган: название',
  certBodyAddress: 'Орган: адрес',
  certBodyNumber: 'Орган: рег. номер',
  products: 'Продукция',
  codeNUM: 'Код НУМ/ОКП',
  codeNM: 'Код НМ ФИХ/ТН ВЭД',
  normDocs: 'Нормативные документы',
  country: 'Страна изготовления',
  issuedToOrg: 'Кому выдан: организация',
  issuedToAddress: 'Кому выдан: адрес',
  basis: 'На основании',
  additionalInfo: 'Доп. информация',
  headName: 'ФИО руководителя',
  deptHeadName: 'ФИО нач. отдела',
};

const STORAGE_KEY = 'cert_print_layout';

export function loadPrintLayout(): PrintLayoutConfig {
  if (typeof window === 'undefined') return DEFAULT_PRINT_LAYOUT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PRINT_LAYOUT, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PRINT_LAYOUT;
}

export function savePrintLayout(layout: PrintLayoutConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function resetPrintLayout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
