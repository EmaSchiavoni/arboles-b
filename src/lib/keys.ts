// Parseo del campo de claves del playground automático: acepta un único
// entero o una lista con separador autodetectado (",", ".", "-" o " ").
// Todos los separadores deben ser iguales (solo puede variar la cantidad de
// espacios alrededor, que se ignoran con trim). Si hay separadores distintos
// o texto inválido, el input no es válido.

export type KeyListError = 'empty' | 'invalid';

export type KeyListResult = { ok: true; keys: number[] } | { ok: false; reason: KeyListError };

const TOKEN_RE = /[+-]?\d+/g;
const SEPARATORS = new Set([',', '.', '-']);

export function parseKeyList(input: string): KeyListResult {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };

  const tokens: { value: number; raw: string; start: number; end: number }[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    tokens.push({ value: Number(m[0]), raw: m[0], start: m.index, end: m.index + m[0].length });
  }
  if (tokens.length === 0) return { ok: false, reason: 'invalid' };

  // Sin basura antes del primer token ni después del último.
  if (tokens[0].start !== 0 || tokens[tokens.length - 1].end !== text.length) {
    return { ok: false, reason: 'invalid' };
  }

  // Los huecos entre tokens deben ser un único separador (o solo espacios,
  // al menos uno: tokens pegados sin nada en medio no es válido). Un "-" que
  // quedó pegado al token siguiente ("1-2-3") se reinterpreta como separador.
  const values = tokens.map((t) => t.value);
  let sep: string | null = null;
  for (let i = 1; i < tokens.length; i += 1) {
    const rawGap = text.slice(tokens[i - 1].end, tokens[i].start);
    let gap: string;
    if (rawGap === '' && tokens[i].raw.startsWith('-')) {
      gap = '-';
      values[i] = -values[i];
    } else {
      if (rawGap === '') return { ok: false, reason: 'invalid' };
      gap = rawGap.replace(/\s+/g, '');
    }
    if (gap.length > 1 || (gap.length === 1 && !SEPARATORS.has(gap))) {
      return { ok: false, reason: 'invalid' };
    }
    if (sep === null) sep = gap;
    else if (sep !== gap) return { ok: false, reason: 'invalid' };
  }

  const keys = values;
  if (!keys.every((k) => Number.isInteger(k))) return { ok: false, reason: 'invalid' };
  return { ok: true, keys };
}
