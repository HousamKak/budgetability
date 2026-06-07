// Standalone verification of the Spreadsheet + Forecast calculations.
// Reproduces the EXACT aggregation logic from:
//   - src/components/spreadsheet/useSpreadsheetData.ts  (rows builder)
//   - src/utils/forecast.ts                              (forecast model)
// and runs hypothetical data through it to find discrepancies between what
// the sheet shows and the ground-truth totals.
//
// Run:  node scripts/verify-sheet-calcs.mjs

let failures = 0;
const ok = (label) => console.log(`  ✅ ${label}`);
const bad = (label, detail) => {
  failures++;
  console.log(`  ❌ ${label}\n       ${detail}`);
};
const approx = (a, b) => Math.abs(a - b) < 1e-9;

// ──────────────────────────────────────────────────────────────────────
// 1. SPREADSHEET ROW BUILDER  (faithful copy of useSpreadsheetData lines 122-179)
// ──────────────────────────────────────────────────────────────────────
function paymentColumnKey(name) {
  return `payment_${name.toLowerCase().replace(/\s+/g, "_")}`;
}

function buildRow(monthKey, cats, expensesByMonth, depositsByMonth) {
  const values = {};

  // Income — sum of deposit transactions for the month
  const monthDeposits = depositsByMonth.get(monthKey) ?? [];
  const incomeTotal = monthDeposits.reduce((s, tx) => s + tx.amount, 0);
  values.income_total = incomeTotal;

  // Payments — match by categoryId first, fall back to legacy text category
  const expenses = expensesByMonth[monthKey] ?? [];
  const matched = new Set();
  let paymentTotal = 0;
  for (const cat of cats) {
    const colKey = paymentColumnKey(cat.name);
    const catExpenses = expenses.filter((e) =>
      e.categoryId ? e.categoryId === cat.id : (e.category ?? "") === cat.name,
    );
    for (const e of catExpenses) matched.add(e);
    const sum = catExpenses.reduce((s, e) => s + e.amount, 0);
    values[colKey] = sum > 0 ? -sum : 0;
    paymentTotal += sum;
  }
  // Uncategorized catch-all (the fix)
  const orphan = expenses.filter((e) => !matched.has(e));
  const orphanSum = orphan.reduce((s, e) => s + e.amount, 0);
  values.payment_uncategorized = orphanSum > 0 ? -orphanSum : 0;
  paymentTotal += orphanSum;
  values.payment_total = paymentTotal > 0 ? -paymentTotal : 0;
  values.net = incomeTotal + values.payment_total;
  return values;
}

console.log("\n── SPREADSHEET: payments / net aggregation ──");
{
  const cats = [
    { id: "c1", name: "Food" },
    { id: "c2", name: "Rent" },
  ];
  const expensesByMonth = {
    "2026-01": [
      { amount: 100, categoryId: "c1" },                 // Food (by id)
      { amount: 50, category: "Rent" },                  // Rent (legacy text)
      { amount: 30, categoryId: "c_deleted" },           // ORPHAN: deleted category id
      { amount: 20, category: "Misc" },                  // ORPHAN: text not a category
      { amount: 10 },                                    // ORPHAN: no category at all
    ],
  };
  const depositsByMonth = new Map([
    ["2026-01", [{ amount: 500 }]],
  ]);

  const row = buildRow("2026-01", cats, expensesByMonth, depositsByMonth);

  const trueSpend = expensesByMonth["2026-01"].reduce((s, e) => s + e.amount, 0); // 210
  const sheetSpend = -row.payment_total;                                          // 150
  const trueNet = row.income_total - trueSpend;                                   // 290
  const sheetNet = row.net;                                                       // 350

  console.log(`     income=${row.income_total}  Food=${row.payment_food}  Rent=${row.payment_rent}`);
  console.log(`     TRUE total spend = ${trueSpend}   |  SHEET Total Payments = ${sheetSpend}`);
  console.log(`     TRUE net         = ${trueNet}   |  SHEET Net            = ${sheetNet}`);

  if (approx(sheetSpend, trueSpend)) ok("Total Payments equals sum of all expenses");
  else bad("Total Payments DROPS uncategorized/orphaned expenses",
    `hidden = ${trueSpend - sheetSpend} (30 deleted-cat + 20 unknown-text + 10 no-cat). Sheet shows ${sheetSpend}, reality is ${trueSpend}.`);

  if (approx(sheetNet, trueNet)) ok("Net matches income - real spend");
  else bad("Net is OVERSTATED (looks healthier than reality)",
    `sheet Net ${sheetNet} vs true ${trueNet}, off by +${sheetNet - trueNet}.`);
}

