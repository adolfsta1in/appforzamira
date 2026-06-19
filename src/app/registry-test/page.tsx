'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community';
import * as XLSX from 'xlsx';
import { formToRegistryRow, ALL_COLUMNS } from '@/lib/certificateTypes';
import { supabase } from '@/lib/supabase';

ModuleRegistry.registerModules([AllCommunityModule]);

interface CertRow {
  id: string;
  saved_at: string;
  cert_number: string;
  registry_col_d: string | null;
  date_start_day: string;
  date_start_month: string;
  date_start_year: string;
  date_end_day: string;
  date_end_month: string;
  date_end_year: string;
  cert_body_name: string;
  cert_body_address: string;
  cert_body_number: string;
  products: string;
  quantity: string;
  quantity_unit: string | null;
  code_num: string;
  code_nm: string;
  norm_documents: string;
  country: string;
  issued_to_org: string;
  issued_to_address: string;
  basis_document: string;
  additional_info: string;
  head_name: string;
  dept_head_name: string;
  serial_number: string;
  copy_number: string;
  cert_processing: string;
  total_cost: string;
  amount_due: string;
  tests: string;
  invoice_number: string;
  invoice_date: string;
  inn: string;
  pdf_storage_path: string | null;
}

type RegistryGridRow = {
  id: string;
  saved_at: string;
  cert_processing: string;
  processing_label: string;
  rowNumber: number;
  [key: string]: string | number;
};

type ProcessingFilter = 'all' | '1' | '2' | '3';

const FETCH_CHUNK_SIZE = 1000;
const MAX_ROW_OPTIONS = [5000, 10000, 25000, 50000];

const COLUMN_LABELS: Record<string, string> = {
  rowNumber: '#',
  A: 'A № п/п',
  B: 'B №',
  C: 'C № сертификата',
  D: 'D *',
  E: 'E № копии',
  F: 'F Дата выдачи',
  G: 'G Срок действия до',
  H: 'H Предприятие и адрес',
  I: 'I Экспорт',
  J: 'J Импорт',
  K: 'K Внутренний',
  L: 'L',
  M: 'M Продукция',
  N: 'N Кол-во',
  N1: 'N1 Ед. изм.',
  O: 'O Основание документа',
  P: 'P Страна',
  Q: 'Q Стоимость',
  R: 'R Сумма к оплате',
  S: 'S Испытаний',
  T: 'T № фактуры',
  U: 'U Дата',
  V: 'V ИНН',
  processing_label: 'Тип оформления',
  saved_at: 'Дата сохранения',
};

const PROCESSING_LABELS: Record<string, string> = {
  '1': 'Экспорт',
  '2': 'Импорт',
  '3': 'Внутренний',
};

const gridTheme = themeQuartz.withParams({
  accentColor: '#2E7D32',
  borderColor: '#D4DDE7',
  browserColorScheme: 'light',
  columnBorder: true,
  fontFamily: 'Arial, sans-serif',
  fontSize: 13,
  headerBackgroundColor: '#F3F7F4',
  headerFontWeight: 700,
  oddRowBackgroundColor: '#FAFBFC',
  rowBorder: true,
  rowHeight: 34,
  wrapperBorderRadius: 0,
});

