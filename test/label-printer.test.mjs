import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLabels } from '../public/js/core/label-printer.mjs';

const input = (itemsRaw = 'X', copiesRaw = '1', presetId = 'a4-2x7') => ({ itemsRaw, copiesRaw, presetId });
const repeat = (value, count) => Array(count).fill(value);
const a4 = ['A4', 2, 7, 14];
const a4dense = ['A4', 3, 8, 24];
const letter = ['Letter', 2, 7, 14];
const letterDense = ['Letter', 3, 8, 24];
// The expected pages below are independently specified, never calculated by the implementation.
function expected(presetId, geometry, itemCount, copiesPerItem, totalLabels, slots) {
  const [paperSize, columns, rows, capacity] = geometry;
  return { ok: true, result: {
    presetId, paperSize, columns, rows, capacity, itemCount, copiesPerItem, totalLabels,
    pageCount: slots.length, pages: slots.map((values, pageIndex) => ({ pageIndex, slots: values })),
  } };
}
function rejects(request, code, field) {
  const outcome = calculateLabels(request);
  assert.deepEqual(outcome, { ok: false, error: { code, field } });
  assert.equal(JSON.stringify(outcome).includes('FAKE_PRIVATE_CANARY'), false);
}
const n14 = ['N01','N02','N03','N04','N05','N06','N07','N08','N09','N10','N11','N12','N13','N14'];
const n24 = [...n14,'N15','N16','N17','N18','N19','N20','N21','N22','N23','N24'];