// ──────────────────────────────────────────────────────────────────────
// 1b. removeCategory DETACHES expenses (localStorage path)
// ──────────────────────────────────────────────────────────────────────
console.log("\n── DATA: removeCategory detaches its expenses ──");
{
  // Mirror the localStore path of removeCategory.
  function removeCategoryLocal(store, id) {
    const removedName = store.categories.find((c) => c.id === id)?.name;
    for (const mk of Object.keys(store.expenses)) {
      store.expenses[mk] = store.expenses[mk].map((e) => {
        if (e.categoryId === id) return { ...e, categoryId: undefined };
        if (!e.categoryId && removedName && e.category === removedName)
          return { ...e, category: undefined };
        return e;
      });
    }
    store.categories = store.categories.filter((c) => c.id !== id);
    return store;
  }
  const store = {
    categories: [{ id: "c1", name: "Food" }, { id: "c2", name: "Rent" }],
    expenses: {
      "2026-01": [
        { id: "e1", amount: 100, categoryId: "c1" },        // by id
        { id: "e2", amount: 50, category: "Rent" },         // legacy text
      ],
    },
  };
  removeCategoryLocal(store, "c1");
  const e1 = store.expenses["2026-01"].find((e) => e.id === "e1");
  const totalBefore = 150;
  // After delete, the sheet's orphan sweep should still count e1 (now blank).
  const row = buildRow("2026-01", store.categories, store.expenses, new Map());
  const sheetSpend = -row.payment_total;

  if (e1.categoryId === undefined) ok("Expense detached from deleted category (categoryId cleared)");
  else bad("Expense still references deleted category", JSON.stringify(e1));

  if (approx(sheetSpend, totalBefore))
    ok(`Total still reconciles after delete (${sheetSpend}); detached expense lands in Uncategorized (${-row.payment_uncategorized})`);
  else bad("Total drifted after category delete", `expected ${totalBefore}, got ${sheetSpend}`);
}

// ──────────────────────────────────────────────────────────────────────
// 2. DUPLICATE-KEY CATEGORY COLLISION
// ──────────────────────────────────────────────────────────────────────
console.log("\n── SPREADSHEET: category key collision ──");
{
  const cats = [
    { id: "a", name: "Food Items" },
    { id: "b", name: "Food items" }, // normalizes to the SAME column key
  ];
  const k1 = paymentColumnKey(cats[0].name);
  const k2 = paymentColumnKey(cats[1].name);
  if (k1 !== k2) ok("Distinct category names produce distinct column keys");
  else bad("Two categories collapse to one column key",
    `"${cats[0].name}" and "${cats[1].name}" both -> "${k1}". One column overwrites the other; only the column display is wrong (total still counts both).`);
}