function certToGridRow(cert: CertRow, index: number): RegistryGridRow {
  const registryRow = formToRegistryRow({
    cert_number: cert.cert_number,
    cert_number_on_blank: '',
    registry_col_d: cert.registry_col_d || '',
    date_start_day: cert.date_start_day,
    date_start_month: cert.date_start_month,
    date_start_year: cert.date_start_year,
    date_end_day: cert.date_end_day,
    date_end_month: cert.date_end_month,
    date_end_year: cert.date_end_year,
    cert_body_name: cert.cert_body_name,
    cert_body_address: cert.cert_body_address,
    cert_body_number: cert.cert_body_number,
    products: [cert.products],
    quantity: cert.quantity,
    quantity_unit: cert.quantity_unit || '',
    code_num: cert.code_num,
    code_nm: cert.code_nm,
    norm_documents: [cert.norm_documents],
    norm_documents_1: cert.norm_documents,
    norm_documents_2: '',
    country: cert.country,
    issued_to_org: cert.issued_to_org,
    issued_to_address: cert.issued_to_address,
    basis_documents: [cert.basis_document],
    additional_info: [cert.additional_info],
    head_name: cert.head_name,
    dept_head_name: cert.dept_head_name,
    text_color_overrides: {},
    serial_number: cert.serial_number,
    copy_number: cert.copy_number,
    cert_processing: cert.cert_processing,
    total_cost: cert.total_cost,
    amount_due: cert.amount_due,
    tests: cert.tests,
    invoice_number: cert.invoice_number,
    invoice_date: cert.invoice_date,
    inn: cert.inn,
  });

  return {
    ...registryRow,
    id: cert.id,
    saved_at: cert.saved_at || '',
    cert_processing: cert.cert_processing || '',
    processing_label: PROCESSING_LABELS[cert.cert_processing] || '',
    rowNumber: index + 1,
  };
}

function normalize(value: string | number | undefined | null) {
  return String(value ?? '').toLowerCase().trim();
}

