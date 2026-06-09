'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formToRegistryRow, ALL_COLUMNS, COLUMN_LABELS, TAJIK_MONTHS } from '@/lib/certificateTypes';
import { supabase } from '@/lib/supabase';
import { applyAutoReplace, initAutoReplacements } from '@/lib/autoReplace';
import * as XLSX from 'xlsx';

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

type SortDirection = 'asc' | 'desc';
type SortConfig = {
  column: string;
  field: keyof CertRow;
  direction: SortDirection;
};

type ExportScope = 'current' | 'filtered' | 'latest';
type ExportOrder = 'screen' | 'newest' | 'oldest';

const SORTABLE_COLUMNS: Partial<Record<string, keyof CertRow>> = {
  A: 'serial_number',
  C: 'cert_number',
  D: 'registry_col_d',
  E: 'copy_number',
  F: 'date_start_year',
  G: 'date_end_year',
  H: 'issued_to_org',
  I: 'cert_processing',
  J: 'cert_processing',
  K: 'cert_processing',
  M: 'products',
  N: 'quantity',
  N1: 'quantity_unit',
  O: 'basis_document',
  P: 'country',
  Q: 'total_cost',
  R: 'amount_due',
  S: 'tests',
  T: 'invoice_number',
  U: 'invoice_date',
  V: 'inn',
};

