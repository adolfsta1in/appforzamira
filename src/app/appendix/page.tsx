'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface AppendixRow {
  id: string;
  uploaded_at: string;
  original_name: string;
  storage_path: string;
  cert_number: string | null;
}

export default function AppendixPage() {
  const [files, setFiles] = useState<AppendixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certNumberInput, setCertNumberInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('appendices')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (fetchError) {
      setError('Ошибка загрузки: ' + fetchError.message);
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from('appendix-files')
      .upload(fileName, file, { upsert: false });

    if (uploadError) {
      setError('Ошибка загрузки файла: ' + uploadError.message);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const { error: insertError } = await supabase
      .from('appendices')
      .insert({
        original_name: file.name,
        storage_path: fileName,
        cert_number: certNumberInput.trim() || null,
      });

    if (insertError) {
      setError('Ошибка сохранения: ' + insertError.message);
    } else {
      setCertNumberInput('');
      await loadFiles();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [certNumberInput, loadFiles]);

  const openFile = useCallback((storagePath: string) => {
    const { data } = supabase.storage.from('appendix-files').getPublicUrl(storagePath);
    window.open(data.publicUrl, '_blank');
  }, []);

  const deleteFile = useCallback(async (id: string, storagePath: string) => {
    if (!confirm('Удалить этот файл?')) return;

    await supabase.storage.from('appendix-files').remove([storagePath]);

    const { error: deleteError } = await supabase
      .from('appendices')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert('Ошибка удаления: ' + deleteError.message);
      return;
    }

    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return '📊 ';
    if (ext === 'pdf') return '📄 ';
    if (ext === 'doc' || ext === 'docx') return '📝 ';
    if (['jpg','jpeg','png'].includes(ext || '')) return '🖼 ';
    return '📎 ';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Приложения к сертификатам</h2>

        {/* Upload panel */}
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Загрузить файл</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                № сертификата (необязательно)
              </label>
              <input
                type="text"
                value={certNumberInput}
                onChange={e => setCertNumberInput(e.target.value)}
                placeholder="например, 238279"
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] focus:outline-none w-52"
              />
            </div>

            <label className={`px-5 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#2E7D32] text-white hover:bg-green-800'
            }`}>
              {uploading ? 'Загрузка...' : 'Выбрать файл'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <span className="text-xs text-gray-400">PDF, Excel, Word, изображения</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Files list */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">
              Файлы ({files.length})
            </span>
            <button
              onClick={loadFiles}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Обновить
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-sm">Загрузка...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Файлов нет</p>
              <p className="text-xs mt-1">Загрузите первый файл выше</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Файл</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">№ сертификата</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Дата</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openFile(file.storage_path)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {fileIcon(file.original_name)}{file.original_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {file.cert_number || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(file.uploaded_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteFile(file.id, file.storage_path)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
