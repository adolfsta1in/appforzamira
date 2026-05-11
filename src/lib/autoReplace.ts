import { supabase } from './supabase';

const SYSTEM_TEMPLATE_NAME = '__system_auto_replacements__';

export let AUTO_REPLACEMENTS: Record<string, string> = {
  'ИП': 'Индивидуальный предприниматель',
  'КР': 'Кыргызстан',
  'РТ': 'Республика Таджикистан',
  'РФ': 'Российская Федерация',
  'ООО': 'Общество с ограниченной ответственностью',
  'ЗАО': 'Закрытое акционерное общество',
  'ОАО': 'Открытое акционерное общество',
};

export async function initAutoReplacements() {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('data')
      .eq('name', SYSTEM_TEMPLATE_NAME)
      .limit(1)
      .maybeSingle();

    if (!error && data?.data) {
      AUTO_REPLACEMENTS = data.data as Record<string, string>;
    }
  } catch (err) {
    console.error('Failed to init auto replacements:', err);
  }
}

export async function saveAutoReplacements(newRules: Record<string, string>) {
  AUTO_REPLACEMENTS = newRules;
  try {
    const { data: existing } = await supabase
      .from('templates')
      .select('id')
      .eq('name', SYSTEM_TEMPLATE_NAME)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from('templates').update({ data: newRules }).eq('id', existing.id);
    } else {
      await supabase.from('templates').insert({ name: SYSTEM_TEMPLATE_NAME, data: newRules });
    }
  } catch (err) {
    console.error('Failed to save auto replacements:', err);
  }
}

export function applyAutoReplace(text: string): string {
  if (!text) return text;
  
  let newText = text;
  
  Object.entries(AUTO_REPLACEMENTS).forEach(([short, long]) => {
    // Используем регулярное выражение для поиска точного слова.
    // Ограничители: начало/конец строки, пробелы, кавычки или знаки препинания.
    // Флаг 'g' для замены всех вхождений.
    const regex = new RegExp(`(?<=^|\\s|["'.,!?;:\\-])(${short})(?=\\s|["'.,!?;:\\-]|$)`, 'g');
    newText = newText.replace(regex, long);
  });
  
  return newText;
}
