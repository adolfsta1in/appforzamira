'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CertificateFormData,
  EMPTY_FORM_DATA,
  formToRegistryRow,
  ALL_COLUMNS,
  COLUMN_LABELS,
} from '@/lib/certificateTypes';
import CertificateEditor from './components/CertificateEditor';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// ─── Templates ───────────────────────────────────────────────────────────────
interface CertTemplate {
  id: string;
  name: string;
  data: Partial<CertificateFormData>;
  created_at: string;
}

// Fields unique per certificate — cleared when loading a template
const UNIQUE_FIELDS: (keyof CertificateFormData)[] = [
  'cert_number',
  'cert_number_on_blank',
  'date_start_day', 'date_start_month', 'date_start_year',
  'date_end_day', 'date_end_month', 'date_end_year',
  'serial_number', 'copy_number',
  'invoice_number', 'invoice_date',
];

// localStorage key + version for form draft autosave
const FORM_DRAFT_KEY = 'cert_form_draft';
const FORM_DRAFT_VERSION = '1';

function loadDraft(): CertificateFormData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FORM_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== FORM_DRAFT_VERSION) return null;
    const data = parsed.data;
    if (!data || typeof data !== 'object') return null;
    // Merge with EMPTY_FORM_DATA so new fields get defaults
    return {
      ...EMPTY_FORM_DATA,
      ...data,
      products: Array.isArray(data.products) && data.products.length > 0
        ? data.products
        : EMPTY_FORM_DATA.products,
      basis_documents: Array.isArray(data.basis_documents) && data.basis_documents.length > 0
        ? data.basis_documents
        : EMPTY_FORM_DATA.basis_documents,
      additional_info: Array.isArray(data.additional_info)
        ? (data.additional_info.length > 0 ? data.additional_info : [''])
        : [typeof data.additional_info === 'string' ? data.additional_info : ''],
    };
  } catch {
    return null;
  }
}

function saveDraft(data: CertificateFormData) {
  try {
    localStorage.setItem(
      FORM_DRAFT_KEY,
      JSON.stringify({ version: FORM_DRAFT_VERSION, data }),
    );
  } catch {}
}

