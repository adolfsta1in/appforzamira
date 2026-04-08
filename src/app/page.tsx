'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CertificateData,
  COLUMN_LABELS,
  ALL_COLUMNS,
  DISABLED_COLUMNS,
  AUTO_COLUMNS,
  ColumnKey,
} from '@/lib/parseCertificate';
import * as XLSX from 'xlsx';

const EMPTY_DATA: CertificateData = {
  A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '',
  I: '', J: '', K: '', L: '1', M: '', N: '', O: '', P: '',
  Q: '', R: '', S: '', T: '', U: '', V: '',
};

export default function Home() {
  const [data, setData] = useState<CertificateData>(EMPTY_DATA);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate B from A
  useEffect(() => {
    const num = parseInt(data.A);
    if (!isNaN(num) && num > 0) {
      const b = num < 10 ? `0${num}` : `${num}`;
      if (data.B !== b) {
        setData(prev => ({ ...prev, B: b }));
      }
    } else if (data.A === '' && data.B !== '') {
      setData(prev => ({ ...prev, B: '' }));
    }
  }, [data.A, data.B]);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Пожалуйста, загрузите PDF файл');
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    // Create PDF preview URL
    const url = URL.createObjectURL(file);
    setPdfUrl(url);

    // Parse PDF
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/parse', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Ошибка при обработке PDF');
        setData(EMPTY_DATA);
      } else {
        setData(json.data);
      }
    } catch {
      setError('Не удалось подключиться к серверу');
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateField = useCallback((key: ColumnKey, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const copyRow = useCallback(async () => {
    const row = ALL_COLUMNS.map(col => data[col]).join('\t');
    try {
      await navigator.clipboard.writeText(row);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = row;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [data]);

  const downloadExcel = useCallback(() => {
    const headers = ALL_COLUMNS.map(col => COLUMN_LABELS[col]);
    const values = ALL_COLUMNS.map(col => data[col]);
    const ws = XLSX.utils.aoa_to_sheet([headers, values]);

    // Merge I-L header: "Оформление сертификата"
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 8 }, e: { r: 0, c: 11 } });
    ws['I1'] = { v: 'Оформление сертификата', t: 's' };

    // Column widths
    ws['!cols'] = ALL_COLUMNS.map(col => {
      if (['I', 'J', 'K', 'D'].includes(col)) return { wch: 5 };
      if (['A', 'B', 'L'].includes(col)) return { wch: 6 };
      if (['H', 'M', 'O'].includes(col)) return { wch: 35 };
      return { wch: 15 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, 'реестр_сертификатов.xlsx');
  }, [data]);

  const resetAll = useCallback(() => {
    setData(EMPTY_DATA);
    setPdfUrl(null);
    setError(null);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const hasParsedData = pdfUrl !== null;
  const isFieldEmpty = (key: ColumnKey) => !data[key] && !DISABLED_COLUMNS.includes(key) && !AUTO_COLUMNS.includes(key);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#2E7D32] text-white py-4 px-6 shadow-md">
        <h1 className="text-xl font-bold text-center">
          Реестр сертификатов соответствия — Агентии Тоҷикстандарт
        </h1>
      </header>

      <main className="max-w-[1600px] mx-auto p-4">
        {/* Upload Zone */}
        {!hasParsedData && (
          <div
            className={`mt-8 border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#2E7D32] bg-green-50'
                : 'border-gray-300 hover:border-[#2E7D32] hover:bg-green-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={onFileSelect}
              className="hidden"
            />
            <div className="text-6xl mb-4">📄</div>
            <p className="text-xl text-gray-700 font-medium">
              Перетащите PDF сертификата сюда
            </p>
            <p className="text-gray-500 mt-2">или нажмите для выбора файла</p>
            <p className="text-sm text-gray-400 mt-4">Принимаются только файлы .pdf</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-8 text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-lg text-gray-600">Извлекаю данные...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Results */}
        {hasParsedData && !loading && (
          <div className="mt-4 space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={copyRow}
                className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                  copied ? 'bg-green-600' : 'bg-[#2E7D32] hover:bg-green-800'
                }`}
              >
                {copied ? 'Скопировано! Вставьте в Excel через Ctrl+V' : 'Скопировать строку'}
              </button>
              <button
                onClick={downloadExcel}
                className="px-6 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Скачать как Excel
              </button>
              <button
                onClick={resetAll}
                className="px-6 py-3 rounded-lg font-medium bg-gray-500 text-white hover:bg-gray-600 transition-colors"
              >
                Загрузить другой
              </button>
            </div>

            {/* Two-column layout: PDF + Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PDF Preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 border-b">
                  Превью PDF
                </div>
                <iframe
                  src={pdfUrl}
                  className="w-full"
                  style={{ height: '600px' }}
                  title="PDF Preview"
                />
              </div>

              {/* Editable Form */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 border-b">
                  Редактируемая форма
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                  {ALL_COLUMNS.map(col => {
                    const disabled = DISABLED_COLUMNS.includes(col);
                    const isAuto = AUTO_COLUMNS.includes(col);
                    const empty = isFieldEmpty(col);

                    return (
                      <div key={col} className="flex items-center gap-2">
                        <label className="w-8 text-sm font-bold text-gray-500 shrink-0">
                          {col}
                        </label>
                        <div className="flex-1">
                          <input
                            type={col === 'A' ? 'number' : 'text'}
                            value={data[col]}
                            onChange={(e) => updateField(col, e.target.value)}
                            disabled={disabled || isAuto}
                            placeholder={COLUMN_LABELS[col]}
                            className={`w-full px-3 py-2 border rounded text-sm transition-colors ${
                              disabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : isAuto
                                ? 'bg-blue-50 text-gray-600 cursor-not-allowed'
                                : empty
                                ? 'border-yellow-400 bg-yellow-50'
                                : 'border-gray-300 focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32]'
                            }`}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-40 shrink-0 hidden xl:block">
                          {COLUMN_LABELS[col]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Visual Table Row */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 border-b">
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
                      {ALL_COLUMNS.map(col => (
                        <td
                          key={col}
                          className="px-2 py-2 border border-gray-300 text-center text-xs max-w-[200px] truncate"
                          title={data[col]}
                        >
                          {data[col] || '\u00A0'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
