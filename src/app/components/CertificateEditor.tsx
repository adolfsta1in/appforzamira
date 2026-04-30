'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { CertificateFormData, TAJIK_MONTHS } from '@/lib/certificateTypes';
import { supabase } from '@/lib/supabase';
import { AutocompleteInput } from '@/app/components/AutocompleteInput';

const AUTOCOMPLETE_FIELDS: Record<string, string> = {
  'cert_body_name': 'cert_body_name',
  'cert_body_address': 'cert_body_address',
  'issued_to_org': 'issued_to_org',
  'issued_to_address': 'issued_to_address',
  'products_1': 'products',
  'products_2': 'products',
  'products_3': 'products',
  'norm_documents_1': 'norm_documents',
  'norm_documents_2': 'norm_documents',
  'basis_document_1': 'basis_document',
  'basis_document_2': 'basis_document',
  'additional_info_1': 'additional_info',
  'country': 'country',
  'head_name': 'head_name',
  'dept_head_name': 'dept_head_name',
};

// Field layout: each field has position, size, font, alignment
export interface FieldLayout {
  top: number;    // mm
  left: number;   // mm
  width: number;  // mm
  height: number; // mm
  fontSize: number; // pt
  textAlign: 'left' | 'center' | 'right';
}

export interface AllFieldLayouts {
  [key: string]: FieldLayout;
}

// Initial approximate positions (user will drag to correct positions)
const DEFAULT_LAYOUTS: AllFieldLayouts = {
  // Номер сертификата на бланке — независимое поле (не связано с № в реестре)
  cert_number_on_blank: { top: 33.1, left: 84.7, width: 49.6, height: 7,   fontSize: 12, textAlign: 'center' },

  // Строка с датами — 6 маленьких блоков
  date_start_day:    { top: 70.4, left: 56,     width: 10,    height: 6.8,  fontSize: 12, textAlign: 'center' },
  date_start_month:  { top: 70.4, left: 68.8,   width: 29.8,  height: 6.5,  fontSize: 12, textAlign: 'center' },
  date_start_year:   { top: 70.4, left: 103.3,  width: 11.3,  height: 7.1,  fontSize: 12, textAlign: 'center' },
  date_end_day:      { top: 71.1, left: 133.6,  width: 10,    height: 6.8,  fontSize: 12, textAlign: 'center' },
  date_end_month:    { top: 71.1, left: 146.5,  width: 28.8,  height: 6.5,  fontSize: 12, textAlign: 'center' },
  date_end_year:     { top: 71.1, left: 180.3,  width: 8.6,   height: 7,    fontSize: 12, textAlign: 'center' },

  // Орган по сертификации
  cert_body_name:    { top: 81.4, left: 54.1,   width: 119.3, height: 5.9,  fontSize: 12, textAlign: 'center' },
  cert_body_address: { top: 86.9, left: 53.8,   width: 119.6, height: 6,    fontSize: 12, textAlign: 'center' },
  cert_body_number:  { top: 92.5, left: 78.7,   width: 70.7,  height: 6.3,  fontSize: 12, textAlign: 'center' },

  // Продукция — 3 строки
  products_1:        { top: 103,   left: 41.5,  width: 123.4, height: 7,    fontSize: 12, textAlign: 'center' },
  products_2:        { top: 110.5, left: 41.5,  width: 123.4, height: 5.9,  fontSize: 12, textAlign: 'center' },
  products_3:        { top: 118,   left: 41.5,  width: 130,   height: 7,    fontSize: 12, textAlign: 'center' },

  // Коды справа (вертикально, правая колонка)
  code_num:          { top: 96.4,  left: 167.6, width: 28,    height: 7,    fontSize: 12,  textAlign: 'center' },
  code_nm:           { top: 108.1, left: 167.9, width: 28,    height: 7,    fontSize: 12,  textAlign: 'center' },

  // Нормативные документы — 2 строки
  norm_documents_1:  { top: 127.3, left: 93.4,  width: 111.1, height: 7,    fontSize: 12, textAlign: 'center' },
  norm_documents_2:  { top: 134.7, left: 93.1,  width: 111.3, height: 7,    fontSize: 12, textAlign: 'center' },

  // Страна + Кому выдан
  country:           { top: 157,   left: 80.6,  width: 89.9,  height: 6.3,  fontSize: 12, textAlign: 'center' },
  issued_to_org:     { top: 176.3, left: 53,    width: 134.5, height: 7.1,  fontSize: 12, textAlign: 'center' },
  issued_to_address: { top: 182.8, left: 53.3,  width: 134.4, height: 6.8,  fontSize: 12, textAlign: 'center' },

  // На основании — 2 строки
  basis_document_1:  { top: 195.7, left: 49.9,  width: 145.7, height: 8.4,  fontSize: 12, textAlign: 'left' },
  basis_document_2:  { top: 204.1, left: 49.1,  width: 146.8, height: 7.4,  fontSize: 12, textAlign: 'left' },

  // Дополнительная информация — первая строка (остальные строятся на её основе)
  additional_info_1: { top: 212.2, left: 49.3,  width: 137.1, height: 8.7,  fontSize: 12, textAlign: 'left' },

  // ФИО внизу справа
  head_name:         { top: 240.9, left: 138.3, width: 57,    height: 6,    fontSize: 14, textAlign: 'center' },
  dept_head_name:    { top: 258.1, left: 138.3, width: 57,    height: 6,    fontSize: 14, textAlign: 'center' },
};