export default function Home() {
  const [formData, setFormData] = useState<CertificateFormData>(EMPTY_FORM_DATA);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [autoQuantityLoading, setAutoQuantityLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPdfFileRef = useRef<File | null>(null);
  const userEditedQuantityRef = useRef(false);

  // Templates
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

  // Load draft from localStorage on mount (client-only to avoid SSR hydration issues)
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setFormData(draft);
    setDraftLoaded(true);
  }, []);

  // Autosave form draft on any change (debounced)
  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => saveDraft(formData), 300);
    return () => clearTimeout(t);
  }, [formData, draftLoaded]);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data || []) as CertTemplate[]);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const updateField = useCallback((key: keyof CertificateFormData, value: string) => {
    if (key === 'quantity' || key === 'quantity_unit') {
      userEditedQuantityRef.current = true;
    }
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateArrayField = useCallback(
    (key: 'products' | 'basis_documents' | 'additional_info', index: number, value: string) => {
      setFormData(prev => {
        const arr = [...prev[key]];
        arr[index] = value;
        return { ...prev, [key]: arr };
      });
    },
    [],
  );

  const addArrayRow = useCallback((key: 'products' | 'basis_documents' | 'additional_info') => {
    setFormData(prev => ({ ...prev, [key]: [...prev[key], ''] }));
    // Adding a product row means new data coming — let auto-quantity recompute
    if (key === 'products') userEditedQuantityRef.current = false;
  }, []);

  const removeArrayRow = useCallback(
    (key: 'products' | 'basis_documents' | 'additional_info', index: number) => {
      setFormData(prev => {
        if (prev[key].length <= 1) return prev;
        return { ...prev, [key]: prev[key].filter((_, i) => i !== index) };
      });
    },
    [],
  );

  // Auto-compute quantity from products via DeepSeek (debounced)
  useEffect(() => {
    if (!draftLoaded) return;
    if (userEditedQuantityRef.current) return;
    const joined = formData.products.filter(Boolean).join(' | ').trim();
    if (!joined) return;

    const t = setTimeout(async () => {
      setAutoQuantityLoading(true);
      try {
        const res = await fetch('/api/parse-quantity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: formData.products.filter(Boolean) }),
        });
        if (res.ok) {
          const json = await res.json();
          if ((json.quantity || json.unit) && !userEditedQuantityRef.current) {
            setFormData(prev => ({
              ...prev,
              quantity: json.quantity || prev.quantity,
              quantity_unit: json.unit || prev.quantity_unit,
            }));
          }
        }
      } catch {}
      setAutoQuantityLoading(false);
    }, 1500);

    return () => clearTimeout(t);
  }, [formData.products, draftLoaded]);

  // PDF upload handler
  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Пожалуйста, загрузите PDF файл');
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    currentPdfFileRef.current = file;

    const fd = new FormData();
    fd.append('pdf', file);

    try {
      const res = await fetch('/api/parse', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Ошибка при обработке PDF');
      } else {
        // PDF parsed quantity — treat as auto-filled, allow auto effect to overwrite later
        userEditedQuantityRef.current = false;
        setFormData(prev => ({ ...prev, ...json.data }));
      }
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Copy TAB-separated row for Excel
  const copyRow = useCallback(async () => {
    const row = formToRegistryRow(formData);
    const values = ALL_COLUMNS.map(col => row[col as keyof typeof row] || '');
    const text = values.join('\t');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [formData]);

  // Save to Supabase registry
  const saveToRegistry = useCallback(async () => {
    setSaved(false);
    setError(null);

    try {
      let pdfStoragePath: string | null = null;

      // Upload PDF to Supabase Storage if available
      const pdfFile = currentPdfFileRef.current;
      if (pdfFile) {
        const fileName = `${Date.now()}_${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('pdf-files')
          .upload(fileName, pdfFile, { contentType: 'application/pdf', upsert: false });

        if (uploadError) {
          console.warn('PDF upload failed:', uploadError.message);
        } else {
          pdfStoragePath = fileName;
        }
      }

      const { error: insertError } = await supabase
        .from('certificates')
        .insert({
          cert_number: formData.cert_number,
          date_start_day: formData.date_start_day,
          date_start_month: formData.date_start_month,
          date_start_year: formData.date_start_year,
          date_end_day: formData.date_end_day,
          date_end_month: formData.date_end_month,
          date_end_year: formData.date_end_year,
          cert_body_name: formData.cert_body_name,
          cert_body_address: formData.cert_body_address,
          cert_body_number: formData.cert_body_number,
          products: formData.products.filter(Boolean).join(' '),
          quantity: formData.quantity,
          quantity_unit: formData.quantity_unit,
          code_num: formData.code_num,
          code_nm: formData.code_nm,
          norm_documents: [formData.norm_documents_1, formData.norm_documents_2].filter(Boolean).join(' '),
          country: formData.country,
          issued_to_org: formData.issued_to_org,
          issued_to_address: formData.issued_to_address,
          basis_document: formData.basis_documents.filter(Boolean).join(' '),
          additional_info: formData.additional_info.filter(Boolean).join(' '),
          head_name: formData.head_name,
          dept_head_name: formData.dept_head_name,
          serial_number: formData.serial_number,
          copy_number: formData.copy_number,
          cert_processing: formData.cert_processing,
          total_cost: formData.total_cost,
          amount_due: formData.amount_due,
          tests: formData.tests,
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date,
          inn: formData.inn,
          pdf_storage_path: pdfStoragePath,
        });

      if (insertError) {
        setError('Ошибка при сохранении: ' + insertError.message);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Не удалось сохранить в базу данных');
    }
  }, [formData]);

  // Download Excel
  const downloadExcel = useCallback(() => {
    const row = formToRegistryRow(formData);
    const headers = ALL_COLUMNS.map(col => COLUMN_LABELS[col]);
    const values = ALL_COLUMNS.map(col => row[col as keyof typeof row] || '');
    const ws = XLSX.utils.aoa_to_sheet([headers, values]);

    // "Оформление сертификата" header spans I-L (indices 8..11)
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 8 }, e: { r: 0, c: 11 } });
    ws['I1'] = { v: 'Оформление сертификата', t: 's' };

    ws['!cols'] = ALL_COLUMNS.map(col => {
      if (['I', 'J', 'K', 'D'].includes(col)) return { wch: 5 };
      if (['A', 'B', 'L', 'N1'].includes(col)) return { wch: 6 };
      if (['H', 'M', 'O'].includes(col)) return { wch: 35 };
      return { wch: 15 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, 'реестр_сертификатов.xlsx');
  }, [formData]);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Clear form
  const clearForm = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    setPdfUrl(null);
    setError(null);
    setCopied(false);
    setSaved(false);
    userEditedQuantityRef.current = false;
    currentPdfFileRef.current = null;
    try { localStorage.removeItem(FORM_DRAFT_KEY); } catch {}
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Save current form as template
  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim();
    if (!name) return;
    setTemplateSaving(true);
    const templateData = { ...formData } as Partial<CertificateFormData>;
    UNIQUE_FIELDS.forEach(f => delete templateData[f]);
    await supabase.from('templates').insert({ name, data: templateData });
    await loadTemplates();
    setTemplateName('');
    setTemplateSaving(false);
  }, [formData, templateName, loadTemplates]);

  // Load template into form (clears unique fields)
  const handleLoadTemplate = useCallback((t: CertTemplate) => {
    const tData = t.data || {};
    setFormData({
      ...EMPTY_FORM_DATA,
      ...tData,
      products: Array.isArray(tData.products) && tData.products.length > 0
        ? tData.products
        : EMPTY_FORM_DATA.products,
      basis_documents: Array.isArray(tData.basis_documents) && tData.basis_documents.length > 0
        ? tData.basis_documents
        : EMPTY_FORM_DATA.basis_documents,
      additional_info: Array.isArray(tData.additional_info)
        ? (tData.additional_info.length > 0 ? tData.additional_info : [''])
        : [typeof tData.additional_info === 'string' ? tData.additional_info : ''],
      cert_number: '',
      cert_number_on_blank: '',
      date_start_day: '', date_start_month: '', date_start_year: '',
      date_end_day: '', date_end_month: '', date_end_year: '',
      serial_number: '', copy_number: '',
      invoice_number: '', invoice_date: '',
    });
    userEditedQuantityRef.current = false;
    setShowTemplatesPanel(false);
    setError(null);
  }, []);

  // Delete template
  const handleDeleteTemplate = useCallback(async (id: string) => {
    await supabase.from('templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => { if (showTemplatesPanel) setShowTemplatesPanel(false); }}>
      <main className="max-w-[1200px] mx-auto p-4" onClick={e => e.stopPropagation()}>
        {/* Top toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-lg font-medium bg-[#2E7D32] text-white hover:bg-green-800 transition-colors text-sm"
          >
            Печать
          </button>

          <label className="px-5 py-2.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm cursor-pointer">
            Загрузить PDF
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={onFileSelect}
              className="hidden"
            />
          </label>

          <button
            onClick={copyRow}
            className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors text-sm ${
              copied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {copied ? 'Скопировано!' : 'Копировать строку'}
          </button>

          <button
            onClick={saveToRegistry}
            className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors text-sm ${
              saved ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {saved ? 'Сохранено!' : 'В реестр'}
          </button>

          <button
            onClick={downloadExcel}
            className="px-5 py-2.5 rounded-lg font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm"
          >
            Excel
          </button>

          <button
            onClick={clearForm}
            className="px-5 py-2.5 rounded-lg font-medium bg-gray-500 text-white hover:bg-gray-600 transition-colors text-sm"
          >
            Очистить
          </button>

          {/* Template buttons */}
          <div className="relative">
            <button
              onClick={() => setShowTemplatesPanel(v => !v)}
              className="px-5 py-2.5 rounded-lg font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors text-sm"
            >
              Шаблоны {templates.length > 0 && `(${templates.length})`}
            </button>
            {showTemplatesPanel && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-72">
                <div className="p-3 border-b">
                  <p className="text-xs text-gray-500 mb-2">Загрузить шаблон — заполнит форму без уникальных полей</p>
                  {templates.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Шаблонов нет. Сохраните первый.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {templates.map(t => (
                        <div key={t.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
                          <button
                            onClick={() => handleLoadTemplate(t)}
                            className="text-sm text-left text-gray-800 hover:text-teal-700 font-medium flex-1 truncate"
                          >
                            {t.name}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Сохранить текущие данные как шаблон:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                      placeholder="Название (напр. ООО Далери)"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-teal-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || templateSaving}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-teal-700"
                    >
                      {templateSaving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => setCalibrationMode(!calibrationMode)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                calibrationMode
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {calibrationMode ? 'Настройка полей (ВКЛ)' : 'Настройка полей'}
            </button>
            <button
              onClick={() => setShowRegistry(!showRegistry)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {showRegistry ? 'Скрыть реестр' : 'Данные реестра'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg no-print">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mb-4 text-center py-4 no-print">
            <div className="inline-block w-6 h-6 border-3 border-[#2E7D32] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Извлекаю данные из PDF...</span>
          </div>
        )}

        <div className="flex gap-4">
          {/* Main: Certificate editor */}
          <div className="flex-shrink-0">
            <div
              id="print-area-wrapper"
              className="border border-gray-300 shadow-lg bg-white"
            >
              <CertificateEditor
                formData={formData}
                onFieldChange={updateField}
                onArrayFieldChange={updateArrayField}
                onAddArrayRow={addArrayRow}
                onRemoveArrayRow={removeArrayRow}
                calibrationMode={calibrationMode}
              />
            </div>
          </div>

          {/* Side panel: registry-only fields */}
          {showRegistry && (
            <div className="flex-1 min-w-[280px] max-w-[360px] no-print">
              <div className="border rounded-lg bg-white p-4 space-y-3 sticky top-4">
                <h3 className="text-sm font-bold text-[#2E7D32] uppercase tracking-wide">
                  Данные для реестра
                </h3>

                <SideField label="№ сертификата" required>
                  <input
                    type="text"
                    value={formData.cert_number}
                    onChange={e => updateField('cert_number', e.target.value)}
                    placeholder="238279"
                    className="form-input"
                  />
                </SideField>

                <div className="grid grid-cols-2 gap-2">
                  <SideField label="№ п/п">
                    <input
                      type="number"
                      value={formData.serial_number}
                      onChange={e => updateField('serial_number', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                  <SideField label="№ копии">
                    <input
                      type="text"
                      value={formData.copy_number}
                      onChange={e => updateField('copy_number', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SideField label="Оформление">
                    <input
                      type="number"
                      value={formData.cert_processing}
                      onChange={e => updateField('cert_processing', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                  <SideField label="ИНН">
                    <input
                      type="text"
                      value={formData.inn}
                      onChange={e => updateField('inn', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SideField label="Стоимость">
                    <input
                      type="text"
                      value={formData.total_cost}
                      onChange={e => updateField('total_cost', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                  <SideField label="К оплате">
                    <input
                      type="text"
                      value={formData.amount_due}
                      onChange={e => updateField('amount_due', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                </div>

                {/* Количество + единица измерения */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Количество
                    {autoQuantityLoading && (
                      <span className="ml-2 text-[10px] text-gray-400 font-normal">
                        считаю…
                      </span>
                    )}
                    {userEditedQuantityRef.current && !autoQuantityLoading && (
                      <span className="ml-2 text-[10px] text-amber-500 font-normal">
                        ручной ввод
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.quantity}
                      onChange={e => updateField('quantity', e.target.value)}
                      placeholder="1000"
                      className="form-input flex-1"
                    />
                    <input
                      type="text"
                      value={formData.quantity_unit}
                      onChange={e => updateField('quantity_unit', e.target.value)}
                      placeholder="кг"
                      className="form-input w-20"
                    />
                  </div>
                </div>

                {/* На основании — массив */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    На основании
                  </label>
                  <div className="space-y-1">
                    {formData.basis_documents.map((b, i) => (
                      <div key={i} className="flex gap-1">
                        <input
                          type="text"
                          value={b}
                          onChange={e => updateArrayField('basis_documents', i, e.target.value)}
                          placeholder={i === 0 ? 'Протокол…' : 'Доп. строка'}
                          className="form-input flex-1"
                        />
                        {formData.basis_documents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeArrayRow('basis_documents', i)}
                            className="px-2 text-gray-400 hover:text-red-500 text-sm"
                            title="Удалить строку"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addArrayRow('basis_documents')}
                    className="mt-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    + Добавить строку
                  </button>
                </div>

                <SideField label="Испытаний">
                  <input
                    type="text"
                    value={formData.tests}
                    onChange={e => updateField('tests', e.target.value)}
                    className="form-input"
                  />
                </SideField>

                <div className="grid grid-cols-2 gap-2">
                  <SideField label="№ фактуры">
                    <input
                      type="text"
                      value={formData.invoice_number}
                      onChange={e => updateField('invoice_number', e.target.value)}
                      className="form-input"
                    />
                  </SideField>
                  <SideField label="Дата фактуры">
                    <input
                      type="text"
                      value={formData.invoice_date}
                      onChange={e => updateField('invoice_date', e.target.value)}
                      placeholder="ДД.ММ.ГГ"
                      className="form-input"
                    />
                  </SideField>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Registry row table */}
        <div className="mt-4 border rounded-lg overflow-hidden no-print">
          <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm border-b">
            Строка для реестра
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {ALL_COLUMNS.map(col => (
                    <th
                      key={col}
                      className="bg-[#2E7D32] text-white px-2 py-2 border border-green-800 text-center whitespace-nowrap text-xs font-medium"
                    >
                      <div>{col}</div>
                      <div className="font-normal text-green-100 text-[10px]">
                        {COLUMN_LABELS[col]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(() => {
                    const row = formToRegistryRow(formData);
                    return ALL_COLUMNS.map(col => (
                      <td
                        key={col}
                        className="px-2 py-2 border border-gray-300 text-center text-xs max-w-[200px] truncate"
                        title={row[col as keyof typeof row] || ' '}
                      >
                        {row[col as keyof typeof row] || ' '}
                      </td>
                    ));
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function SideField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
