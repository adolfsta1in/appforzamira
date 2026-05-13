// Certificate form data — all fields for both printing and registry

export interface CertificateFormData {
  // Certificate fields (printed on blank)
  cert_number: string;
  cert_number_on_blank: string;
  date_start_day: string;
  date_start_month: string;
  date_start_year: string;
  date_end_day: string;
  date_end_month: string;
  date_end_year: string;
  cert_body_name: string;
  cert_body_address: string;
  cert_body_number: string;
  products: string[];
  quantity: string;
  quantity_unit: string;
  code_num: string;
  code_nm: string;
  norm_documents_1: string;
  norm_documents_2: string;
  country: string;
  issued_to_org: string;
  issued_to_address: string;
  basis_documents: string[];
  additional_info: string[];
  head_name: string;
  dept_head_name: string;

  // Registry-only fields (NOT printed on blank)
  serial_number: string;
  registry_col_d: string;
  copy_number: string;
  cert_processing: string;
  total_cost: string;
  amount_due: string;
  tests: string;
  invoice_number: string;
  invoice_date: string;
  inn: string;
  
  // Track if this is an existing record being edited
  id?: string;
}

export const EMPTY_FORM_DATA: CertificateFormData = {
  cert_number: '',
  cert_number_on_blank: '',
  date_start_day: '',
  date_start_month: '',
  date_start_year: '',
  date_end_day: '',
  date_end_month: '',
  date_end_year: '',
  cert_body_name: 'Агентии Тоҷикстандарт',
  cert_body_address: 'ш. Душанбе, кӯч. Н. Қарабоев 42/2',
  cert_body_number: '',
  products: ['', '', ''],
  quantity: '',
  quantity_unit: '',
  code_num: '',
  code_nm: '',
  norm_documents_1: '',
  norm_documents_2: '',
  country: '',
  issued_to_org: '',
  issued_to_address: '',
  basis_documents: ['', ''],
  additional_info: [''],
  head_name: '',
  dept_head_name: '',
  serial_number: '',
  registry_col_d: '',
  copy_number: '',
  cert_processing: '1',
  total_cost: '',
  amount_due: '',
  tests: '',
  invoice_number: '',
  invoice_date: '',
  inn: '',
  id: undefined,
};

export const TAJIK_MONTHS = [
  { value: 'январи', label: 'январи' },
  { value: 'феврали', label: 'феврали' },
  { value: 'марти', label: 'марти' },
  { value: 'апрели', label: 'апрели' },
  { value: 'майи', label: 'майи' },
  { value: 'июни', label: 'июни' },
  { value: 'июли', label: 'июли' },
  { value: 'августи', label: 'августи' },
  { value: 'сентябри', label: 'сентябри' },
  { value: 'октябри', label: 'октябри' },
  { value: 'ноябри', label: 'ноябри' },
  { value: 'декабри', label: 'декабри' },
] as const;

const MONTH_TO_NUM: Record<string, string> = {
  'январи': '01', 'феврали': '02', 'марти': '03', 'апрели': '04',
  'майи': '05', 'июни': '06', 'июли': '07', 'августи': '08',
  'сентябри': '09', 'октябри': '10', 'ноябри': '11', 'декабри': '12',
};

export function formatDateDDMMYY(day: string, month: string, year: string): string {
  if (!day || !month || !year) return '';
  const mm = MONTH_TO_NUM[month] || month;
  const dd = day.padStart(2, '0');
  return `${dd}.${mm}.${year}`;
}

// Map form data → columns for Excel copy/export
// N1 is a new column inserted between N (quantity) and O (basis documents);
// using string key 'N1' keeps downstream O..V code unchanged while shifting the visual column in Excel.
export function formToRegistryRow(form: CertificateFormData) {
  const A = form.serial_number;
  const num = parseInt(A);
  const B = !isNaN(num) && num > 0 ? (num < 10 ? `0${num}` : `${num}`) : '';
  const issueDate = formatDateDDMMYY(form.date_start_day, form.date_start_month, form.date_start_year);
  const expiryDate = formatDateDDMMYY(form.date_end_day, form.date_end_month, form.date_end_year);
  const H = [form.issued_to_org, form.issued_to_address].filter(Boolean).join(' ');

  return {
    A,
    B,
    C: form.cert_number,
    D: form.registry_col_d,
    E: form.copy_number,
    F: issueDate,
    G: expiryDate,
    H,
    I: '',
    J: '',
    K: '',
    L: form.cert_processing || '1',
    M: form.products.filter(Boolean).join(' '),
    N: form.quantity,
    N1: form.quantity_unit,
    O: form.basis_documents.filter(Boolean).join(' '),
    P: form.country,
    Q: form.total_cost,
    R: form.amount_due,
    S: form.tests,
    T: form.invoice_number,
    U: form.invoice_date,
    V: form.inn,
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
  N1: 'Ед. изм.',
  O: 'На основании документа',
  P: 'Страна',
  Q: 'Стоимость (сомони)',
  R: 'Сумма к оплате',
  S: 'Испытаний',
  T: '№ фактуры',
  U: 'Дата',
  V: 'ИНН',
};

export const ALL_COLUMNS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','N1','O','P','Q','R','S','T','U','V'] as const;
