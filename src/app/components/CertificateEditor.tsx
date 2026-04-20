'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { CertificateFormData, TAJIK_MONTHS } from '@/lib/certificateTypes';

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
  date_start_month:  { top: 70.6, left: 68.8,   width: 29.8,  height: 6.5,  fontSize: 12, textAlign: 'center' },
  date_start_year:   { top: 70.3, left: 103.3,  width: 11.3,  height: 7.1,  fontSize: 12, textAlign: 'center' },
  date_end_day:      { top: 71.1, left: 133.6,  width: 10,    height: 6.8,  fontSize: 12, textAlign: 'center' },
  date_end_month:    { top: 71.3, left: 146.5,  width: 28.8,  height: 6.5,  fontSize: 12, textAlign: 'center' },
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
  code_num:          { top: 96.4,  left: 167.6, width: 28,    height: 7,    fontSize: 8,  textAlign: 'center' },
  code_nm:           { top: 108.1, left: 167.9, width: 28,    height: 7,    fontSize: 8,  textAlign: 'center' },

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

  // Дополнительная информация
  additional_info:   { top: 212.2, left: 49.3,  width: 137.1, height: 8.7,  fontSize: 12, textAlign: 'left' },

  // ФИО внизу справа
  head_name:         { top: 240.9, left: 138.3, width: 57,    height: 6,    fontSize: 12, textAlign: 'center' },
  dept_head_name:    { top: 258.1, left: 138.3, width: 57,    height: 6,    fontSize: 12, textAlign: 'center' },
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
  additional_info: 'Доп. инфо',
  head_name: 'ФИО рук.',
  dept_head_name: 'ФИО нач. отд.',
};

const STORAGE_KEY = 'cert_field_layouts';
const LAYOUT_VERSION = '3'; // bump this whenever DEFAULT_LAYOUTS changes
const LAYOUT_VERSION_KEY = 'cert_field_layouts_version';

function loadLayouts(): AllFieldLayouts {
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
      const parsed = JSON.parse(saved);
      // Only keep keys that still exist in DEFAULT_LAYOUTS (removes deleted fields)
      const filtered: AllFieldLayouts = {};
      for (const key of Object.keys(DEFAULT_LAYOUTS)) {
        filtered[key] = parsed[key] ?? DEFAULT_LAYOUTS[key];
      }
      return filtered;
    }
  } catch {}
  return DEFAULT_LAYOUTS;
}

function saveLayouts(layouts: AllFieldLayouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

interface CertificateEditorProps {
  formData: CertificateFormData;
  onFieldChange: (key: keyof CertificateFormData, value: string) => void;
  calibrationMode: boolean;
}

// Convert mm to pixels at screen resolution (assuming 96dpi CSS pixels)
// 1mm = 3.7795px at 96dpi, but we use mm units directly in CSS
// The A4 div is 210mm x 297mm

export default function CertificateEditor({ formData, onFieldChange, calibrationMode }: CertificateEditorProps) {
  const [layouts, setLayouts] = useState<AllFieldLayouts>(DEFAULT_LAYOUTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ field: string; startX: number; startY: number; origLeft: number; origTop: number } | null>(null);
  const [resizing, setResizing] = useState<{ field: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayouts(loadLayouts());
  }, []);

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
      setDragging({ field, startX: e.clientX, startY: e.clientY, origLeft: layout.left, origTop: layout.top });
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
        setLayouts(prev => ({
          ...prev,
          [dragging.field]: {
            ...prev[dragging.field],
            left: Math.round((dragging.origLeft + dx) * 10) / 10,
            top: Math.round((dragging.origTop + dy) * 10) / 10,
          }
        }));
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
  }, [dragging, resizing, getMmPerPx]);

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
          const updated = {
            ...prev,
            [selected]: {
              ...prev[selected],
              left: Math.round((prev[selected].left + dx) * 10) / 10,
              top: Math.round((prev[selected].top + dy) * 10) / 10,
            }
          };
          saveLayouts(updated);
          return updated;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [calibrationMode, selected]);

  const updateFieldLayout = useCallback((field: string, key: keyof FieldLayout, value: number | string) => {
    setLayouts(prev => {
      const updated = { ...prev, [field]: { ...prev[field], [key]: value } };
      saveLayouts(updated);
      return updated;
    });
  }, []);

  const resetLayouts = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLayouts(DEFAULT_LAYOUTS);
  }, []);

  const exportLayouts = useCallback(() => {
    const json = JSON.stringify(layouts, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      alert('Позиции скопированы в буфер обмена! Отправь мне этот JSON.');
    });
  }, [layouts]);

  const isMultiline = (field: string) =>
    ['basis_document_1', 'basis_document_2', 'additional_info'].includes(field);

  const isMonthSelect = (field: string) =>
    field === 'date_start_month' || field === 'date_end_month';

  return (
    <div style={{ display: 'flex', gap: '16px' }}>
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
          const fieldKey = field as keyof CertificateFormData;
          const value = formData[fieldKey] || '';
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
                  onChange={e => onFieldChange(fieldKey, e.target.value)}
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
              ) : isMultiline(field) ? (
                <textarea
                  value={value}
                  onChange={e => onFieldChange(fieldKey, e.target.value)}
                  onMouseDown={e => { if (calibrationMode) handleMouseDown(e, field, 'drag'); }}
                  placeholder={calibrationMode ? FIELD_LABELS[field] : ''}
                  style={{ ...baseStyle, position: 'relative', top: 0, left: 0 }}
                  className="cert-field"
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={e => onFieldChange(fieldKey, e.target.value)}
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
      </div>

      {/* Calibration panel */}
      {calibrationMode && (
        <div className="no-print" style={{ width: '260px', flexShrink: 0, fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ position: 'sticky', top: '8px' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#2E7D32' }}>Настройка полей</h3>
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
