import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const SYSTEM_PROMPT = `Ты — парсер сертификатов соответствия Тоҷикстандарт.

ВАЖНО: в этом PDF НЕТ подписей полей (нет слов "Продукция", "Сертификат выдан", "На основании" и т.д.). Данные идут в строгом порядке сверху вниз:

1. НОМЕР СЕРТИФИКАТА — 6-значное число (напр. 238279, 222821, 162091). Обычно находится вверху.
2. ДАТА НАЧАЛА ДЕЙСТВИЯ — три значения: число (напр. 30), месяц на таджикском (январи, феврали, марти, апрели, майи, июни, июли, августи, сентябри, октябри, ноябри, декабри), год (2 или 4 цифры).
3. ДАТА ОКОНЧАНИЯ — аналогичный формат, идёт правее или после даты начала.
4. ОРГАН ПО СЕРТИФИКАЦИИ — название организации, адрес, регистрационный номер. Обычно это "Агентии Тоҷикстандарт" или подобное.
5. ПРОДУКЦИЯ — название товара/продукции. Например "Маҳсулоти қанноди: торт ва рулети бисквитӣ".
6. КОЛИЧЕСТВО — может быть частью текста продукции ("ба миқдори 1000кг") или отдельным значением.
7. КОДЫ — могут быть числовые коды справа от продукции (коды НУМ/ОКП и НМ ФИХ/ТН ВЭД). Могут отсутствовать.
8. НОРМАТИВНЫЕ ДОКУМЕНТЫ — ссылки на стандарты и регламенты. Содержат характерные паттерны: "ГОСТ", "СБД", "ТУ", "ТР ТҶ".
9. СТРАНА ИЗГОТОВЛЕНИЯ — короткий текст: "Ҷумҳурии Тоҷикистон", "Эрон", "Хитой" и т.д.
10. КОМУ ВЫДАН — название организации + адрес. Примеры: "Сехи каннодии «АСИЯ» шаҳри Душанбе, ноҳияи Сино 2".
11. ОСНОВАНИЕ ВЫДАЧИ — протоколы испытаний, номера лабораторий, даты. Содержит характерные паттерны: "Протокол", "№", "аз", даты.
12. ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ — может быть пустым или содержать дополнительный текст.
13. ФИО РУКОВОДИТЕЛЯ — фамилия и инициалы, обычно ЗАГЛАВНЫМИ (напр. "РАХМОН И.Х.")
14. ФИО НАЧАЛЬНИКА ОТДЕЛА — фамилия и инициалы (напр. "ВАХОБЗОДА О.Ф.", "ИСОЕВ О.")

Верни ТОЛЬКО JSON (без markdown, без backticks, без пояснений):
{
  "cert_number": "номер сертификата (6 цифр)",
  "issue_date": "дата начала в формате ДД.ММ.ГГ (конвертируй месяц: январи→01, феврали→02, марти→03, апрели→04, майи→05, июни→06, июли→07, августи→08, сентябри→09, октябри→10, ноябри→11, декабри→12)",
  "expiry_date": "дата окончания в формате ДД.ММ.ГГ",
  "cert_body_name": "название органа по сертификации",
  "cert_body_address": "адрес органа",
  "cert_body_number": "регистрационный номер органа",
  "products": "наименование продукции (БЕЗ количества)",
  "quantity_value": "число количества БЕЗ единицы (напр. '1000', '200')",
  "quantity_unit": "единица измерения (напр. 'кг', 'дона', 'л', 'шт')",
  "code_num": "код НУМ/ОКП или пустая строка",
  "code_nm": "код НМ ФИХ/ТН ВЭД или пустая строка",
  "norm_documents": "нормативные документы (все стандарты)",
  "country": "страна. 'Ҷумҳурии Тоҷикистон'→'Тоҷикистон', остальные как есть",
  "issued_to_org": "название организации которой выдан",
  "issued_to_address": "адрес организации",
  "basis_document": "основание выдачи (протоколы, номера, даты — весь текст)",
  "additional_info": "дополнительная информация или пустая строка",
  "head_name": "ФИО руководителя",
  "dept_head_name": "ФИО начальника отдела",
  "issue_day": "день начала (число)",
  "issue_month_name": "месяц начала на таджикском (напр. 'январи')",
  "issue_year": "год начала (2 цифры)",
  "expiry_day": "день окончания (число)",
  "expiry_month_name": "месяц окончания на таджикском",
  "expiry_year": "год окончания (2 цифры)"
}

Текст может быть кривым — склеенные слова, пропущенные пробелы, переносы строк в неожиданных местах. Разбирайся по контексту.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      return NextResponse.json(
        { error: 'Укажите DEEPSEEK_API_KEY в файле .env.local' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Загрузите PDF файл' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    // Call Deepseek API
    const client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey,
    });

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Извлеки данные из этого сертификата:\n\n${text}` },
      ],
      temperature: 0,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';

    // Parse JSON from response (handle possible markdown wrapping)
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      console.error('Failed to parse Deepseek response:', responseText);
      return NextResponse.json(
        { error: 'Ошибка при разборе ответа от Deepseek' },
        { status: 500 }
      );
    }

    // If model returned legacy "quantity" (e.g. "1000кг"), split it
    let qValue = String(parsed.quantity_value ?? '').trim();
    let qUnit = String(parsed.quantity_unit ?? '').trim();
    if (!qValue && !qUnit && parsed.quantity) {
      const m = String(parsed.quantity).trim().match(/^([\d.,]+)\s*(.*)$/);
      if (m) {
        qValue = m[1];
        qUnit = m[2].trim();
      }
    }

    // Build form data from parsed response
    const data = {
      cert_number: parsed.cert_number || '',
      cert_number_on_blank: parsed.cert_number || '',
      date_start_day: parsed.issue_day || '',
      date_start_month: parsed.issue_month_name || '',
      date_start_year: parsed.issue_year || '',
      date_end_day: parsed.expiry_day || '',
      date_end_month: parsed.expiry_month_name || '',
      date_end_year: parsed.expiry_year || '',
      cert_body_name: parsed.cert_body_name || '',
      cert_body_address: parsed.cert_body_address || '',
      cert_body_number: parsed.cert_body_number || '',
      products: [parsed.products || '', '', ''],
      quantity: qValue,
      quantity_unit: qUnit,
      code_num: parsed.code_num || '',
      code_nm: parsed.code_nm || '',
      norm_documents_1: parsed.norm_documents || '',
      norm_documents_2: '',
      country: parsed.country || '',
      issued_to_org: parsed.issued_to_org || '',
      issued_to_address: parsed.issued_to_address || '',
      basis_documents: [parsed.basis_document || '', ''],
      additional_info: [parsed.additional_info || ''],
      head_name: parsed.head_name || '',
      dept_head_name: parsed.dept_head_name || '',
      // Registry fields — not parsed from PDF
      serial_number: '',
      copy_number: '',
      cert_processing: '1',
      total_cost: '',
      amount_due: '',
      tests: '',
      invoice_number: '',
      invoice_date: '',
      inn: '',
    };

    return NextResponse.json({ data, rawText: text });
  } catch (error) {
    console.error('Parse error:', error);
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return NextResponse.json(
      { error: `Ошибка: ${message}` },
      { status: 500 }
    );
  }
}