function parseDisplayDate(value: string | number | undefined): number | null {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearRaw = Number(match[3]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (!day || !month || !year) return null;
  return year * 10000 + month * 100 + day;
}

function parseInputDate(value: string) {
  if (!value) return null;
  return Number(value.replace(/-/g, ''));
}

function isDateInRange(value: string | number | undefined, from: string, to: string) {
  const dateValue = parseDisplayDate(value);
  const fromValue = parseInputDate(from);
  const toValue = parseInputDate(to);
  if (!fromValue && !toValue) return true;
  if (!dateValue) return false;
  if (fromValue && dateValue < fromValue) return false;
  if (toValue && dateValue > toValue) return false;
  return true;
}

export default function RegistryTestPage() {
  const [rows, setRows] = useState<RegistryGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [maxRows, setMaxRows] = useState(10000);
  const [gridApi, setGridApi] = useState<GridApi<RegistryGridRow> | null>(null);

  const [quickSearch, setQuickSearch] = useState('');
  const [certSearch, setCertSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [processingFilter, setProcessingFilter] = useState<ProcessingFilter>('all');
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [expiryDateFrom, setExpiryDateFrom] = useState('');
  const [expiryDateTo, setExpiryDateTo] = useState('');

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { rowNumber: true, processing_label: true, saved_at: false };
    ALL_COLUMNS.forEach(col => { initial[col] = true; });
    return initial;
  });

  const columnDefs = useMemo<ColDef<RegistryGridRow>[]>(() => {
    const common: ColDef<RegistryGridRow> = {
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      resizable: true,
      sortable: true,
      minWidth: 80,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      tooltipField: undefined,
    };

    const widths: Record<string, number> = {
      rowNumber: 70,
      A: 90,
      B: 80,
      C: 135,
      F: 120,
      G: 140,
      H: 280,
      I: 95,
      J: 95,
      K: 115,
      M: 280,
      O: 300,
      processing_label: 135,
      saved_at: 170,
    };

    const cols: ColDef<RegistryGridRow>[] = [
      {
        ...common,
        field: 'rowNumber',
        headerName: COLUMN_LABELS.rowNumber,
        width: widths.rowNumber,
        pinned: 'left',
        filter: false,
        valueGetter: params => params.node?.rowIndex != null ? params.node.rowIndex + 1 : params.data?.rowNumber,
      },
      ...ALL_COLUMNS.map((field): ColDef<RegistryGridRow> => ({
        ...common,
        field,
        colId: field,
        headerName: COLUMN_LABELS[field],
        width: widths[field] || 150,
        pinned: ['A', 'B', 'C'].includes(field) ? 'left' : undefined,
        hide: visibleColumns[field] === false,
        tooltipValueGetter: params => String(params.value || ''),
        cellClass: ['H', 'M', 'O'].includes(field) ? 'ag-cell-long-text' : undefined,
      })),
      {
        ...common,
        field: 'processing_label',
        headerName: COLUMN_LABELS.processing_label,
        width: widths.processing_label,
        hide: visibleColumns.processing_label === false,
      },
      {
        ...common,
        field: 'saved_at',
        headerName: COLUMN_LABELS.saved_at,
        width: widths.saved_at,
        hide: visibleColumns.saved_at === false,
      },
    ];

    return cols;
  }, [visibleColumns]);

  const defaultColDef = useMemo<ColDef<RegistryGridRow>>(() => ({
    editable: false,
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    resizable: true,
    sortable: true,
    suppressHeaderMenuButton: false,
  }), []);

  const filteredRows = useMemo(() => {
    const certNeedle = normalize(certSearch);
    const companyNeedle = normalize(companySearch);
    const productNeedle = normalize(productSearch);

    return rows.filter(row => {
      if (processingFilter !== 'all' && row.cert_processing !== processingFilter) return false;
      if (certNeedle && !normalize(row.C).includes(certNeedle)) return false;
      if (companyNeedle && !normalize(row.H).includes(companyNeedle)) return false;
      if (productNeedle && !normalize(row.M).includes(productNeedle)) return false;
      if (!isDateInRange(row.F, issueDateFrom, issueDateTo)) return false;
      if (!isDateInRange(row.G, expiryDateFrom, expiryDateTo)) return false;
      return true;
    });
  }, [
    certSearch,
    companySearch,
    expiryDateFrom,
    expiryDateTo,
    issueDateFrom,
    issueDateTo,
    processingFilter,
    productSearch,
    rows,
  ]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadedCount(0);

    const { count, error: countError } = await supabase
      .from('certificates')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      setError('Ошибка загрузки количества строк: ' + countError.message);
      setLoading(false);
      return;
    }

    const total = count || 0;
    const limit = Math.min(total, maxRows);
    const nextRows: RegistryGridRow[] = [];
    setTotalCount(total);

    for (let from = 0; from < limit; from += FETCH_CHUNK_SIZE) {
      const to = Math.min(from + FETCH_CHUNK_SIZE - 1, limit - 1);
      const { data, error: fetchError } = await supabase
        .from('certificates')
        .select('*')
        .order('saved_at', { ascending: false })
        .range(from, to);

      if (fetchError) {
        setError('Ошибка загрузки строк: ' + fetchError.message);
        setLoading(false);
        return;
      }

      const chunk = ((data || []) as CertRow[]).map((cert, index) => certToGridRow(cert, from + index));
      nextRows.push(...chunk);
      setRows([...nextRows]);
      setLoadedCount(nextRows.length);
      if (!data || data.length < to - from + 1) break;
    }

    setRows(nextRows);
    setLoading(false);
  }, [maxRows]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const onGridReady = useCallback((event: GridReadyEvent<RegistryGridRow>) => {
    setGridApi(event.api);
  }, []);

  const toggleColumn = (field: string, visible: boolean) => {
    setVisibleColumns(prev => ({ ...prev, [field]: visible }));
    gridApi?.setColumnsVisible([field], visible);
  };

  const resetFilters = () => {
    setQuickSearch('');
    setCertSearch('');
    setCompanySearch('');
    setProductSearch('');
    setProcessingFilter('all');
    setIssueDateFrom('');
    setIssueDateTo('');
    setExpiryDateFrom('');
    setExpiryDateTo('');
    gridApi?.setFilterModel(null);
  };

  const collectCurrentRows = () => {
    const api = gridApi;
    if (!api) return [];
    const exportedRows: RegistryGridRow[] = [];
    api.forEachNodeAfterFilterAndSort(node => {
      if (node.data) exportedRows.push(node.data);
    });
    return exportedRows;
  };

  const getDisplayedColumnIds = () => {
    const ids = gridApi?.getAllDisplayedColumns().map(column => column.getColId()) || ['rowNumber', ...ALL_COLUMNS];
    return ids.filter(id => id !== 'id' && id !== 'cert_processing');
  };

  const exportCsv = () => {
    gridApi?.exportDataAsCsv({
      fileName: `registry-test-${new Date().toISOString().slice(0, 10)}.csv`,
      columnKeys: getDisplayedColumnIds(),
    });
  };

  const exportExcel = () => {
    const ids = getDisplayedColumnIds();
    const headers = ids.map(id => COLUMN_LABELS[id] || id);
    const data = collectCurrentRows().map(row => ids.map(id => row[id] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = ids.map(id => ({ wch: ['H', 'M', 'O'].includes(id) ? 38 : 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Тестовый реестр');
    XLSX.writeFile(wb, `registry-test-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-[1900px] px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Тестовая таблица реестра</h2>
            <p className="text-xs text-gray-500">
              AG Grid, данные из текущего реестра. Загружено {loadedCount} из {Math.min(totalCount, maxRows)} строк
              {totalCount > maxRows ? `, всего в базе ${totalCount}` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/registry"
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Старый реестр
            </Link>
            <button
              type="button"
              onClick={fetchRows}
              disabled={loading}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Обновить
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={exportExcel}
              className="rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              Excel
            </button>
          </div>
        </div>

        <section className="mb-3 grid gap-3 border border-gray-200 bg-white p-3 shadow-sm xl:grid-cols-[1.4fr_1fr_auto]">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={quickSearch}
              onChange={event => setQuickSearch(event.target.value)}
              placeholder="Общий поиск"
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <input
              value={certSearch}
              onChange={event => setCertSearch(event.target.value)}
              placeholder="№ сертификата"
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <input
              value={companySearch}
              onChange={event => setCompanySearch(event.target.value)}
              placeholder="Фирма или адрес"
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <input
              value={productSearch}
              onChange={event => setProductSearch(event.target.value)}
              placeholder="Продукция"
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <select
              value={processingFilter}
              onChange={event => setProcessingFilter(event.target.value as ProcessingFilter)}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            >
              <option value="all">Все типы</option>
              <option value="1">Экспорт</option>
              <option value="2">Импорт</option>
              <option value="3">Внутренний</option>
            </select>
            <select
              value={maxRows}
              onChange={event => setMaxRows(Number(event.target.value))}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            >
              {MAX_ROW_OPTIONS.map(value => (
                <option key={value} value={value}>Загрузить до {value}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Сбросить фильтры
            </button>
          </div>

          <div className="grid gap-2 text-xs md:grid-cols-2 xl:min-w-[480px]">
            <label className="flex items-center gap-2">
              <span className="w-24 text-gray-500">Выдача от</span>
              <input type="date" value={issueDateFrom} onChange={e => setIssueDateFrom(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 text-gray-500">Выдача до</span>
              <input type="date" value={issueDateTo} onChange={e => setIssueDateTo(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 text-gray-500">Срок от</span>
              <input type="date" value={expiryDateFrom} onChange={e => setExpiryDateFrom(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 text-gray-500">Срок до</span>
              <input type="date" value={expiryDateTo} onChange={e => setExpiryDateTo(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
          </div>
        </section>

        <details className="mb-3 border border-gray-200 bg-white p-3 text-sm shadow-sm">
          <summary className="cursor-pointer font-semibold text-gray-800">Показать / скрыть колонки</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {['rowNumber', ...ALL_COLUMNS, 'processing_label', 'saved_at'].map(field => (
              <label key={field} className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={visibleColumns[field] !== false}
                  onChange={event => toggleColumn(field, event.target.checked)}
                />
                <span className="truncate">{COLUMN_LABELS[field] || field}</span>
              </label>
            ))}
          </div>
        </details>

        {error && (
          <div className="mb-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="border border-gray-300 bg-white shadow-sm">
          <div className="h-[72vh] min-h-[620px] w-full">
            <AgGridReact<RegistryGridRow>
              theme={gridTheme}
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              quickFilterText={quickSearch}
              pagination
              paginationPageSize={100}
              paginationPageSizeSelector={[100, 250, 500, 1000]}
              rowBuffer={30}
              suppressCellFocus
              animateRows={false}
              loading={loading}
              tooltipShowDelay={250}
            />
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          В таблице сейчас {filteredRows.length} строк после верхних фильтров. Встроенные фильтры AG Grid применяются через меню и поля под заголовками колонок.
        </div>
      </main>
    </div>
  );
}
