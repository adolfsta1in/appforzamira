import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const SYSTEM_PROMPT = `Ты — система извлечения данных из сертификатов соответствия Тоҷикстандарт (Таджикистан).

Тебе дают текст из PDF сертификата "Сертификати мутобиқат / Сертификат соответствия". Документ двуязычный: таджикский + русский.

Твоя задача — извлечь данные и вернуть JSON с полями C, F, G, H, M, N, O, P. Остальные поля не извлекай.

## Структура полей:

**C** — Номер сертификата. Это 6-значное число после "СИЛСИЛАИ ТЈТ №" или "№". Примеры: "222821", "212688", "235847".

**F** — Дата выдачи (начало действия). Ищи после "Эътибор дорад аз" или "Срок действия с".
Формат в PDF может быть: "30 январи 2026с." или "17 августи 2025с."
Конвертируй в формат ДД.ММ.ГГ: "30.01.26", "17.08.25"
Месяцы на таджикском: январи=01, феврали=02, марти=03, апрели=04, майи=05, июни=06, июли=07, августи=08, сентябри=09, октябри=10, ноябри=11, декабри=12.

**G** — Срок действия до. Ищи после "то" или "до" (вторая дата в диапазоне). Тот же формат ДД.ММ.ГГ.

**H** — Кому выдан сертификат (наименование предприятия/организации и их адрес). Ищи после "Сертификат дода шуд" / "Сертификат выдан".
Пример: "Сехи қанноди «АСИЯ» шаҳри Душанбе, ноҳияи Сино 2"
Пример: "ЧДММ «Далери Хуҷанд» в. Суғд, ш. Хуҷанд"

**M** — Наименование продукции/товаров. Ищи после "Маҳсулот" / "Продукция".
Пример: "Маҳсулоти қанноди: торт ва рулети бисквитӣ"
Пример: "Молҳои ниёзи мардум мувофиқи замимаи №144214"

**N** — Количество. Ищи "ба миқдори" или числа с единицами (кг, дона, чой).
Пример: "1000кг", "5000кг", "16261 чой (708540кг)"

**O** — На основании какого документа выдан. Ищи после "Дар асоси" / "На основании".
Пример: "Маркази ташхиси Тоҷикстандарт №762.37100.02.009-2021 Протоколи ташхиси физикию-кимиёвӣ №ТЈ26.01.28-А аз 30.01.26с"

**P** — Страна происхождения. Ищи после "Истеҳсол шудааст" / "Изготовлено".
Если "Ҷумҳурии Тоҷикистон" → пиши "Тоҷикистон"
Если "Эрон" → "Эрон", "Хитой" → "Хитой", и т.д.

## Правила:
1. Возвращай ТОЛЬКО валидный JSON, без markdown, без комментариев
2. Если поле не найдено, ставь пустую строку ""
3. Даты ВСЕГДА в формате ДД.ММ.ГГ (двузначный год)
4. Не добавляй поля которых нет в списке выше
5. Текст может содержать артефакты из PDF-парсинга — игнорируй мусор

## Пример ответа:
{"C":"222821","F":"30.01.26","G":"30.05.26","H":"Сехи қанноди «АСИЯ» шаҳри Душанбе, ноҳияи Сино 2","M":"Маҳсулоти қанноди: торт ва рулети бисквитӣ","N":"1000кг","O":"Маркази ташхиси Тоҷикстандарт №762.37100.02.009-2021 Протоколи ташхиси физикию-кимиёвӣ №ТЈ26.01.28-А аз 30.01.26с","P":"Тоҷикистон"}`;

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
      max_tokens: 1000,
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

    // Build full data object with all columns A-V
    const data = {
      A: '', B: '', C: parsed.C || '', D: '', E: '',
      F: parsed.F || '', G: parsed.G || '', H: parsed.H || '',
      I: '', J: '', K: '', L: '1',
      M: parsed.M || '', N: parsed.N || '', O: parsed.O || '',
      P: parsed.P || '', Q: '', R: '', S: '', T: '', U: '', V: '',
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
