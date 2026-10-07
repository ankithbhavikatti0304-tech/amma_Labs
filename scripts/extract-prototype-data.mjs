// Pulls the catalogue out of prototype/index.html (the T array, CATS, REF, mascot maps)
// and writes prisma/data/catalogue.json. Run once; the JSON is committed and the seed reads it.
// All prices in the prototype are placeholders copied from a competitor.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const lines = readFileSync(new URL('../prototype/index.html', import.meta.url), 'utf8').split('\n');
const slice = (from, to) => lines.slice(from - 1, to).join('\n');

// Line ranges in the prototype's <script>: data (CATS..REF), PPL (people), AV/CAV/CT (mascots).
const src = [slice(638, 756), slice(795, 806), slice(856, 863)].join('\n');
const out = vm.runInNewContext(`(()=>{ ${src}\n return { CATS, G, GN, T, REF, PPL, AV, CAV, CT }; })()`, {});

const { CATS, G, GN, T, REF, PPL, AV, CAV, CT } = out;
const people = Object.keys(PPL);

const tint = (t) => (PPL[t.id] ? (t.cats.includes('women') ? 'a' : 'b') : CT[t.cats[0]] || 'a');
const mascotOf = (t) => {
  if (PPL[t.id]) return { mascot: 'person', mascotArg: t.id };
  const [m, arg] = AV[t.id] || ['drop'];
  return { mascot: m, mascotArg: arg === undefined ? null : String(arg) };
};

const tests = T.map((t) => {
  const [min, max] = String(t.tat).split('–').map(Number);
  return {
    id: t.id,
    name: t.name,
    categories: t.cats,
    isPackage: !!t.pkg,
    parameterCount: t.n ?? null,
    tatMinHours: min,
    tatMaxHours: max ?? min,
    price: t.price,
    mrp: t.mrp,
    fasting: !!t.fast,
    morningSample: !!t.morning,
    centreVisit: !!t.visit,
    qualitative: !!t.q,
    popular: !!t.best,
    includes: t.inc || [],
    // entries are either a group key in `groups` or a parameter name
    parameters: t.p || [],
    tint: tint(t),
    ...mascotOf(t),
  };
});

const categories = CATS.map((c, i) => {
  const [m, arg] = CAV[c.id] || ['drop'];
  return {
    id: c.id,
    name: c.name,
    icon: c.ic,
    tint: CT[c.id] || 'a',
    mascot: m === 'p' ? 'person' : m,
    mascotArg: arg === undefined ? null : String(arg),
    sort: i,
  };
});

const groups = Object.fromEntries(Object.entries(G).map(([k, names]) => [k, { name: GN[k], parameters: names }]));
const reference = Object.fromEntries(
  Object.entries(REF).map(([name, [low, high, unit, decimals]]) => [name, { low, high, unit, decimals }]),
);

writeFileSync(
  new URL('../prisma/data/catalogue.json', import.meta.url),
  JSON.stringify({ categories, groups, reference, tests, people }, null, 2) + '\n',
);
console.log(`categories=${categories.length} tests=${tests.length} groups=${Object.keys(groups).length} parameters=${Object.keys(reference).length}`);