test('C01: one trimmed label and thirteen blank cells', () => {
  assert.deepEqual(calculateLabels(input('箱子')), expected('a4-2x7', a4, 1, 1, 1, [['箱子', ...repeat(null, 13)]]));
});
test('C02: CRLF/CR/LF, blanks and duplicate input rows stay ordered', () => {
  assert.deepEqual(calculateLabels(input(' A \r\nA\r B \n \t \n', '2', 'letter-3x8')),
    expected('letter-3x8', letterDense, 3, 2, 6, [['A','A','A','A','B','B', ...repeat(null, 18)]]));
});
test('C03: copies are contiguous for each source row', () => {
  assert.deepEqual(calculateLabels(input('X\nY', '3', 'a4-3x8')),
    expected('a4-3x8', a4dense, 2, 3, 6, [['X','X','X','Y','Y','Y', ...repeat(null, 18)]]));
});
test('C04: exactly fourteen fills one page', () => {
  assert.deepEqual(calculateLabels(input(n14.join('\n'))), expected('a4-2x7', a4, 14, 1, 14, [n14]));
});
test('C05: fifteenth name starts page two with thirteen null cells', () => {
  assert.deepEqual(calculateLabels(input([...n14,'N15'].join('\n'))),
    expected('a4-2x7', a4, 15, 1, 15, [n14, ['N15', ...repeat(null, 13)]]));
});
test('C06: Letter dense page boundary at twenty-four', () => {
  assert.deepEqual(calculateLabels(input([...n24,'N25'].join('\n'), '1', 'letter-3x8')),
    expected('letter-3x8', letterDense, 25, 1, 25, [n24, ['N25', ...repeat(null, 23)]]));
});
test('C07: all 300 labels match twenty-two hand-counted pages', () => {
  const pages = [
    repeat('A',14), [...repeat('A',6),...repeat('B',8)],
    [...repeat('B',12),...repeat('C',2)], repeat('C',14),
    [...repeat('C',4),...repeat('D',10)], [...repeat('D',10),...repeat('E',4)],
    repeat('E',14), [...repeat('E',2),...repeat('F',12)],
    [...repeat('F',8),...repeat('G',6)], repeat('G',14),
    repeat('H',14), [...repeat('H',6),...repeat('I',8)],
    [...repeat('I',12),...repeat('J',2)], repeat('J',14),
    [...repeat('J',4),...repeat('K',10)], [...repeat('K',10),...repeat('L',4)],
    repeat('L',14), [...repeat('L',2),...repeat('M',12)],
    [...repeat('M',8),...repeat('N',6)], repeat('N',14),
    repeat('O',14), [...repeat('O',6),...repeat(null,8)],
  ];
  assert.deepEqual(calculateLabels(input('A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL\nM\nN\nO', '20')),
    expected('a4-2x7', a4, 15, 20, 300, pages));
});
test('C08: 301 labels reject the entire job', () => {
  rejects(input(Array.from({ length: 301 }, (_, i) => `N${String(i + 1).padStart(3, '0')}`).join('\n'), '1', 'letter-2x7'), 'too_many_labels', 'totalLabels');
});
test('C09: copy endpoints 1 and 20 have exact complete results', () => {
  assert.deepEqual(calculateLabels(input('Z','20')), expected('a4-2x7', a4, 1, 20, 20,
    [repeat('Z',14), [...repeat('Z',6),...repeat(null,8)]]));
  assert.deepEqual(calculateLabels(input('Z')), expected('a4-2x7', a4, 1, 1, 1, [['Z', ...repeat(null,13)]]));
});
for (const value of ['0','21','99']) test(`C10 range: ${value}`, () => rejects(input('X', value), 'copies_out_of_range', 'copiesRaw'));
for (const value of ['', '01', '00', '1.0', '+1', '-1', ' 1 ', '1 ', '1\n', '1e0', '１', '١', '1,0', '100', '000', '\t1']) {
  test(`C10 format: ${JSON.stringify(value)}`, () => rejects(input('X', value), 'invalid_copies_format', 'copiesRaw'));
}
const byteLimit = repeat('x'.repeat(80),126).join('\n') + '\n'.repeat(35);
test('C11: exactly 10240 raw UTF-8 bytes before normalization', () => {
  assert.equal(Buffer.byteLength(byteLimit), 10240);
  assert.deepEqual(calculateLabels(input(byteLimit)), expected('a4-2x7', a4, 126, 1, 126,
    [repeat('x'.repeat(80),14),repeat('x'.repeat(80),14),repeat('x'.repeat(80),14),
      repeat('x'.repeat(80),14),repeat('x'.repeat(80),14),repeat('x'.repeat(80),14),
      repeat('x'.repeat(80),14),repeat('x'.repeat(80),14),repeat('x'.repeat(80),14)]));
});
test('C12: 10241 raw bytes rejected even when trailing blanks are discarded', () => {
  rejects(input(byteLimit + '\n'), 'items_too_large', 'itemsRaw');
});
test('C13: 80 supplementary code points, 160 UTF-16 units', () => {
  assert.deepEqual(calculateLabels(input('😀'.repeat(80))), expected('a4-2x7', a4, 1, 1, 1, [['😀'.repeat(80), ...repeat(null,13)]]));
});
test('C14: 81 ASCII code points rejected', () => rejects(input('x'.repeat(81)), 'item_too_long', 'itemsRaw.lines[0]'));
for (const point of [0x00,0x01,0x09,0x0b,0x0c,0x1f,0x7f,0x85,0x9f,0x2028,0x2029]) {
  test(`C15 control U+${point.toString(16)}`, () => rejects(input(`貨${String.fromCodePoint(point)}物`), 'item_control_character', 'itemsRaw.lines[0]'));
}
for (const value of ['\ud800','\udfff','X\ud800Y','\ud800\ud800','\udc00\ud800','😀\udfff']) {
  test(`C16 isolated surrogate ${JSON.stringify(value)}`, () => rejects(input(value), 'invalid_unicode', 'itemsRaw'));
}
test('C17: empty trimmed list cannot create printable pages', () => rejects(input(' \t\r\n'), 'no_items', 'itemsRaw'));
test('C18: unsupported preset', () => rejects(input('箱','1','legal-4x4'), 'invalid_preset', 'presetId'));
test('C19: unknown own data does not echo or traverse', () => rejects({ ...input(), debug: 'FAKE_PRIVATE_CANARY' }, 'invalid_schema', 'request'));
test('C20: accessor is rejected without invoking its getter', () => {
  let calls = 0;
  const request = input();
  Object.defineProperty(request, 'itemsRaw', { enumerable: true, get() { calls += 1; return 'FAKE_PRIVATE_CANARY'; } });
  rejects(request, 'invalid_schema', 'request');
  assert.equal(calls, 0);
});
test('C21: exact output, JSON roundtrip and frozen request remain unchanged', () => {
  const request = Object.freeze(input('箱'));
  const before = Object.getOwnPropertyDescriptors(request);
  const outcome = calculateLabels(request);
  assert.deepEqual(outcome, expected('a4-2x7', a4, 1, 1, 1, [['箱', ...repeat(null,13)]]));
  assert.deepEqual(JSON.parse(JSON.stringify(outcome)), outcome);
  assert.deepEqual(Object.getOwnPropertyDescriptors(request), before);
});
test('C22: markup stays literal text in successful slots', () => {
  const markup = '<img src=x onerror=alert(1)>';
  assert.deepEqual(calculateLabels(input(markup)), expected('a4-2x7', a4, 1, 1, 1, [[markup, ...repeat(null,13)]]));
});
for (const [id, geometry] of [['a4-2x7',a4],['a4-3x8',a4dense],['letter-2x7',letter],['letter-3x8',letterDense]]) {
  test(`C23 exact preset ${id}`, () => {
    assert.deepEqual(calculateLabels(input('X','1',id)), expected(id, geometry, 1, 1, 1, [['X', ...repeat(null,geometry[3]-1)]]));
  });
}

