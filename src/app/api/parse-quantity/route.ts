import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Ты — парсер количеств из описаний продукции (таджикский + русский).

Задача: получить массив строк описания продукции и извлечь общее количество.

Правила:
- Если у нескольких продуктов одинаковая единица измерения — сложи их численно.
- Если разные единицы — верни суммарное по основной (большей по весу/объёму) единице.
- Примеры слов для количества: "ба миқдори", "количество", "миқдор", "объёмом".
- Примеры единиц: "кг", "дона", "л", "шт", "м", "т".
- Формат величин в тексте: "1000кг", "200 дона", "50 л".

Верни ТОЛЬКО JSON (без markdown, без пояснений):
{"quantity": "число как строка, напр. '1500'", "unit": "единица, напр. 'кг'"}

Если ничего не найдено — верни {"quantity": "", "unit": ""}.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      return NextResponse.json({ quantity: '', unit: '' });
    }

    const body = await request.json();
    const products: string[] = Array.isArray(body.products) ? body.products.filter(Boolean) : [];

    if (products.length === 0) {
      return NextResponse.json({ quantity: '', unit: '' });
    }

    const client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey,
    });

    const userContent = products.map((p, i) => `${i + 1}. ${p}`).join('\n');

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Извлеки общее количество:\n${userContent}` },
      ],
      temperature: 0,
      max_tokens: 100,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';

    let parsed: { quantity?: string; unit?: string };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      return NextResponse.json({ quantity: '', unit: '' });
    }

    return NextResponse.json({
      quantity: String(parsed.quantity ?? '').trim(),
      unit: String(parsed.unit ?? '').trim(),
    });
  } catch {
    return NextResponse.json({ quantity: '', unit: '' });
  }
}
