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
import { AUTO_REPLACEMENTS, saveAutoReplacements, initAutoReplacements } from '@/lib/autoReplace';

type LayoutKey = keyof PrintLayoutConfig;

export default function SettingsPage() {
  const [layout, setLayout] = useState<PrintLayoutConfig>(DEFAULT_PRINT_LAYOUT);
  const [savedMsg, setSavedMsg] = useState(false);

  // Auto replacements state
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [newShort, setNewShort] = useState('');
  const [newLong, setNewLong] = useState('');
  const [replacementsSaved, setReplacementsSaved] = useState(false);

  useEffect(() => {
    setLayout(loadPrintLayout());
    initAutoReplacements().then(() => {
      setReplacements({ ...AUTO_REPLACEMENTS });
    });
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

  const handleSaveReplacements = async () => {
    await saveAutoReplacements(replacements);
    setReplacementsSaved(true);
    setTimeout(() => setReplacementsSaved(false), 3000);
  };

  const addReplacement = () => {
    if (!newShort.trim() || !newLong.trim()) return;
    setReplacements(prev => ({ ...prev, [newShort.trim()]: newLong.trim() }));
    setNewShort('');
    setNewLong('');
  };

  const removeReplacement = (key: string) => {
    setReplacements(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
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

        <h2 className="text-xl font-bold text-gray-800 mt-12 mb-2">Автозамена текста</h2>
        <p className="text-sm text-gray-500 mb-6">
          Настройте сокращения, которые будут автоматически разворачиваться в полный текст при наборе в полях.
        </p>

        <div className="bg-white border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left px-4 py-2 font-medium text-gray-700 w-1/4">Сокращение</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Полный текст</th>
                <th className="px-4 py-2 font-medium text-gray-700 w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(replacements).map(([short, long]) => (
                <tr key={short} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{short}</td>
                  <td className="px-4 py-2 text-gray-600">{long}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeReplacement(short)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {Object.keys(replacements).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">
                    Нет правил автозамены. Добавьте первое ниже.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div className="p-4 bg-gray-50 border-t flex items-center gap-3">
            <input
              type="text"
              placeholder="Напр. ИП"
              value={newShort}
              onChange={e => setNewShort(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm w-1/4 focus:border-[#2E7D32] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Полный текст..."
              value={newLong}
              onChange={e => setNewLong(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addReplacement()}
              className="px-3 py-2 border border-gray-300 rounded text-sm flex-1 focus:border-[#2E7D32] focus:outline-none"
            />
            <button
              onClick={addReplacement}
              disabled={!newShort.trim() || !newLong.trim()}
              className="px-4 py-2 bg-blue-500 text-white font-medium text-sm rounded disabled:opacity-50 hover:bg-blue-600"
            >
              Добавить
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveReplacements}
          className={`px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-colors mb-10 ${
            replacementsSaved ? 'bg-green-600' : 'bg-[#2E7D32] hover:bg-green-800'
          }`}
        >
          {replacementsSaved ? '✅ Сохранено!' : 'Сохранить правила автозамены'}
        </button>

      </main>
    </div>
  );
}
