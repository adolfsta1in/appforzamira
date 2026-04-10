'use client';

import { useState, useEffect } from 'react';
import { CertificateFormData, formToRegistryRow, ALL_COLUMNS, COLUMN_LABELS } from '@/lib/certificateTypes';

interface SavedCert extends CertificateFormData {
  savedAt: string;
}

export default function RegistryPage() {
  const [certs, setCerts] = useState<SavedCert[]>([]);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('cert_registry') || '[]');
      setCerts(data);
    } catch {
      setCerts([]);
    }
  }, []);

  const deleteCert = (index: number) => {
    const updated = certs.filter((_, i) => i !== index);
    setCerts(updated);
    localStorage.setItem('cert_registry', JSON.stringify(updated));
  };

  const clearAll = () => {
    if (confirm('Удалить все сертификаты из реестра?')) {
      setCerts([]);
      localStorage.removeItem('cert_registry');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[1800px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Реестр сертификатов ({certs.length})
          </h2>
          {certs.length > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Очистить реестр
            </button>
          )}
        </div>

        {certs.length === 0 ? (
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
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((cert, idx) => {
                    const row = formToRegistryRow(cert);
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 py-2 border border-gray-300 text-center text-xs">
                          {idx + 1}
                        </td>
                        {ALL_COLUMNS.map(col => (
                          <td
                            key={col}
                            className="px-2 py-2 border border-gray-300 text-center text-xs max-w-[150px] truncate"
                            title={row[col as keyof typeof row] || ''}
                          >
                            {row[col as keyof typeof row] || '\u00A0'}
                          </td>
                        ))}
                        <td className="px-2 py-2 border border-gray-300 text-center">
                          <button
                            onClick={() => deleteCert(idx)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Удалить
                          </button>
                        </td>
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