// ──────────────────────────────────────────────────────────────────────
// 3. txMonthKey TIMEZONE DRIFT (deposits without explicit monthKey)
// ──────────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }
function txMonthKey(tx) {
  if (tx.monthKey) return tx.monthKey;
  const d = new Date(tx.createdAt);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
console.log("\n── SPREADSHEET: income month attribution ──");
{
  // A late-night-UTC deposit on the last day of the month.
  const tx = { amount: 100, createdAt: "2026-01-31T23:30:00Z" };
  const localKey = txMonthKey(tx);
  const utcKey = `2026-01`;
  if (localKey === utcKey) ok(`Deposit attributed to ${localKey} (matches UTC month here)`);
  else bad("Deposit month depends on the viewer's timezone",
    `createdAt 2026-01-31T23:30Z resolves to ${localKey} in this runtime's tz; in UTC+ zones it lands in Feb. Income can shift months across boundaries.`);
}

// ──────────────────────────────────────────────────────────────────────
// 4. FORECAST MODEL  (copy of src/utils/forecast.ts pure functions)
// ──────────────────────────────────────────────────────────────────────
function flowBounds(flow) {
  const sign = flow.type === "out" ? -1 : 1;
  if (flow.uncertain) {
    const lo = sign * (flow.lowValue ?? 0);
    const hi = sign * (flow.highValue ?? 0);
    return { best: Math.max(lo, hi), worst: Math.min(lo, hi) };
  }
  const v = sign * (flow.value ?? 0);
  return { best: v, worst: v };
}
function emptyBucket() {
  return { inBest: 0, inWorst: 0, outBest: 0, outWorst: 0, netBest: 0, netWorst: 0 };
}
function monthlyBuckets(flows, year) {
  const months = Array.from({ length: 12 }, emptyBucket);
  for (const f of flows) {
    if (f.enabled === false || f.year !== year) continue;
    const b = flowBounds(f);
    for (const m of f.months) {
      const idx = m - 1;
      if (idx < 0 || idx > 11) continue;
      months[idx].netBest += b.best;
      months[idx].netWorst += b.worst;
      if (f.type === "in") { months[idx].inBest += b.best; months[idx].inWorst += b.worst; }
      else { months[idx].outBest += b.best; months[idx].outWorst += b.worst; }
    }
  }
  return months;
}
function yearNet(flows, year) {
  return monthlyBuckets(flows, year).reduce(
    (acc, m) => ({ best: acc.best + m.netBest, worst: acc.worst + m.netWorst }),
    { best: 0, worst: 0 });
}
function startingBalance(flows, year, anchor, baseYear) {
  const start = { best: anchor, worst: anchor };
  if (year > baseYear) {
    for (let y = baseYear; y < year; y++) {
      const n = yearNet(flows, y);
      start.best += n.best;
      start.worst += n.worst;
    }
  }
  return start;
}

console.log("\n── FORECAST: bounds sign correctness ──");
{
  const outU = flowBounds({ type: "out", uncertain: true, lowValue: 100, highValue: 300 });
  if (approx(outU.best, -100) && approx(outU.worst, -300)) ok("Uncertain outflow: best=-100, worst=-300");
  else bad("Uncertain outflow bounds wrong", JSON.stringify(outU));

  const inU = flowBounds({ type: "in", uncertain: true, lowValue: 100, highValue: 300 });
  if (approx(inU.best, 300) && approx(inU.worst, 100)) ok("Uncertain inflow: best=300, worst=100");
  else bad("Uncertain inflow bounds wrong", JSON.stringify(inU));
}

console.log("\n── FORECAST: enabled filter + year isolation ──");
{
  const flows = [
    { year: 2026, months: [1, 2], type: "in", uncertain: false, value: 1000, enabled: true },
    { year: 2026, months: [1], type: "out", uncertain: false, value: 400, enabled: true },
    { year: 2026, months: [1], type: "out", uncertain: false, value: 999, enabled: false }, // disabled
    { year: 2025, months: [1], type: "in", uncertain: false, value: 5000, enabled: true },  // other year
  ];
  const net = yearNet(flows, 2026);
  // 2 months income 1000 each = 2000, minus 400 once = 1600
  if (approx(net.best, 1600) && approx(net.worst, 1600)) ok("Disabled + other-year flows correctly excluded (net=1600)");
  else bad("year/enabled filtering wrong", JSON.stringify(net));
}

console.log("\n── FORECAST: starting balance for a PAST year ──");
{
  const flows = [{ year: 2025, months: [6], type: "in", uncertain: false, value: 1000, enabled: true }];
  const anchor = 10000;       // accounts total "now" (base year 2026)
  const baseYear = 2026;
  const past = startingBalance(flows, 2025, anchor, baseYear);   // viewing 2025
  // 2025 is BEFORE base year. Correct start should roll the anchor BACKWARD
  // through 2026's intervening net; instead it returns the anchor unchanged.
  if (past.best === anchor && past.worst === anchor) {
    bad("Past-year starting balance is not rolled back",
      `Viewing ${2025} (before base ${baseYear}) shows start = anchor ${anchor}. It should subtract later years' net to reconstruct the past balance. Only matters if the UI lets you scroll to years before the anchor.`);
  } else ok("Past-year starting balance handled");
}

console.log(`\n${failures === 0 ? "ALL CONSISTENT" : `${failures} discrepancy/ies found`}\n`);
process.exit(0);