for (const value of [null, undefined, [], Array(3), new Date(0), new String('X'), 3, 'X', true, Object.create({ inherited: true })]) {
  test(`schema root ${Object.prototype.toString.call(value)}`, () => rejects(value, 'invalid_schema', 'request'));
}
for (const variant of ['symbol', 'nonenumerable-extra', 'nonenumerable-field', 'missing', 'setter', 'inherited-field']) {
  test(`schema descriptor ${variant}`, () => {
    let request = input();
    if (variant === 'symbol') request[Symbol('extra')] = 'FAKE_PRIVATE_CANARY';
    if (variant === 'nonenumerable-extra') Object.defineProperty(request, 'extra', { value: 'FAKE_PRIVATE_CANARY' });
    if (variant === 'nonenumerable-field') Object.defineProperty(request, 'copiesRaw', { enumerable: false });
    if (variant === 'missing') delete request.presetId;
    if (variant === 'setter') Object.defineProperty(request, 'copiesRaw', { set() { throw new Error('must not call'); } });
    if (variant === 'inherited-field') { delete request.itemsRaw; request = Object.assign(Object.create({ itemsRaw: 'X' }), request); }
    rejects(request, 'invalid_schema', 'request');
  });
}
for (const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor']) {
  test(`reflection exception ${trap} is a fixed schema error`, () => {
    const request = new Proxy(input(), { [trap]() { throw new Error('FAKE_PRIVATE_CANARY'); } });
    rejects(request, 'invalid_schema', 'request');
  });
}
test('revoked proxy fails closed', () => {
  const { proxy, revoke } = Proxy.revocable(input(), {});
  revoke();
  rejects(proxy, 'invalid_schema', 'request');
});
test('null-prototype plain own-data record is accepted', () => {
  assert.deepEqual(calculateLabels(Object.assign(Object.create(null), input())), expected('a4-2x7', a4, 1, 1, 1, [['X', ...repeat(null,13)]]));
});
test('schema inspection never reads value properties through proxy get', () => {
  const request = new Proxy(input(), { get() { throw new Error('FAKE_PRIVATE_CANARY'); } });
  assert.equal(calculateLabels(request).ok, true);
});
for (const [field,value,code] of [['itemsRaw',null,'invalid_items_type'],['itemsRaw',42,'invalid_items_type'],
  ['copiesRaw',1,'invalid_copies_format'],['copiesRaw',null,'invalid_copies_format'],['presetId',null,'invalid_preset'],['presetId','toString','invalid_preset']]) {
  test(`field type/enum ${field} ${String(value)}`, () => rejects({ ...input(), [field]: value }, code, field));
}
test('no Unicode normalization and ECMAScript trim semantics', () => {
  assert.deepEqual(calculateLabels(input('\ufeffé\u00a0\n e\u0301 \n\t')),
    expected('a4-2x7', a4, 2, 1, 2, [['é','e\u0301',...repeat(null,12)]]));
});
test('raw normalized line index includes skipped blank rows', () => rejects(input('\r\n\t\r  X\n bad\u2029name'), 'item_control_character', 'itemsRaw.lines[3]'));
test('astral 81st codepoint rejects', () => rejects(input('😀'.repeat(81)), 'item_too_long', 'itemsRaw.lines[0]'));
test('UTF-8 bytes count multibyte data', () => rejects(input(('箱'.repeat(80)+'\n').repeat(43)), 'items_too_large', 'itemsRaw'));
test('CR bytes count before CRLF normalization', () => rejects(input('X' + '\r\n'.repeat(5120)), 'items_too_large', 'itemsRaw'));
test('exact validation order: schema before all fields', () => rejects({ ...input('\ud800','01','bad'), extra: 1 }, 'invalid_schema', 'request'));
test('exact validation order: type before copies', () => rejects(input(null,'01','bad'), 'invalid_items_type', 'itemsRaw'));
test('exact validation order: Unicode before bytes', () => rejects(input('x'.repeat(10241)+'\ud800','01','bad'), 'invalid_unicode', 'itemsRaw'));
test('exact validation order: bytes before copies', () => rejects(input('x'.repeat(10241),'01','bad'), 'items_too_large', 'itemsRaw'));
test('exact validation order: copies before preset and lines', () => rejects(input('x'.repeat(81),'01','bad'), 'invalid_copies_format', 'copiesRaw'));
test('exact validation order: range before preset', () => rejects(input('','0','bad'), 'copies_out_of_range', 'copiesRaw'));
test('exact validation order: preset before no items', () => rejects(input('','1','bad'), 'invalid_preset', 'presetId'));
test('exact validation order: first bad line and control before length', () => rejects(input('X\n'+'x'.repeat(81)+'\tY\n\u0000'), 'item_control_character', 'itemsRaw.lines[1]'));
test('exact validation order: long first line before later control', () => rejects(input('x'.repeat(81)+'\n\u0000'), 'item_too_long', 'itemsRaw.lines[0]'));
test('exact validation order: lines before total label count', () => rejects(input(repeat('X',300).join('\n')+'\nx\u0000','2'), 'item_control_character', 'itemsRaw.lines[300]'));
test('successful outputs are fresh, and cannot poison later calls', () => {
  const first = calculateLabels(input());
  first.result.pages[0].slots[0] = 'modified';
  first.result.capacity = -1;
  assert.deepEqual(calculateLabels(input()), expected('a4-2x7', a4, 1, 1, 1, [['X',...repeat(null,13)]]));
});
test('deterministic bounded matrix: all copy counts and four presets', () => {
  for (const presetId of ['a4-2x7','a4-3x8','letter-2x7','letter-3x8']) {
    for (let copies = 1; copies <= 20; copies += 1) {
      const request = Object.freeze(input('first\nfirst\nlast', String(copies), presetId));
      const outcome = calculateLabels(request);
      assert.equal(outcome.ok, true);
      const r = outcome.result;
      assert.equal(r.totalLabels, 3*copies);
      assert.equal(r.pages.length, r.pageCount);
      const filled = r.pages.flatMap((page) => {
        assert.equal(page.slots.length, r.capacity);
        return page.slots;
      }).filter((value) => value !== null);
      assert.deepEqual(filled, [...repeat('first',copies*2),...repeat('last',copies)]);
      assert.equal(JSON.stringify(outcome).includes('undefined'), false);
    }
  }
});
