'use client';

import { useState, useEffect } from 'react';
import {
  PrintLayoutConfig,
  DEFAULT_PRINT_LAYOUT,
  LAYOUT_FIELD_LABELS,
  loadPrintLayout,
  savePrintLayout,
  resetPrintLayout,
} from '@/lib/printLayout';

type LayoutKey = keyof PrintLayoutConfig;

export default function SettingsPage() {
  const [layout, setLayout] = useState<PrintLayoutConfig>(DEFAULT_PRINT_LAYOUT);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setLayout(loadPrintLayout());
  }, []);

  const updateField = (key: LayoutKey, prop: 'top' | 'left' | 'fontSize', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setLayout(prev => ({
      ...prev,
      [key]: { ...prev[key], [prop]: num },
    }));
  };

  const handleSave = () => {
    savePrintLayout(layout);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleReset = () => {
    resetPrintLayout();
    setLayout(DEFAULT_PRINT_LAYOUT);
    setSavedMsg(false);
  };

  const keys = Object.keys(DEFAULT_PRINT_LAYOUT) as LayoutKey[];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Настройка позиций печати</h2>
        <p className="text-sm text-gray-500 mb-6">
          Координаты полей на бланке A4 (210×297 мм). Подгоните значения после тестовой печати.
        </p>

        <div className="flex gap-3 mb-6">
          <button
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-colors ${
              savedMsg ? 'bg-green-600' : 'bg-[#2E7D32] hover:bg-green-800'
            }`}
          >
            {savedMsg ? '✅ Сохранено!' : 'Сохранить'}
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-lg font-medium bg-gray-500 text-white hover:bg-gray-600 text-sm transition-colors"
          >
            Сбросить к стандартным
          </button>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left px-4 py-2 font-medium text-gray-700">Поле</th>
                <th className="px-4 py-2 font-medium text-gray-700 w-24">top (мм)</th>
                <th className="px-4 py-2 font-medium text-gray-700 w-24">left (мм)</th>
                <th className="px-4 py-2 font-medium text-gray-700 w-24">fontSize (пт)</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700 font-medium">
                    {LAYOUT_FIELD_LABELS[key]}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      value={layout[key].top}
                      onChange={e => updateField(key, 'top', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-center text-sm focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      value={layout[key].left}
                      onChange={e => updateField(key, 'left', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-center text-sm focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      value={layout[key].fontSize}
                      onChange={e => updateField(key, 'fontSize', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-center text-sm focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
