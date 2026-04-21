'use client';

import { CertificateFormData } from '@/lib/certificateTypes';
import { PrintLayoutConfig } from '@/lib/printLayout';

interface PrintPreviewProps {
  formData: CertificateFormData;
  layout: PrintLayoutConfig;
  showBlank: boolean;
}

function FieldOnPage({
  value,
  position,
}: {
  value: string;
  position: { top: number; left: number; fontSize: number; bold?: boolean; italic?: boolean; color?: string; maxWidth?: number; lineHeight?: number; textAlign?: 'left' | 'center' | 'right'; paddingLeft?: number; width?: number };
}) {
  if (!value) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: `${position.top}mm`,
        left: `${position.left}mm`,
        fontSize: `${position.fontSize}pt`,
        fontWeight: position.bold ? 'bold' : 'normal',
        fontStyle: position.italic ? 'italic' : 'normal',
        color: position.color || '#000',
        width: position.width ? `${position.width}mm` : undefined,
        maxWidth: position.maxWidth ? `${position.maxWidth}mm` : undefined,
        lineHeight: position.lineHeight ? `${position.lineHeight}pt` : undefined,
        whiteSpace: position.maxWidth ? 'pre-wrap' : 'nowrap',
        textAlign: position.textAlign || 'left',
        paddingLeft: position.paddingLeft ? `${position.paddingLeft}mm` : undefined,
        fontFamily: "'PT Serif', 'Times New Roman', serif",
      }}
    >
      {value}
    </div>
  );
}

export default function PrintPreview({ formData, layout, showBlank }: PrintPreviewProps) {
  return (
    <div
      id="print-area"
      className="print-preview-area"
      style={{
        position: 'relative',
        width: '210mm',
        height: '297mm',
        background: '#fff',
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      {showBlank && (
        <div
          className="blank-bg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0.15,
            border: '15mm solid #ccc',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Даты начала */}
      <FieldOnPage value={formData.date_start_day} position={layout.dateStartDay} />
      <FieldOnPage value={formData.date_start_month} position={layout.dateStartMonth} />
      <FieldOnPage value={formData.date_start_year} position={layout.dateStartYear} />

      {/* Даты окончания */}
      <FieldOnPage value={formData.date_end_day} position={layout.dateEndDay} />
      <FieldOnPage value={formData.date_end_month} position={layout.dateEndMonth} />
      <FieldOnPage value={formData.date_end_year} position={layout.dateEndYear} />

      {/* Орган по сертификации */}
      <FieldOnPage value={formData.cert_body_name} position={layout.certBodyName} />
      <FieldOnPage value={formData.cert_body_address} position={layout.certBodyAddress} />
      <FieldOnPage value={formData.cert_body_number} position={layout.certBodyNumber} />

      {/* Продукция + количество */}
      <FieldOnPage value={formData.products[0] || ''} position={layout.products} />
      <FieldOnPage value={formData.products[1] || ''} position={{ ...layout.products, top: layout.products.top + 8 }} />
      <FieldOnPage value={formData.products[2] || ''} position={{ ...layout.products, top: layout.products.top + 16 }} />

      {/* Коды */}
      <FieldOnPage value={formData.code_num} position={layout.codeNUM} />
      <FieldOnPage value={formData.code_nm} position={layout.codeNM} />

      {/* Нормативные документы */}
      <FieldOnPage value={formData.norm_documents_1} position={layout.normDocs} />
      <FieldOnPage value={formData.norm_documents_2} position={{ ...layout.normDocs, top: layout.normDocs.top + 8 }} />

      {/* Страна */}
      <FieldOnPage value={formData.country} position={layout.country} />

      {/* Кому выдан */}
      <FieldOnPage value={formData.issued_to_org} position={layout.issuedToOrg} />
      <FieldOnPage value={formData.issued_to_address} position={layout.issuedToAddress} />

      {/* На основании */}
      <FieldOnPage value={formData.basis_documents[0] || ''} position={layout.basis} />
      <FieldOnPage value={formData.basis_documents[1] || ''} position={{ ...layout.basis, top: layout.basis.top + 11 }} />

      {/* Дополнительная информация */}
      <FieldOnPage value={formData.additional_info} position={layout.additionalInfo} />

      {/* ФИО */}
      <FieldOnPage value={formData.head_name} position={layout.headName} />
      <FieldOnPage value={formData.dept_head_name} position={layout.deptHeadName} />
    </div>
  );
}
