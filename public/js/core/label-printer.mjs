const presets = Object.freeze({
  'a4-2x7': Object.freeze({ paperSize: 'A4', columns: 2, rows: 7, capacity: 14 }),
  'a4-3x8': Object.freeze({ paperSize: 'A4', columns: 3, rows: 8, capacity: 24 }),
  'letter-2x7': Object.freeze({ paperSize: 'Letter', columns: 2, rows: 7, capacity: 14 }),
  'letter-3x8': Object.freeze({ paperSize: 'Letter', columns: 3, rows: 8, capacity: 24 }),
});
const fields = ['itemsRaw', 'copiesRaw', 'presetId'];
const fail = (code, field) => ({ ok: false, error: { code, field } });

function readRequest(request) {
  try {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) return null;
    const prototype = Object.getPrototypeOf(request);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(request);
    if (keys.length !== 3 || keys.some((key) => !fields.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(request);
    if (fields.some((key) => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) return null;
    return fields.map((key) => descriptors[key].value);
  } catch {
    return null;
  }
}

function wellFormed(text) {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

/** A synchronous, deterministic calculation. Never mutates or echoes invalid requests. */
export function calculateLabels(request) {
  const values = readRequest(request);
  if (values === null) return fail('invalid_schema', 'request');
  const [itemsRaw, copiesRaw, presetId] = values;
  if (typeof itemsRaw !== 'string') return fail('invalid_items_type', 'itemsRaw');
  if (!wellFormed(itemsRaw)) return fail('invalid_unicode', 'itemsRaw');
  if (new TextEncoder().encode(itemsRaw).byteLength > 10240) return fail('items_too_large', 'itemsRaw');
  if (typeof copiesRaw !== 'string' || copiesRaw.length > 2 || !/^(?:0|[1-9][0-9]?)$/.test(copiesRaw)) {
    return fail('invalid_copies_format', 'copiesRaw');
  }
  const copiesPerItem = Number(copiesRaw);
  if (copiesPerItem < 1 || copiesPerItem > 20) return fail('copies_out_of_range', 'copiesRaw');
  if (typeof presetId !== 'string' || !Object.hasOwn(presets, presetId)) return fail('invalid_preset', 'presetId');

  const names = [];
  const lines = itemsRaw.replace(/\r\n?/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].trim();
    if (!name) continue;
    if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(name)) {
      return fail('item_control_character', `itemsRaw.lines[${index}]`);
    }
    if ([...name].length > 80) return fail('item_too_long', `itemsRaw.lines[${index}]`);
    names.push(name);
  }
  if (names.length === 0) return fail('no_items', 'itemsRaw');
  const totalLabels = names.length * copiesPerItem;
  if (totalLabels > 300) return fail('too_many_labels', 'totalLabels');
  const preset = presets[presetId];
  const pageCount = Math.ceil(totalLabels / preset.capacity);
  const pages = Array.from({ length: pageCount }, (_, pageIndex) => ({
    pageIndex, slots: Array(preset.capacity).fill(null),
  }));
  let position = 0;
  for (const name of names) {
    for (let copy = 0; copy < copiesPerItem; copy += 1) {
      pages[Math.floor(position / preset.capacity)].slots[position % preset.capacity] = name;
      position += 1;
    }
  }
  return {
    ok: true,
    result: { presetId, ...preset, itemCount: names.length, copiesPerItem, totalLabels, pageCount, pages },
  };
}