function certToRegistryRow(cert: CertRow) {
  return formToRegistryRow({
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
}

export default function RegistryPage() {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [certNumberSearch, setCertNumberSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'saved_at',
    field: 'saved_at',
    direction: 'desc',
  });
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('current');
  const [exportOrder, setExportOrder] = useState<ExportOrder>('screen');
  const [exportLimit, setExportLimit] = useState('100');
  const [exporting, setExporting] = useState(false);
  const pageSize = 100;
  
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CertRow>>({});
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();

  const loadCerts = useCallback(async (
    page: number,
    certSearchTerm: string,
    companySearchTerm: string,
    sort: SortConfig,
  ) => {
    setLoading(true);
    setError(null);
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const normalizedCertSearch = certSearchTerm.trim();
    const normalizedCompanySearch = companySearchTerm.trim();

    let query = supabase
      .from('certificates')
      .select('*', { count: 'exact' })
      .order(sort.field, { ascending: sort.direction === 'asc' });

    if (normalizedCertSearch) {
      query = query.ilike('cert_number', `%${normalizedCertSearch}%`);
    }

    if (normalizedCompanySearch) {
      const safeCompanySearch = normalizedCompanySearch.replace(/[%,()]/g, ' ');
      query = query.or(`issued_to_org.ilike.%${safeCompanySearch}%,issued_to_address.ilike.%${safeCompanySearch}%`);
    }

    const { data, error: fetchError, count } = await query
      .range(from, to);

    if (fetchError) {
      setError('Ошибка загрузки: ' + fetchError.message);
    } else {
      setCerts(data || []);
      if (count !== null) setTotalCount(count);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initAutoReplacements();
    loadCerts(currentPage, certNumberSearch, companySearch, sortConfig);
  }, [loadCerts, currentPage, certNumberSearch, companySearch, sortConfig]);

  const handleCertNumberSearchChange = useCallback((value: string) => {
    setCertNumberSearch(value);
    setCurrentPage(1);
  }, []);

  const handleCompanySearchChange = useCallback((value: string) => {
    setCompanySearch(value);
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((column: string) => {
    const field = SORTABLE_COLUMNS[column];
    if (!field) return;
    setSortConfig(prev => ({
      column,
      field,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  }, []);

  const fetchExportRows = useCallback(async () => {
    if (exportScope === 'current') {
      const rows = [...certs];
      if (exportOrder === 'newest' || exportOrder === 'oldest') {
        rows.sort((a, b) => {
          const left = a.saved_at || '';
          const right = b.saved_at || '';
          return exportOrder === 'newest'
            ? right.localeCompare(left)
            : left.localeCompare(right);
        });
      }
      return rows;
    }

    const normalizedCertSearch = certNumberSearch.trim();
    const normalizedCompanySearch = companySearch.trim();
    const limit = exportScope === 'latest'
      ? Math.max(1, Math.min(5000, parseInt(exportLimit, 10) || 100))
      : totalCount;
    const chunkSize = 1000;
    const rows: CertRow[] = [];
    const sort = exportOrder === 'screen'
      ? sortConfig
      : {
          column: 'saved_at',
          field: 'saved_at' as keyof CertRow,
          direction: exportOrder === 'newest' ? 'desc' as const : 'asc' as const,
        };

    for (let from = 0; from < limit; from += chunkSize) {
      const to = Math.min(from + chunkSize - 1, limit - 1);
      let query = supabase
        .from('certificates')
        .select('*')
        .order(sort.field, { ascending: sort.direction === 'asc' });

      if (normalizedCertSearch) {
        query = query.ilike('cert_number', `%${normalizedCertSearch}%`);
      }

      if (normalizedCompanySearch) {
        const safeCompanySearch = normalizedCompanySearch.replace(/[%,()]/g, ' ');
        query = query.or(`issued_to_org.ilike.%${safeCompanySearch}%,issued_to_address.ilike.%${safeCompanySearch}%`);
      }

      const { data, error: fetchError } = await query.range(from, to);
      if (fetchError) throw fetchError;

      rows.push(...((data || []) as CertRow[]));
      if (!data || data.length < chunkSize) break;
    }

    return rows;
  }, [certNumberSearch, certs, companySearch, exportLimit, exportOrder, exportScope, sortConfig, totalCount]);

  const downloadRegistryExcel = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const rows = await fetchExportRows();
      if (rows.length === 0) {
        setError('Нет строк для выгрузки');
        return;
      }

      const headers = ALL_COLUMNS.map(col => COLUMN_LABELS[col]);
      const values = rows.map(cert => {
        const row = certToRegistryRow(cert);
        return ALL_COLUMNS.map(col => row[col as keyof typeof row] || '');
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...values]);

      ws['!cols'] = ALL_COLUMNS.map(col => {
        if (['I', 'J', 'K', 'D'].includes(col)) return { wch: 5 };
        if (['A', 'B', 'L', 'N', 'N1'].includes(col)) return { wch: 8 };
        if (['H', 'M', 'O'].includes(col)) return { wch: 38 };
        return { wch: 16 };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `реестр_сертификатов_${date}.xlsx`);
      setShowExportPanel(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError('Ошибка выгрузки Excel: ' + message);
    } finally {
      setExporting(false);
    }
  }, [fetchExportRows]);

  const deleteCert = useCallback(async (id: string, pdfPath: string | null) => {
    const { error: deleteError } = await supabase
      .from('certificates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert('Ошибка удаления: ' + deleteError.message);
      return;
    }

    // Удаляем PDF из хранилища если есть
    if (pdfPath) {
      await supabase.storage.from('pdf-files').remove([pdfPath]);
    }

    setCerts(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    if (!confirm('Удалить все сертификаты из реестра?')) return;

    const pdfPaths = certs
      .map(c => c.pdf_storage_path)
      .filter((p): p is string => !!p);

    const { error: deleteError } = await supabase
      .from('certificates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // удалить всё

    if (deleteError) {
      alert('Ошибка при очистке: ' + deleteError.message);
      return;
    }

    if (pdfPaths.length > 0) {
      await supabase.storage.from('pdf-files').remove(pdfPaths);
    }

    setCerts([]);
  }, [certs]);

  const openPdf = useCallback((pdfPath: string) => {
    const { data } = supabase.storage.from('pdf-files').getPublicUrl(pdfPath);
    window.open(data.publicUrl, '_blank');
  }, []);

  const editCert = useCallback((cert: CertRow) => {
    const formData = {
      id: cert.id,
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
    };
    
    // Save to draft and redirect
    localStorage.setItem('cert_form_draft', JSON.stringify({ version: '1', data: formData }));
    router.push('/');
  }, [router]);

  const startInlineEdit = useCallback((cert: CertRow) => {
    setEditingRowId(cert.id);
    setEditFormData({ ...cert });
  }, []);

  const cancelInlineEdit = useCallback(() => {
    setEditingRowId(null);
    setEditFormData({});
  }, []);

  const handleEditChange = useCallback((field: keyof CertRow, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: applyAutoReplace(value) }));
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!editingRowId) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('certificates')
      .update(editFormData)
      .eq('id', editingRowId);

    if (error) {
      alert(`Ошибка при сохранении: ${error.message}`);
      setLoading(false);
      return;
    }

    await loadCerts(currentPage, certNumberSearch, companySearch, sortConfig);
    setEditingRowId(null);
    setEditFormData({});
  }, [editingRowId, editFormData, loadCerts, currentPage, certNumberSearch, companySearch, sortConfig]);

  const syncHorizontalScroll = useCallback((source: 'top' | 'table') => {
    const from = source === 'top' ? topScrollRef.current : tableScrollRef.current;
    const to = source === 'top' ? tableScrollRef.current : topScrollRef.current;
    if (!from || !to || to.scrollLeft === from.scrollLeft) return;
    to.scrollLeft = from.scrollLeft;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[1800px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Реестр сертификатов (всего: {totalCount})
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 rounded bg-white border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Пред.
              </button>
              <span className="text-sm font-medium text-gray-600">
                Стр. {currentPage} из {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                className="px-3 py-1.5 rounded bg-white border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                След.
              </button>
            </div>
            <button
              onClick={() => loadCerts(currentPage, certNumberSearch, companySearch, sortConfig)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              Обновить
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportPanel(v => !v)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Excel
              </button>
              {showExportPanel && (
                <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-xl">
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      Что скачать
                    </label>
                    <select
                      value={exportScope}
                      onChange={e => {
                        const nextScope = e.target.value as ExportScope;
                        setExportScope(nextScope);
                        if (nextScope === 'latest') setExportOrder('newest');
                      }}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                    >
                      <option value="current">Текущую страницу ({certs.length})</option>
                      <option value="filtered">Все найденные ({totalCount})</option>
                      <option value="latest">Последние N записей</option>
                    </select>
                  </div>

                  {exportScope === 'latest' && (
                    <div className="mb-3">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        Количество строк
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="5000"
                        value={exportLimit}
                        onChange={e => setExportLimit(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      />
                      <p className="mt-1 text-[11px] text-gray-400">Максимум 5000 строк за один файл</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      Порядок
                    </label>
                    <select
                      value={exportOrder}
                      onChange={e => setExportOrder(e.target.value as ExportOrder)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                    >
                      <option value="screen">Как на экране</option>
                      <option value="newest">Сначала новые</option>
                      <option value="oldest">Сначала старые</option>
                    </select>
                  </div>

                  <button
                    onClick={downloadRegistryExcel}
                    disabled={exporting || (exportScope === 'current' && certs.length === 0) || (exportScope !== 'current' && totalCount === 0)}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exporting ? 'Готовлю файл...' : 'Скачать .xlsx'}
                  </button>
                </div>
              )}
            </div>
            {certs.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Очистить реестр
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="cert-number-search" className="text-sm font-medium text-gray-700">
            Поиск по № сертификата
          </label>
          <input
            id="cert-number-search"
            type="search"
            value={certNumberSearch}
            onChange={e => handleCertNumberSearchChange(e.target.value)}
            placeholder="Введите номер"
            className="w-80 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <label htmlFor="company-search" className="text-sm font-medium text-gray-700">
            Поиск по фирме
          </label>
          <input
            id="company-search"
            type="search"
            value={companySearch}
            onChange={e => handleCompanySearchChange(e.target.value)}
            placeholder="Название или адрес"
            className="w-80 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {(certNumberSearch || companySearch) && (
            <button
              onClick={() => {
                handleCertNumberSearchChange('');
                handleCompanySearchChange('');
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Сбросить
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="inline-block w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p>Загрузка...</p>
          </div>
        ) : certs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Реестр пуст</p>
            <p className="text-sm mt-2">Сохраните сертификаты через главную страницу</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div
              ref={topScrollRef}
              onScroll={() => syncHorizontalScroll('top')}
              className="overflow-x-auto border-b border-gray-200"
            >
              <div className="h-3 min-w-[3600px]" />
            </div>
            <div
              ref={tableScrollRef}
              onScroll={() => syncHorizontalScroll('table')}
              className="overflow-x-auto"
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-[#2E7D32] text-white px-2 py-2 border border-green-800 text-xs font-medium">
                      #
                    </th>
                    {ALL_COLUMNS.map(col => (
                      <th
                        key={col}
                        className="bg-[#2E7D32] text-white px-2 py-2 border border-green-800 text-center whitespace-nowrap text-xs font-medium"
                      >
                        {SORTABLE_COLUMNS[col] ? (
                          <button
                            type="button"
                            onClick={() => handleSort(col)}
                            className="w-full text-white hover:text-green-100"
                            title="Сортировка"
                          >
                            <div>
                              {col}
                              {sortConfig.column === col && (
                                <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                            <div className="font-normal text-green-100 text-[10px]">
                              {COLUMN_LABELS[col]}
                            </div>
                          </button>
                        ) : (
                          <>
                            <div>{col}</div>
                            <div className="font-normal text-green-100 text-[10px]">
                              {COLUMN_LABELS[col]}
                            </div>
                          </>
                        )}
                      </th>
                    ))}
                    <th className="bg-[#2E7D32] text-white px-2 py-2 border border-green-800 text-xs font-medium">
                      PDF
                    </th>
                    <th className="bg-[#2E7D32] text-white px-2 py-2 border border-green-800 text-xs font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((cert, idx) => {
                    const isEditing = cert.id === editingRowId;
                    const row = formToRegistryRow({
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
                    
                    return (
                      <tr key={cert.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 border border-gray-300 text-center text-xs">
                          {idx + 1}
                        </td>
                        {ALL_COLUMNS.map(col => {
                          if (isEditing) {
                            if (col === 'A') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-20 text-xs p-1 border rounded" value={editFormData.serial_number || ''} onChange={e => handleEditChange('serial_number', e.target.value)} /></td>;
                            if (col === 'C') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-24 text-xs p-1 border rounded" value={editFormData.cert_number || ''} onChange={e => handleEditChange('cert_number', e.target.value)} /></td>;
                            if (col === 'D') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-16 text-xs p-1 border rounded" value={editFormData.registry_col_d || ''} onChange={e => handleEditChange('registry_col_d', e.target.value)} /></td>;
                            if (col === 'E') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-16 text-xs p-1 border rounded" value={editFormData.copy_number || ''} onChange={e => handleEditChange('copy_number', e.target.value)} /></td>;
                            
                            if (col === 'F') return (
                              <td key={col} className="px-1 py-1 border border-gray-300 text-xs">
                                <div className="flex gap-1">
                                  <input className="w-8 p-1 border rounded text-center" value={editFormData.date_start_day || ''} onChange={e => handleEditChange('date_start_day', e.target.value)} placeholder="DD" />
                                  <select className="w-[80px] p-1 border rounded" value={editFormData.date_start_month || ''} onChange={e => handleEditChange('date_start_month', e.target.value)}>
                                     <option value="">Месяц</option>
                                     {TAJIK_MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                  </select>
                                  <input className="w-12 p-1 border rounded text-center" value={editFormData.date_start_year || ''} onChange={e => handleEditChange('date_start_year', e.target.value)} placeholder="YYYY" />
                                </div>
                              </td>
                            );
                            if (col === 'G') return (
                              <td key={col} className="px-1 py-1 border border-gray-300 text-xs">
                                <div className="flex gap-1">
                                  <input className="w-8 p-1 border rounded text-center" value={editFormData.date_end_day || ''} onChange={e => handleEditChange('date_end_day', e.target.value)} placeholder="DD" />
                                  <select className="w-[80px] p-1 border rounded" value={editFormData.date_end_month || ''} onChange={e => handleEditChange('date_end_month', e.target.value)}>
                                     <option value="">Месяц</option>
                                     {TAJIK_MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                  </select>
                                  <input className="w-12 p-1 border rounded text-center" value={editFormData.date_end_year || ''} onChange={e => handleEditChange('date_end_year', e.target.value)} placeholder="YYYY" />
                                </div>
                              </td>
                            );

                            if (col === 'H') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.issued_to_org || ''} onChange={e => { handleEditChange('issued_to_org', e.target.value); handleEditChange('issued_to_address', ''); }} /></td>;
                            if (col === 'I') return (
                              <td key={col} className="px-1 py-1 border border-gray-300">
                                <select className="w-28 text-xs p-1 border rounded" value={editFormData.cert_processing || '1'} onChange={e => handleEditChange('cert_processing', e.target.value)}>
                                  <option value="1">Экспорт</option>
                                  <option value="2">Импорт</option>
                                  <option value="3">Внутренний</option>
                                </select>
                              </td>
                            );
                            if (col === 'M') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.products || ''} onChange={e => handleEditChange('products', e.target.value)} /></td>;
                            if (col === 'N') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-16 text-xs p-1 border rounded" value={editFormData.quantity || ''} onChange={e => handleEditChange('quantity', e.target.value)} /></td>;
                            if (col === 'N1') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-16 text-xs p-1 border rounded" value={editFormData.quantity_unit || ''} onChange={e => handleEditChange('quantity_unit', e.target.value)} /></td>;
                            if (col === 'O') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.basis_document || ''} onChange={e => handleEditChange('basis_document', e.target.value)} /></td>;
                            if (col === 'P') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-20 text-xs p-1 border rounded" value={editFormData.country || ''} onChange={e => handleEditChange('country', e.target.value)} /></td>;
                            if (col === 'Q') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-20 text-xs p-1 border rounded" value={editFormData.total_cost || ''} onChange={e => handleEditChange('total_cost', e.target.value)} /></td>;
                            if (col === 'R') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-20 text-xs p-1 border rounded" value={editFormData.amount_due || ''} onChange={e => handleEditChange('amount_due', e.target.value)} /></td>;
                            if (col === 'S') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.tests || ''} onChange={e => handleEditChange('tests', e.target.value)} /></td>;
                            if (col === 'T') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-24 text-xs p-1 border rounded" value={editFormData.invoice_number || ''} onChange={e => handleEditChange('invoice_number', e.target.value)} /></td>;
                            if (col === 'U') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-24 text-xs p-1 border rounded" value={editFormData.invoice_date || ''} onChange={e => handleEditChange('invoice_date', e.target.value)} /></td>;
                            if (col === 'V') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.inn || ''} onChange={e => handleEditChange('inn', e.target.value)} /></td>;
                            
                            // Default for uneditable columns (B, I, J, K)
                            return (
                              <td
                                key={col}
                                className="px-2 py-2 border border-gray-300 text-center text-xs bg-gray-100"
                              >
                                {row[col as keyof typeof row] || '\u00A0'}
                              </td>
                            );
                          } else {
                            return (
                              <td
                                key={col}
                                className="px-2 py-2 border border-gray-300 text-center text-xs max-w-[150px] truncate"
                                title={row[col as keyof typeof row] || ''}
                              >
                                {row[col as keyof typeof row] || '\u00A0'}
                              </td>
                            );
                          }
                        })}
                        <td className="px-2 py-2 border border-gray-300 text-center">
                          {cert.pdf_storage_path ? (
                            <button
                              onClick={() => openPdf(cert.pdf_storage_path!)}
                              className="text-blue-500 hover:text-blue-700 text-xs"
                            >
                              Открыть
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        {isEditing ? (
                          <td className="px-2 py-2 border border-gray-300 text-center space-x-2 whitespace-nowrap">
                            <button
                              onClick={saveInlineEdit}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="text-gray-500 hover:text-gray-700 text-xs"
                            >
                              Отмена
                            </button>
                          </td>
                        ) : (
                          <td className="px-2 py-2 border border-gray-300 text-center space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => editCert(cert)}
                              className="text-green-600 hover:text-green-800 text-xs"
                              title="Редактировать на бланке"
                            >
                              В бланк
                            </button>
                            <button
                              onClick={() => startInlineEdit(cert)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              title="Редактировать в строке"
                            >
                              В строке
                            </button>
                            <button
                              onClick={() => deleteCert(cert.id, cert.pdf_storage_path)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Удалить
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