const FIELD_LABELS: Record<string, string> = {
  cert_number_on_blank: '№ сертификата (на бланке)',
  cert_body_number: 'Орган: код/номер',
  date_start_day: 'Дата нач: день',
  date_start_month: 'Дата нач: месяц',
  date_start_year: 'Дата нач: год',
  date_end_day: 'Дата ок: день',
  date_end_month: 'Дата ок: месяц',
  date_end_year: 'Дата ок: год',
  cert_body_name: 'Орган: название',
  cert_body_address: 'Орган: адрес',
  products_1: 'Продукция (стр. 1)',
  products_2: 'Продукция (стр. 2)',
  products_3: 'Продукция (стр. 3)',
  code_num: 'Код НУМ/ОКП',
  code_nm: 'Код НМ ФИХ/ТН ВЭД',
  norm_documents_1: 'Норм. документы (стр. 1)',
  norm_documents_2: 'Норм. документы (стр. 2)',
  basis_document_1: 'На основании (стр. 1)',
  basis_document_2: 'На основании (стр. 2)',
  country: 'Страна',
  issued_to_org: 'Кому выдан',
  issued_to_address: 'Адрес',
  additional_info_1: 'Доп. инфо',
  head_name: 'ФИО рук.',
  dept_head_name: 'ФИО нач. отд.',
};

const DATE_GROUPS: Record<string, string[]> = {
  date_start_day: ['date_start_day', 'date_start_month', 'date_start_year'],
  date_start_month: ['date_start_day', 'date_start_month', 'date_start_year'],
  date_start_year: ['date_start_day', 'date_start_month', 'date_start_year'],
  date_end_day: ['date_end_day', 'date_end_month', 'date_end_year'],
  date_end_month: ['date_end_day', 'date_end_month', 'date_end_year'],
  date_end_year: ['date_end_day', 'date_end_month', 'date_end_year'],
};

const STORAGE_KEY = 'cert_field_layouts';
const LAYOUT_VERSION = '6'; // bump this whenever DEFAULT_LAYOUTS changes
const LAYOUT_VERSION_KEY = 'cert_field_layouts_version';
const ACTIVE_PRESET_KEY = 'cert_active_preset_id'; // which preset this device uses

interface LayoutPreset {
  id: string;
  name: string;
  data: AllFieldLayouts;
  created_at?: string;
  updated_at?: string;
}

// Normalizes an arbitrary saved layout blob against current DEFAULT_LAYOUTS —
// keeps only keys that still exist, fills missing ones from defaults.
function normalizeLayouts(parsed: Partial<AllFieldLayouts> | null | undefined): AllFieldLayouts {
  const out: AllFieldLayouts = {};
  for (const key of Object.keys(DEFAULT_LAYOUTS)) {
    out[key] = (parsed && parsed[key]) || DEFAULT_LAYOUTS[key];
  }
  return out;
}

function loadLocalLayouts(): AllFieldLayouts {
  if (typeof window === 'undefined') return DEFAULT_LAYOUTS;
  try {
    // If layout version changed — reset to new defaults
    if (localStorage.getItem(LAYOUT_VERSION_KEY) !== LAYOUT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
      return DEFAULT_LAYOUTS;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizeLayouts(JSON.parse(saved));
    }
  } catch {}
  return DEFAULT_LAYOUTS;
}

function saveLocalLayouts(layouts: AllFieldLayouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

function getActivePresetId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PRESET_KEY);
}

function setActivePresetIdLS(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_PRESET_KEY, id);
  else localStorage.removeItem(ACTIVE_PRESET_KEY);
}

type ArrayFieldKey = 'products' | 'basis_documents' | 'additional_info';

// Layout keys that render a specific index of an array field.
// Products and additional_info can grow beyond these base keys via the "+" button on the blank —
// extra rows reuse the last base layout, shifted down by its height.
const ARRAY_LAYOUT_MAP: Record<string, { key: ArrayFieldKey; index: number }> = {
  products_1: { key: 'products', index: 0 },
  products_2: { key: 'products', index: 1 },
  products_3: { key: 'products', index: 2 },
  basis_document_1: { key: 'basis_documents', index: 0 },
  basis_document_2: { key: 'basis_documents', index: 1 },
  additional_info_1: { key: 'additional_info', index: 0 },
};

