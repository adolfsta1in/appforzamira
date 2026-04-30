'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formToRegistryRow, ALL_COLUMNS, COLUMN_LABELS, CertRow, MONTHS } from '@/lib/certificateTypes';
import { supabase } from '@/lib/supabase';

interface CertRow {
  id: string;
  saved_at: string;
  cert_number: string;
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

export default function RegistryPage() {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CertRow>>({});
  
  const router = useRouter();

  const loadCerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('certificates')
      .select('*')
      .order('saved_at', { ascending: false });

    if (fetchError) {
      setError('Ошибка загрузки: ' + fetchError.message);
    } else {
      setCerts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

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
      norm_documents_1: cert.norm_documents,
      norm_documents_2: '',
      country: cert.country,
      issued_to_org: cert.issued_to_org,
      issued_to_address: cert.issued_to_address,
      basis_documents: [cert.basis_document],
      additional_info: [cert.additional_info],
      head_name: cert.head_name,
      dept_head_name: cert.dept_head_name,
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
    setEditFormData(prev => ({ ...prev, [field]: value }));
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

    await loadCerts();
    setEditingRowId(null);
    setEditFormData({});
  }, [editingRowId, editFormData, loadCerts]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[1800px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Реестр сертификатов ({certs.length})
          </h2>
          <div className="flex gap-3">
            <button
              onClick={loadCerts}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              Обновить
            </button>
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
            <div className="overflow-x-auto">
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
                        <div>{col}</div>
                        <div className="font-normal text-green-100 text-[10px]">
                          {COLUMN_LABELS[col]}
                        </div>
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
                      norm_documents_1: cert.norm_documents,
                      norm_documents_2: '',
                      country: cert.country,
                      issued_to_org: cert.issued_to_org,
                      issued_to_address: cert.issued_to_address,
                      basis_documents: [cert.basis_document],
                      additional_info: [cert.additional_info],
                      head_name: cert.head_name,
                      dept_head_name: cert.dept_head_name,
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
                            if (col === 'E') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-16 text-xs p-1 border rounded" value={editFormData.copy_number || ''} onChange={e => handleEditChange('copy_number', e.target.value)} /></td>;
                            
                            if (col === 'F') return (
                              <td key={col} className="px-1 py-1 border border-gray-300 text-xs">
                                <div className="flex gap-1">
                                  <input className="w-8 p-1 border rounded text-center" value={editFormData.date_start_day || ''} onChange={e => handleEditChange('date_start_day', e.target.value)} placeholder="DD" />
                                  <select className="w-[80px] p-1 border rounded" value={editFormData.date_start_month || ''} onChange={e => handleEditChange('date_start_month', e.target.value)}>
                                     <option value="">Месяц</option>
                                     {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
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
                                     {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                  <input className="w-12 p-1 border rounded text-center" value={editFormData.date_end_year || ''} onChange={e => handleEditChange('date_end_year', e.target.value)} placeholder="YYYY" />
                                </div>
                              </td>
                            );

                            if (col === 'H') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.issued_to_org || ''} onChange={e => { handleEditChange('issued_to_org', e.target.value); handleEditChange('issued_to_address', ''); }} /></td>;
                            if (col === 'L') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-16 text-xs p-1 border rounded" value={editFormData.cert_processing || ''} onChange={e => handleEditChange('cert_processing', e.target.value)} /></td>;
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
                            
                            // Default for uneditable columns (B, D, I, J, K)
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
