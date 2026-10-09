// Parseo del campo de claves del playground automático: acepta un único
// valor o una lista con separador autodetectado (",", ".", "-" o " ").
// Todos los separadores deben ser iguales (solo puede variar la cantidad de
// espacios alrededor, que se ignoran con trim). Si hay separadores distintos
// o texto inválido, el input no es válido.
//
// El modo lo decide el árbol por adelantado: en modo numérico solo valen
// enteros (con signo opcional); en modo texto todo es cadena, incluso lo que
// son solo dígitos.

import type { Key } from './btree';

export type KeyListError = 'empty' | 'invalid';

export type KeyListResult = { ok: true; keys: Key[] } | { ok: false; reason: KeyListError };

export type KeyMode = 'number' | 'string';

const TOKEN_RE = /[+-]?\d+/g;
const SEPARATORS = new Set([',', '.', '-']);

// Enteros con un único separador entre ellos. Devuelve null si no aplica.
function parseIntegerList(text: string): number[] | null {
  const tokens: { value: number; raw: string; start: number; end: number }[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    tokens.push({ value: Number(m[0]), raw: m[0], start: m.index, end: m.index + m[0].length });
  }
  if (tokens.length === 0) return null;
  if (tokens[0].start !== 0 || tokens[tokens.length - 1].end !== text.length) return null;

  const values = tokens.map((t) => t.value);
  let sep: string | null = null;
  for (let i = 1; i < tokens.length; i += 1) {
    const rawGap = text.slice(tokens[i - 1].end, tokens[i].start);
    let gap: string;
    if (rawGap === '' && tokens[i].raw.startsWith('-')) {
      // Un "-" pegado al token ("1-2-3") es separador, no signo.
      gap = '-';
      values[i] = -values[i];
    } else {
      if (rawGap === '') return null;
      gap = rawGap.replace(/\s+/g, '');
    }
    if (gap.length > 1 || (gap.length === 1 && !SEPARATORS.has(gap))) return null;
    if (sep === null) sep = gap;
    else if (sep !== gap) return null;
  }
  if (!values.every((k) => Number.isInteger(k))) return null;
  return values;
}

// Un "-" al inicio o tras otro separador/espacio, seguido de dígito, es
// signo y no separador: se protege con un centinela ASCII antes de partir.
const MINUS_SENTINEL = '<MINUS/>';
const MINUS_SIGN_RE = /(?<=^|[\s,.\-])-(?=\d)/g;

// Partición por un único separador. Devuelve null si hay mezcla o vacíos.
function splitUniform(text: string): string[] | null {
  const masked = text.replace(MINUS_SIGN_RE, MINUS_SENTINEL);
  const present = new Set([...masked].filter((c) => SEPARATORS.has(c)));
  let parts: string[];
  if (present.size === 0) {
    parts = masked.split(/\s+/);
  } else if (present.size === 1) {
    const sep = [...present][0];
    parts = masked.split(sep).map((s) => s.trim());
    // Con separador explícito, los espacios internos serían otro separador.
    if (parts.some((s) => /\s/.test(s))) return null;
  } else {
    return null; // Separadores mezclados.
  }
  parts = parts.map((s) => s.split(MINUS_SENTINEL).join('-'));
  if (parts.some((s) => s.length === 0)) return null;
  return parts;
}

export function parseKeyList(input: string, mode: KeyMode = 'number'): KeyListResult {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (mode === 'number') {
    const ints = parseIntegerList(text);
    if (!ints) return { ok: false, reason: 'invalid' };
    return { ok: true, keys: ints };
  }
  const parts = splitUniform(text);
  if (!parts) return { ok: false, reason: 'invalid' };
  return { ok: true, keys: parts };
}
