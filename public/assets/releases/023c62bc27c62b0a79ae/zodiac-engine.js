/** Conventional month/day lookup. This is not a solar ephemeris or birth chart. */
const MONTH_LENGTHS = Object.freeze([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
const dayIndex = (month, day) => MONTH_LENGTHS.slice(0, month - 1).reduce((sum, count) => sum + count, 0) + day - 1;

export function findSign(month, day, signs) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > MONTH_LENGTHS[month - 1]) {
    throw new Error('Pasirinkite galiojančią mėnesio dieną. Vasario 29-oji galima keliamaisiais metais.');
  }
  if (!Array.isArray(signs) || signs.length !== 12) throw new Error('Nepavyko įkelti ženklų lentelės.');
  const position = dayIndex(month, day);
  const ordered = signs.map(sign => ({ sign, position: dayIndex(...sign.start) })).sort((a, b) => a.position - b.position);
  const conventional = [...ordered].reverse().find(row => row.position <= position)?.sign || ordered.at(-1).sign;
  const boundary = ordered.find(row => Math.min((position - row.position + 366) % 366, (row.position - position + 366) % 366) <= 2);
  let alternatives = [];
  if (boundary) {
    const index = signs.findIndex(sign => sign.key === boundary.sign.key);
    alternatives = [signs[(index + 11) % 12], signs[index]];
  }
  return { sign: conventional, nearBoundary: !!boundary, alternatives };
}

export function filterSigns(signs, element = 'all') {
  if (!['all', 'fire', 'earth', 'air', 'water'].includes(element)) throw new Error('Nežinoma stichija.');
  return signs.filter(sign => element === 'all' || sign.element_key === element);
}

export function comparison(signs, firstKey, secondKey) {
  const first = signs.find(sign => sign.key === firstKey);
  const second = signs.find(sign => sign.key === secondKey);
  if (!first || !second) throw new Error('Pasirinkite du ženklus iš sąrašo.');
  return { first, second, sameElement: first.element_key === second.element_key, sameSign: first.key === second.key };
}

export function wheelIndex(index, key) {
  if (!Number.isInteger(index) || index < 0 || index > 11) throw new Error('Nežinomas ženklo numeris.');
  if (key === 'Home') return 0;
  if (key === 'End') return 11;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % 12;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index + 11) % 12;
  return null;
}