// For "+" button on the blank: which base layout the extras stack below, and starting index in the array.
const EXTENDABLE_FIELDS: { baseLayoutKey: string; arrayKey: ArrayFieldKey; startIndex: number; label: string }[] = [
  { baseLayoutKey: 'products_3',       arrayKey: 'products',        startIndex: 3, label: 'Продукция' },
  { baseLayoutKey: 'additional_info_1', arrayKey: 'additional_info', startIndex: 1, label: 'Доп. инфо' },
];

interface CertificateEditorProps {
  formData: CertificateFormData;
  onFieldChange: (key: keyof CertificateFormData, value: string) => void;
  onArrayFieldChange: (key: ArrayFieldKey, index: number, value: string) => void;
  onAddArrayRow: (key: ArrayFieldKey) => void;
  onRemoveArrayRow: (key: ArrayFieldKey, index: number) => void;
  calibrationMode: boolean;
}

// Convert mm to pixels at screen resolution (assuming 96dpi CSS pixels)
// 1mm = 3.7795px at 96dpi, but we use mm units directly in CSS
// The A4 div is 210mm x 297mm

export default function CertificateEditor({ formData, onFieldChange, onArrayFieldChange, onAddArrayRow, onRemoveArrayRow, calibrationMode }: CertificateEditorProps) {
  const [layouts, setLayouts] = useState<AllFieldLayouts>(DEFAULT_LAYOUTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ field: string; startX: number; startY: number; origLeft: number; origTop: number; origLayouts: AllFieldLayouts } | null>(null);
  const [resizing, setResizing] = useState<{ field: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Preset management
  const [presets, setPresets] = useState<LayoutPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetsInitializedRef = useRef(false);

  const loadPresets = useCallback(async (): Promise<LayoutPreset[]> => {
    const { data, error } = await supabase
      .from('layout_presets')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('loadPresets failed', error);
      return [];
    }
    const list = (data || []) as LayoutPreset[];
    setPresets(list);
    return list;
  }, []);

  // Initial load: fetch presets, then apply active preset if any, otherwise local
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadPresets();
      if (cancelled) return;
      const storedId = getActivePresetId();
      const active = storedId ? list.find(p => p.id === storedId) : undefined;
      if (active) {
        setActivePresetId(active.id);
        setLayouts(normalizeLayouts(active.data));
      } else {
        if (storedId) setActivePresetIdLS(null); // stored id is stale
        setActivePresetId(null);
        setLayouts(loadLocalLayouts());
      }
      presetsInitializedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [loadPresets]);

  // Persist layout changes: local only, Supabase requires manual save
  const persistLayouts = useCallback((next: AllFieldLayouts) => {
    if (!presetsInitializedRef.current) return;
    const presetId = activePresetId;
    if (!presetId) {
      saveLocalLayouts(next);
      return;
    }
    setHasUnsavedChanges(true);
  }, [activePresetId]);

  const saveLayouts = useCallback((next: AllFieldLayouts) => {
    persistLayouts(next);
  }, [persistLayouts]);

  const saveToSupabase = useCallback(async () => {
    if (!activePresetId) return;
    setSaveStatus('saving');
    const { error } = await supabase
      .from('layout_presets')
      .update({ data: layouts, updated_at: new Date().toISOString() })
      .eq('id', activePresetId);
    if (error) {
      console.warn('saveToSupabase failed', error);
      setSaveStatus('error');
      alert('Ошибка при сохранении: ' + error.message);
    } else {
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setPresets(prev => prev.map(p => p.id === activePresetId ? { ...p, data: layouts } : p));
      setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 3000);
    }
  }, [activePresetId, layouts]);

  // Switch active preset for this device
  const selectPreset = useCallback((id: string | null) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('idle');
    setHasUnsavedChanges(false);
    setActivePresetIdLS(id);
    setActivePresetId(id);
    if (id) {
      const preset = presets.find(p => p.id === id);
      if (preset) setLayouts(normalizeLayouts(preset.data));
    } else {
      setLayouts(loadLocalLayouts());
    }
  }, [presets]);

  const createPreset = useCallback(async () => {
    const name = window.prompt('Название пресета (например: "Офис 1 — HP LaserJet"):');
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from('layout_presets')
      .insert({ name: name.trim(), data: layouts })
      .select()
      .single();
    if (error || !data) {
      alert('Не удалось создать пресет: ' + (error?.message || 'unknown'));
      return;
    }
    const created = data as LayoutPreset;
    setPresets(prev => [...prev, created]);
    setActivePresetIdLS(created.id);
    setActivePresetId(created.id);
    setSaveStatus('saved');
    setHasUnsavedChanges(false);
  }, [layouts]);

  const renamePreset = useCallback(async () => {
    if (!activePresetId) return;
    const current = presets.find(p => p.id === activePresetId);
    const name = window.prompt('Новое название:', current?.name || '');
    if (!name || !name.trim() || name.trim() === current?.name) return;
    const { error } = await supabase
      .from('layout_presets')
      .update({ name: name.trim() })
      .eq('id', activePresetId);
    if (error) {
      alert('Не удалось переименовать: ' + error.message);
      return;
    }
    setPresets(prev => prev.map(p => p.id === activePresetId ? { ...p, name: name.trim() } : p));
  }, [activePresetId, presets]);

  const deletePreset = useCallback(async () => {
    if (!activePresetId) return;
    const current = presets.find(p => p.id === activePresetId);
    if (!window.confirm(`Удалить пресет "${current?.name}"? Это действие необратимо.`)) return;
    const { error } = await supabase
      .from('layout_presets')
      .delete()
      .eq('id', activePresetId);
    if (error) {
      alert('Не удалось удалить: ' + error.message);
      return;
    }
    setPresets(prev => prev.filter(p => p.id !== activePresetId));
    setActivePresetIdLS(null);
    setActivePresetId(null);
    setLayouts(loadLocalLayouts());
  }, [activePresetId, presets]);

  const duplicatePreset = useCallback(async () => {
    const current = presets.find(p => p.id === activePresetId);
    const baseName = current ? `${current.name} (копия)` : 'Новый пресет';
    const name = window.prompt('Название нового пресета:', baseName);
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from('layout_presets')
      .insert({ name: name.trim(), data: layouts })
      .select()
      .single();
    if (error || !data) {
      alert('Не удалось создать: ' + (error?.message || 'unknown'));
      return;
    }
    const created = data as LayoutPreset;
    setPresets(prev => [...prev, created]);
    setActivePresetIdLS(created.id);
    setActivePresetId(created.id);
    setHasUnsavedChanges(false);
  }, [activePresetId, layouts, presets]);

  // Get mm-per-pixel ratio from the container
  const getMmPerPx = useCallback(() => {
    if (!containerRef.current) return { x: 1, y: 1 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: 210 / rect.width, y: 297 / rect.height };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, field: string, action: 'drag' | 'resize') => {
    if (!calibrationMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(field);
    const layout = layouts[field];
    if (action === 'drag') {
      setDragging({ field, startX: e.clientX, startY: e.clientY, origLeft: layout.left, origTop: layout.top, origLayouts: layouts });
    } else {
      setResizing({ field, startX: e.clientX, startY: e.clientY, origW: layout.width, origH: layout.height });
    }
  }, [calibrationMode, layouts]);

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ratio = getMmPerPx();
      if (dragging) {
        const dx = (e.clientX - dragging.startX) * ratio.x;
        const dy = (e.clientY - dragging.startY) * ratio.y;
        
        const group = DATE_GROUPS[dragging.field];
        
        setLayouts(prev => {
          if (group) {
            const newLayouts = { ...prev };
            group.forEach(f => {
              newLayouts[f] = {
                ...prev[f],
                left: Math.round((dragging.origLayouts[f].left + dx) * 10) / 10,
                top: Math.round((dragging.origLayouts[f].top + dy) * 10) / 10,
              };
            });
            return newLayouts;
          } else {
            return {
              ...prev,
              [dragging.field]: {
                ...prev[dragging.field],
                left: Math.round((dragging.origLeft + dx) * 10) / 10,
                top: Math.round((dragging.origTop + dy) * 10) / 10,
              }
            };
          }
        });
      }
      if (resizing) {
        const dx = (e.clientX - resizing.startX) * ratio.x;
        const dy = (e.clientY - resizing.startY) * ratio.y;
        setLayouts(prev => ({
          ...prev,
          [resizing.field]: {
            ...prev[resizing.field],
            width: Math.max(5, Math.round((resizing.origW + dx) * 10) / 10),
            height: Math.max(3, Math.round((resizing.origH + dy) * 10) / 10),
          }
        }));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
      // Auto-save on drop
      setLayouts(prev => {
        saveLayouts(prev);
        return prev;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, getMmPerPx, saveLayouts]);

  // Keyboard nudge for selected field
  useEffect(() => {
    if (!calibrationMode || !selected) return;
    const handler = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 0.5 : 0.1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (dx || dy) {
        e.preventDefault();
        setLayouts(prev => {
          const updated = { ...prev };
          const group = DATE_GROUPS[selected];
          if (group) {
            group.forEach(f => {
              updated[f] = {
                ...updated[f],
                left: Math.round((updated[f].left + dx) * 10) / 10,
                top: Math.round((updated[f].top + dy) * 10) / 10,
              };
            });
          } else {
            updated[selected] = {
              ...updated[selected],
              left: Math.round((updated[selected].left + dx) * 10) / 10,
              top: Math.round((updated[selected].top + dy) * 10) / 10,
            };
          }
          saveLayouts(updated);
          return updated;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [calibrationMode, selected, saveLayouts]);

  const updateFieldLayout = useCallback((field: string, key: keyof FieldLayout, value: number | string) => {
    setLayouts(prev => {
      const updated = { ...prev };
      const group = DATE_GROUPS[field];
      
      if (group && (key === 'top' || key === 'left')) {
        const delta = (value as number) - (prev[field][key] as number);
        group.forEach(f => {
          updated[f] = {
            ...updated[f],
            [key]: Math.round(((prev[f][key] as number) + delta) * 10) / 10,
          };
        });
      } else {
        updated[field] = { ...updated[field], [key]: value };
      }
      
      saveLayouts(updated);
      return updated;
    });
  }, [saveLayouts]);

  const resetLayouts = useCallback(() => {
    if (!window.confirm('Сбросить все позиции на значения по умолчанию?')) return;
    setLayouts(DEFAULT_LAYOUTS);
    if (activePresetId) {
      persistLayouts(DEFAULT_LAYOUTS);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activePresetId, persistLayouts]);

  const exportLayouts = useCallback(() => {
    const json = JSON.stringify(layouts, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      alert('Позиции скопированы в буфер обмена! Отправь мне этот JSON.');
    });
  }, [layouts]);

  const isMultiline = (field: string) =>
    ['basis_document_1', 'basis_document_2', 'additional_info_1'].includes(field) ||
    field.startsWith('extra_additional_info_');

  const isMonthSelect = (field: string) =>
    field === 'date_start_month' || field === 'date_end_month';

  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Quick formatting toolbar */}
        {!calibrationMode && (
          <div className="no-print" style={{ 
            height: '48px', 
            background: '#f8f9fa', 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px', 
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            width: '210mm'
          }}>
            {activeField && layouts[activeField] ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <span style={{ fontSize: '13px', color: '#555', fontWeight: 'bold' }}>
                  {FIELD_LABELS[activeField] || activeField}
                </span>
                
                {/* Font Size */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    type="button"
                    onClick={() => updateFieldLayout(activeField, 'fontSize', Math.max(6, layouts[activeField].fontSize - 0.5))}
                    style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '13px', minWidth: '36px', textAlign: 'center', fontWeight: 'bold' }}>
                    {layouts[activeField].fontSize} pt
                  </span>
                  <button 
                    type="button"
                    onClick={() => updateFieldLayout(activeField, 'fontSize', Math.min(36, layouts[activeField].fontSize + 0.5))}
                    style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +
                  </button>
                </div>

                <div style={{ width: '1px', height: '24px', background: '#ccc' }} />

                {/* Alignment */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateFieldLayout(activeField, 'textAlign', align)}
                      style={{ 
                        padding: '4px 12px', 
                        fontSize: '12px',
                        border: '1px solid',
                        borderColor: layouts[activeField].textAlign === align ? '#1976D2' : '#ccc',
                        background: layouts[activeField].textAlign === align ? '#e3f2fd' : '#fff',
                        color: layouts[activeField].textAlign === align ? '#1976D2' : '#333',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: layouts[activeField].textAlign === align ? 'bold' : 'normal'
                      }}
                    >
                      {align === 'left' ? 'Влево' : align === 'center' ? 'По центру' : 'Вправо'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>
                Кликните на любое текстовое поле на бланке, чтобы изменить его шрифт или выравнивание
              </span>
            )}
          </div>
        )}

        {/* A4 page with blank background */}
        <div
          ref={containerRef}
          id="print-area"
          className="cert-editor"
          style={{
            position: 'relative',
            width: '210mm',
            height: '297mm',
            background: '#fff',
            flexShrink: 0,
            overflow: 'hidden',
            fontFamily: "'PT Serif', 'Times New Roman', serif",
          }}
          onClick={() => { if (calibrationMode) setSelected(null); }}
        >
        {/* Editable fields */}
        {Object.keys(layouts).map(field => {
          const layout = layouts[field];
          const arrayMapping = ARRAY_LAYOUT_MAP[field];
          const fieldKey = field as keyof CertificateFormData;
          const value = arrayMapping
            ? (formData[arrayMapping.key][arrayMapping.index] || '')
            : ((formData[fieldKey] as string | undefined) || '');
          const handleValueChange = (v: string) => {
            if (arrayMapping) onArrayFieldChange(arrayMapping.key, arrayMapping.index, v);
            else onFieldChange(fieldKey, v);
          };
          const isSelected = calibrationMode && selected === field;

          const isNameField = field === 'head_name' || field === 'dept_head_name';

          const baseStyle: React.CSSProperties = {
            position: 'absolute',
            top: `${layout.top}mm`,
            left: `${layout.left}mm`,
            width: `${layout.width}mm`,
            height: `${layout.height}mm`,
            fontSize: `${layout.fontSize}pt`,
            textAlign: layout.textAlign,
            fontFamily: "'Times New Roman', serif",
            fontWeight: 'bold',
            fontStyle: isNameField ? 'normal' : 'italic',
            color: '#000',
            background: 'transparent',
            border: calibrationMode
              ? isSelected ? '2px solid #2E7D32' : '1px dashed rgba(46, 125, 50, 0.5)'
              : '1px dashed rgba(46, 125, 50, 0.15)',
            outline: 'none',
            padding: '0 1px',
            margin: 0,
            lineHeight: '1.3',
            resize: 'none',
            overflow: 'hidden',
            cursor: calibrationMode ? 'move' : 'text',
            boxSizing: 'border-box',
          };

          return (
            <div key={field} style={{ position: 'absolute', top: `${layout.top}mm`, left: `${layout.left}mm` }}>
              {/* Label in calibration mode */}
              {calibrationMode && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-4mm',
                    left: 0,
                    fontSize: '7pt',
                    color: isSelected ? '#2E7D32' : '#888',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    fontFamily: 'Arial, sans-serif',
                  }}
                >
                  {FIELD_LABELS[field] || field}
                </div>
              )}

              {isMonthSelect(field) ? (
                <select
                  value={value}
                  onChange={e => handleValueChange(e.target.value)}
                  onFocus={() => { if (!calibrationMode) setActiveField(field); }}
                  onMouseDown={e => { if (calibrationMode) { handleMouseDown(e, field, 'drag'); } }}
                  style={{
                    ...baseStyle,
                    position: 'relative',
                    top: 0,
                    left: 0,
                    appearance: calibrationMode ? 'none' : undefined,
                    WebkitAppearance: calibrationMode ? 'none' : undefined,
                  }}
                  className="cert-field"
                >
                  <option value="">--</option>
                  {TAJIK_MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.value}</option>
                  ))}
                </select>
              ) : AUTOCOMPLETE_FIELDS[field] ? (
                <AutocompleteInput
                  columnName={AUTOCOMPLETE_FIELDS[field]}
                  isMultiline={isMultiline(field)}
                  value={value}
                  onChange={handleValueChange}
                  onFocus={() => { if (!calibrationMode) setActiveField(field); }}
                  onMouseDown={e => { if (calibrationMode) handleMouseDown(e, field, 'drag'); }}
                  placeholder={calibrationMode ? FIELD_LABELS[field] : ''}
                  style={{ ...baseStyle, position: 'relative', top: 0, left: 0 }}
                  className="cert-field"
                />
              ) : isMultiline(field) ? (
                <textarea
                  value={value}
                  onChange={e => handleValueChange(e.target.value)}
                  onFocus={() => { if (!calibrationMode) setActiveField(field); }}
                  onMouseDown={e => { if (calibrationMode) handleMouseDown(e, field, 'drag'); }}
                  placeholder={calibrationMode ? FIELD_LABELS[field] : ''}
                  style={{ ...baseStyle, position: 'relative', top: 0, left: 0 }}
                  className="cert-field"
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={e => handleValueChange(e.target.value)}
                  onFocus={() => { if (!calibrationMode) setActiveField(field); }}
                  onMouseDown={e => { if (calibrationMode) handleMouseDown(e, field, 'drag'); }}
                  placeholder={calibrationMode ? FIELD_LABELS[field] : ''}
                  style={{ ...baseStyle, position: 'relative', top: 0, left: 0 }}
                  className="cert-field"
                />
              )}

              {/* Resize handle */}
              {calibrationMode && (
                <div
                  onMouseDown={e => handleMouseDown(e, field, 'resize')}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '3mm',
                    height: '3mm',
                    cursor: 'nwse-resize',
                    background: isSelected ? '#2E7D32' : 'rgba(46,125,50,0.3)',
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Extra rows added via the "+" button on the blank (products beyond row 3, additional_info beyond row 1).
            These reuse the base layout, stacked below. Not draggable in calibration mode. */}
        {EXTENDABLE_FIELDS.map(({ baseLayoutKey, arrayKey, startIndex, label }) => {
          const base = layouts[baseLayoutKey];
          if (!base) return null;
          const array = formData[arrayKey];
          const extraCount = Math.max(0, array.length - startIndex);
          const multiline = isMultiline(baseLayoutKey);

          const extraBaseStyle = (extraIdx: number): React.CSSProperties => ({
            position: 'absolute',
            top: `${base.top + base.height * (extraIdx + 1)}mm`,
            left: `${base.left}mm`,
            width: `${base.width}mm`,
            height: `${base.height}mm`,
            fontSize: `${base.fontSize}pt`,
            textAlign: base.textAlign,
            fontFamily: "'Times New Roman', serif",
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: '#000',
            background: 'transparent',
            border: '1px dashed rgba(46, 125, 50, 0.15)',
            outline: 'none',
            padding: '0 1px',
            margin: 0,
            lineHeight: '1.3',
            resize: 'none',
            overflow: 'hidden',
            cursor: 'text',
            boxSizing: 'border-box',
          });

          // Position of the "+" button: hanging off the right side of the last visible row
          // (base row if no extras, otherwise the last extra).
          const plusTop = base.top + base.height * extraCount;
          const plusLeft = base.left + base.width;

          return (
            <div key={`extra-${arrayKey}`}>
              {Array.from({ length: extraCount }).map((_, i) => {
                const arrIdx = startIndex + i;
                const value = array[arrIdx] || '';
                const fieldId = `extra_${arrayKey}_${i}`;
                const style = extraBaseStyle(i);
                return (
                  <div key={fieldId}>
                    {multiline ? (
                      <textarea
                        value={value}
                        onChange={e => onArrayFieldChange(arrayKey, arrIdx, e.target.value)}
                        onFocus={() => { if (!calibrationMode) setActiveField(baseLayoutKey); }}
                        style={style}
                        className="cert-field"
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={e => onArrayFieldChange(arrayKey, arrIdx, e.target.value)}
                        onFocus={() => { if (!calibrationMode) setActiveField(baseLayoutKey); }}
                        style={style}
                        className="cert-field"
                      />
                    )}
                    {/* Remove button for this extra row (screen only) */}
                    {!calibrationMode && (
                      <button
                        type="button"
                        onClick={() => onRemoveArrayRow(arrayKey, arrIdx)}
                        title={`Удалить строку ${arrIdx + 1}`}
                        className="no-print"
                        style={{
                          position: 'absolute',
                          top: `${base.top + base.height * (i + 1) + base.height / 2 - 3}mm`,
                          left: `${base.left - 6}mm`,
                          width: '5mm',
                          height: '5mm',
                          padding: 0,
                          border: 'none',
                          borderRadius: '50%',
                          background: '#d32f2f',
                          color: '#fff',
                          fontSize: '10pt',
                          fontWeight: 'bold',
                          lineHeight: '5mm',
                          cursor: 'pointer',
                          fontFamily: 'Arial, sans-serif',
                        }}
                      >
                        −
                      </button>
                    )}
                  </div>
                );
              })}
              {/* Add button (screen only) */}
              {!calibrationMode && (
                <button
                  type="button"
                  onClick={() => onAddArrayRow(arrayKey)}
                  title={`Добавить строку: ${label}`}
                  className="no-print"
                  style={{
                    position: 'absolute',
                    top: `${plusTop + base.height / 2 - 3}mm`,
                    left: `${plusLeft + 1}mm`,
                    width: '5mm',
                    height: '5mm',
                    padding: 0,
                    border: 'none',
                    borderRadius: '50%',
                    background: '#2E7D32',
                    color: '#fff',
                    fontSize: '10pt',
                    fontWeight: 'bold',
                    lineHeight: '5mm',
                    cursor: 'pointer',
                    fontFamily: 'Arial, sans-serif',
                  }}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Calibration panel */}
      {calibrationMode && (
        <div className="no-print" style={{ width: '260px', flexShrink: 0, fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ position: 'sticky', top: '8px' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#2E7D32' }}>Настройка полей</h3>

            {/* Presets */}
            <div style={{ background: '#f0f7f0', border: '1px solid #c8e6c9', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '11px', color: '#2E7D32' }}>Пресет (для этого ПК/принтера)</strong>
                {hasUnsavedChanges && activePresetId && (
                  <span style={{ fontSize: '10px', color: '#E65100', fontWeight: 'bold' }}>
                    ⚠️ Есть несохраненные изменения
                  </span>
                )}
              </div>
              <select
                value={activePresetId || ''}
                onChange={e => selectPreset(e.target.value || null)}
                style={{ width: '100%', padding: '4px 6px', border: '1px solid #c8e6c9', borderRadius: '3px', fontSize: '11px', marginBottom: '6px', background: '#fff' }}
              >
                <option value="">— Локально (только этот ПК) —</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  onClick={createPreset}
                  title="Создать новый пресет с текущими позициями"
                  style={{ padding: '4px 8px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}
                >
                  + Новый
                </button>
                <button
                  onClick={saveToSupabase}
                  disabled={!activePresetId || (!hasUnsavedChanges && saveStatus !== 'error')}
                  style={{ 
                    padding: '4px 8px', 
                    background: (!activePresetId || (!hasUnsavedChanges && saveStatus !== 'error')) ? '#aaa' : '#E65100', 
                    color: '#fff', border: 'none', borderRadius: '3px', 
                    cursor: (!activePresetId || (!hasUnsavedChanges && saveStatus !== 'error')) ? 'not-allowed' : 'pointer', 
                    fontSize: '10px',
                    fontWeight: hasUnsavedChanges ? 'bold' : 'normal'
                  }}
                >
                  {saveStatus === 'saving' ? 'Сохраняю...' : saveStatus === 'saved' ? '✓ Сохранено' : '💾 Сохранить'}
                </button>
                <button
                  onClick={duplicatePreset}
                  title="Создать копию текущего пресета"
                  disabled={presets.length === 0 && !activePresetId}
                  style={{ padding: '4px 8px', background: '#455A64', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}
                >
                  Копия
                </button>
                <button
                  onClick={renamePreset}
                  disabled={!activePresetId}
                  style={{ padding: '4px 8px', background: activePresetId ? '#1976D2' : '#aaa', color: '#fff', border: 'none', borderRadius: '3px', cursor: activePresetId ? 'pointer' : 'not-allowed', fontSize: '10px' }}
                >
                  Переим.
                </button>
                <button
                  onClick={deletePreset}
                  disabled={!activePresetId}
                  style={{ padding: '4px 8px', background: activePresetId ? '#d32f2f' : '#aaa', color: '#fff', border: 'none', borderRadius: '3px', cursor: activePresetId ? 'pointer' : 'not-allowed', fontSize: '10px' }}
                >
                  Удалить
                </button>
              </div>
              <p style={{ margin: '6px 0 0', color: '#666', fontSize: '10px', lineHeight: 1.3 }}>
                Пресеты общие для всех ПК. Выбор активного — на каждом ПК свой.
              </p>
            </div>

            <p style={{ margin: '0 0 8px', color: '#666', fontSize: '11px' }}>
              Перетаскивай поля мышкой. Стрелки = 0.1мм, Shift+стрелки = 0.5мм.
              Правый нижний угол — изменение размера.
            </p>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              <button
                onClick={exportLayouts}
                style={{ padding: '6px 12px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
              >
                Экспорт позиций
              </button>
              <button
                onClick={resetLayouts}
                style={{ padding: '6px 12px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
              >
                Сброс
              </button>
            </div>

            {selected && layouts[selected] && (
              <div style={{ background: '#f5f5f5', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{FIELD_LABELS[selected]}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: '#666' }}>
                    top (mm)
                    <input type="number" step="0.5" value={layouts[selected].top}
                      onChange={e => updateFieldLayout(selected, 'top', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px' }}
                    />
                  </label>
                  <label style={{ fontSize: '10px', color: '#666' }}>
                    left (mm)
                    <input type="number" step="0.5" value={layouts[selected].left}
                      onChange={e => updateFieldLayout(selected, 'left', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px' }}
                    />
                  </label>
                  <label style={{ fontSize: '10px', color: '#666' }}>
                    width (mm)
                    <input type="number" step="0.5" value={layouts[selected].width}
                      onChange={e => updateFieldLayout(selected, 'width', parseFloat(e.target.value) || 5)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px' }}
                    />
                  </label>
                  <label style={{ fontSize: '10px', color: '#666' }}>
                    height (mm)
                    <input type="number" step="0.5" value={layouts[selected].height}
                      onChange={e => updateFieldLayout(selected, 'height', parseFloat(e.target.value) || 3)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px' }}
                    />
                  </label>
                  <label style={{ fontSize: '10px', color: '#666' }}>
                    fontSize (pt)
                    <input type="number" step="0.5" value={layouts[selected].fontSize}
                      onChange={e => updateFieldLayout(selected, 'fontSize', parseFloat(e.target.value) || 10)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px' }}
                    />
                  </label>
                  <label style={{ fontSize: '10px', color: '#666' }}>
                    align
                    <select
                      value={layouts[selected].textAlign}
                      onChange={e => updateFieldLayout(selected, 'textAlign', e.target.value)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px' }}
                    >
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {/* All fields list */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Object.keys(layouts).map(field => (
                <div
                  key={field}
                  onClick={() => setSelected(field)}
                  style={{
                    padding: '4px 6px',
                    cursor: 'pointer',
                    background: selected === field ? '#e8f5e9' : 'transparent',
                    borderRadius: '3px',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{FIELD_LABELS[field]}</span>
                  <span style={{ color: '#999' }}>{layouts[field].top}, {layouts[field].left}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
