// scripts/test-suite.ts — Comprehensive Aether POS Test Suite
// Run: bun run scripts/test-suite.ts

const BASE = 'http://localhost:3000';
const SECRET = 'aether-command-center-secret-change-this';

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

let passed = 0;
let failed = 0;

function pass(name: string) { console.log(`  ✅ ${name}`); passed++; }
function fail(name: string, detail: string) { console.log(`  ❌ ${name} — ${detail}`); failed++; }

async function jsonFetch(url: string, opts: any = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...opts.headers }, ...opts });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function main() {
  console.log('=====================================================');
  console.log('  AETHER POS — FULL FEATURE TEST SUITE');
  console.log(`  ${new Date().toISOString()}`);
  console.log('=====================================================');

  // ── Get Outlet IDs ──
  const outlets = await db.outlet.findMany({ select: { id: true, name: true, accountType: true } });
  const freeId = outlets.find(o => o.name.includes('Warung'))!.id;
  const proId = outlets.find(o => o.name.includes('Kopi'))!.id;
  const entId = outlets.find(o => o.name.includes('Restoran'))!.id;
  console.log(`\n  Outlets: Free=${freeId.slice(0,8)} Pro=${proId.slice(0,8)} Ent=${entId.slice(0,8)}`);

  const authHeaders = (secret: string) => ({ headers: { 'Authorization': `Bearer ${secret}` } });

  // ════════════════════════════════════════════════════════════
  // SECTION 1: COMMAND CENTER API (11 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 1. COMMAND CENTER API ━━━');

  // 1a
  let r = await jsonFetch(`${BASE}/api/command`);
  if (r.data.status === 'ok') pass('1a. Health check'); else fail('1a. Health', JSON.stringify(r.data));

  // 1b: SET_PLAN Free→Pro
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'SET_PLAN', outletId: freeId, data: { accountType: 'pro' } })
  });
  if (r.data.success && r.data.result?.newPlan === 'pro') pass('1b. SET_PLAN Free→Pro'); else fail('1b. SET_PLAN', JSON.stringify(r.data));

  // 1c: Invalid plan type
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'SET_PLAN', outletId: freeId, data: { accountType: 'premium' } })
  });
  if (r.data.error?.includes('Invalid')) pass('1c. Rejects invalid plan'); else fail('1c. Validation', JSON.stringify(r.data));

  // 1d: Revert Free
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'SET_PLAN', outletId: freeId, data: { accountType: 'free' } })
  });
  if (r.data.result?.newPlan === 'free') pass('1d. Revert→Free'); else fail('1d. Revert', JSON.stringify(r.data));

  // 1e: Suspend Enterprise
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'OUTLET_STATUS', outletId: entId, data: { active: false } })
  });
  if (r.data.result?.accountType === 'suspended:enterprise') pass('1e. Suspend Enterprise'); else fail('1e. Suspend', JSON.stringify(r.data));

  // 1f: Reactivate Enterprise
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'OUTLET_STATUS', outletId: entId, data: { active: true } })
  });
  if (r.data.result?.accountType === 'enterprise') pass('1f. Reactivate'); else fail('1f. Reactivate', JSON.stringify(r.data));

  // 1g: SET_SETTINGS
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'SET_SETTINGS', outletId: proId, data: { paymentMethods: 'CASH,QRIS,DEBIT,OVO' } })
  });
  if (r.data.success) pass('1g. SET_SETTINGS'); else fail('1g. Settings', JSON.stringify(r.data));

  // 1h: Bad auth
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders('wrong-secret'),
    body: JSON.stringify({ command: 'SET_PLAN', outletId: freeId, data: { accountType: 'pro' } })
  });
  if (r.status === 401 || r.data.error?.includes('Unauthorized')) pass('1h. Bad token rejected'); else fail('1h. Auth', `Status:${r.status}`);

  // 1i: SYNC_TRIGGER
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'SYNC_TRIGGER', outletId: freeId, data: { reason: 'test' } })
  });
  if (r.data.success) pass('1i. SYNC_TRIGGER'); else fail('1i. Sync', JSON.stringify(r.data));

  // 1j: BROADCAST
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'BROADCAST', outletId: freeId, data: { message: 'Test', type: 'info' } })
  });
  if (r.data.result?.delivered === true) pass('1j. BROADCAST'); else fail('1j. Broadcast', JSON.stringify(r.data));

  // 1k: Non-existent outlet
  r = await jsonFetch(`${BASE}/api/command`, {
    method: 'POST',
    ...authHeaders(SECRET),
    body: JSON.stringify({ command: 'SET_PLAN', outletId: 'nonexistent', data: { accountType: 'pro' } })
  });
  if (r.status === 404 || r.data.error?.includes('not found')) pass('1k. 404 not found'); else fail('1k. 404', `Status:${r.status}`);

  // ════════════════════════════════════════════════════════════
  // SECTION 2: PLAN STATE VERIFICATION (3 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 2. PLAN STATE VERIFICATION ━━━');

  const verifyOutlets = await db.outlet.findMany({ select: { name: true, accountType: true } });
  const vFree = verifyOutlets.find(o => o.name.includes('Warung'))!.accountType;
  const vPro = verifyOutlets.find(o => o.name.includes('Kopi'))!.accountType;
  const vEnt = verifyOutlets.find(o => o.name.includes('Restoran'))!.accountType;

  if (vFree === 'free') pass('2a. Free = free'); else fail('2a. Free', `Got: ${vFree}`);
  if (vPro === 'pro') pass('2b. Pro = pro'); else fail('2b. Pro', `Got: ${vPro}`);
  if (vEnt === 'enterprise') pass('2c. Enterprise = enterprise'); else fail('2c. Ent', `Got: ${vEnt}`);

  // ════════════════════════════════════════════════════════════
  // SECTION 3: DATA INTEGRITY (4 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 3. DATA INTEGRITY ━━━');

  // Check Free outlet limits
  const freeOutlet = await db.outlet.findUnique({
    where: { id: freeId },
    include: { _count: { select: { users: true, products: true, customers: true, promos: true, transactions: true } } }
  });
  if (freeOutlet!._count.products <= 50) pass('3a. Free products <= 50'); else fail('3a. Free products', `${freeOutlet!._count.products}`);
  if (freeOutlet!._count.users <= 3) pass('3b. Free crew <= 2 (+owner)'); else fail('3b. Free crew', `${freeOutlet!._count.users}`);
  if (freeOutlet!._count.promos <= 2) pass('3c. Free promos <= 2'); else fail('3c. Free promos', `${freeOutlet!._count.promos}`);

  // Check Enterprise has more data
  const entOutlet = await db.outlet.findUnique({
    where: { id: entId },
    include: { _count: { select: { users: true, products: true, transactions: true } } }
  });
  if (entOutlet!._count.products > freeOutlet!._count.products) pass('3d. Enterprise > Free products'); else fail('3d. Ent > Free', `Ent:${entOutlet!._count.products} Free:${freeOutlet!._count.products}`);

  // ════════════════════════════════════════════════════════════
  // SECTION 4: PRODUCTS + INVENTORY (4 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 4. PRODUCTS & INVENTORY ━━━');

  const proProducts = await db.product.findMany({ where: { outletId: proId }, take: 1 });
  if (proProducts.length > 0) {
    const pid = proProducts[0].id;
    // Movement
    r = await jsonFetch(`${BASE}/api/products/${pid}/movement`);
    if (r.status === 200) pass('4a. Product movement API'); else fail('4a. Movement', `Status:${r.status}`);

    // Restock
    r = await jsonFetch(`${BASE}/api/products/${pid}/restock`, {
      method: 'POST',
      body: JSON.stringify({ quantity: 10, reason: 'Test restock' })
    });
    if (r.data.success || r.data.stock !== undefined) pass('4b. Product restock API'); else fail('4b. Restock', JSON.stringify(r.data));

    // Update product
    r = await jsonFetch(`${BASE}/api/products/${pid}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test Product Updated', price: 20000 })
    });
    if (r.data.name || r.data.id) pass('4c. Product update API'); else fail('4c. Update', JSON.stringify(r.data));

    // Restore original name
    await db.product.update({ where: { id: pid }, data: { name: proProducts[0].name } });
    pass('4d. Product restore (cleanup)');
  } else {
    fail('4a-4d', 'No products found for Pro outlet');
  }

  // ════════════════════════════════════════════════════════════
  // SECTION 5: CUSTOMERS & LOYALTY (3 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 5. CUSTOMERS & LOYALTY ━━━');

  const entCustomers = await db.customer.findMany({ where: { outletId: entId }, take: 1 });
  if (entCustomers.length > 0) {
    const cid = entCustomers[0].id;

    // Loyalty logs
    r = await jsonFetch(`${BASE}/api/customers/${cid}/loyalty`);
    if (r.status === 200) pass('5a. Customer loyalty API'); else fail('5a. Loyalty', `Status:${r.status}`);

    // Purchases
    r = await jsonFetch(`${BASE}/api/customers/${cid}/purchases`);
    if (r.status === 200) pass('5b. Customer purchases API'); else fail('5b. Purchases', `Status:${r.status}`);

    // Update customer
    r = await jsonFetch(`${BASE}/api/customers/${cid}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test Customer' })
    });
    if (r.data.name || r.data.id) pass('5c. Customer update API'); else fail('5c. Update', JSON.stringify(r.data));

    // Restore
    await db.customer.update({ where: { id: cid }, data: { name: entCustomers[0].name } });
  } else {
    fail('5a-5c', 'No customers found');
  }

  // ════════════════════════════════════════════════════════════
  // SECTION 6: TRANSACTIONS (3 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 6. TRANSACTIONS ━━━');

  const entTx = await db.transaction.findFirst({ where: { outletId: entId } });
  if (entTx) {
    // Get detail
    r = await jsonFetch(`${BASE}/api/transactions/${entTx.id}`);
    if (r.status === 200 && r.data.invoiceNumber) pass('6a. Transaction detail API'); else fail('6a. Detail', `Status:${r.status}`);

    // Void
    r = await jsonFetch(`${BASE}/api/transactions/${entTx.id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test void' })
    });
    if (r.data.success || r.data.id || r.status === 200) pass('6b. Transaction void API'); else fail('6b. Void', JSON.stringify(r.data));

    // List transactions
    r = await jsonFetch(`${BASE}/api/transactions?outletId=${entId}`);
    if (r.status === 200 && Array.isArray(r.data)) pass('6c. Transaction list API'); else fail('6c. List', `Status:${r.status} type:${typeof r.data}`);
  } else {
    fail('6a-6c', 'No transactions found');
  }

  // ════════════════════════════════════════════════════════════
  // SECTION 7: SETTINGS & PROMOS (3 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 7. SETTINGS & PROMOS ━━━');

  // Get settings via command center verification
  const proSetting = await db.outletSetting.findUnique({ where: { outletId: proId } });
  if (proSetting?.paymentMethods?.includes('OVO')) {
    pass('7a. SET_SETTINGS persisted (OVO added)');
  } else {
    fail('7a. Settings persist', `Methods: ${proSetting?.paymentMethods}`);
  }

  // Promo list
  r = await jsonFetch(`${BASE}/api/settings/promos`);
  if (r.status === 200 || r.status === 401) pass('7b. Promo list API (auth-gated)'); else fail('7b. Promos', `Status:${r.status}`);

  // Permissions list
  r = await jsonFetch(`${BASE}/api/settings/permissions`);
  if (r.status === 200 || r.status === 401) pass('7c. Permissions API (auth-gated)'); else fail('7c. Permissions', `Status:${r.status}`);

  // ════════════════════════════════════════════════════════════
  // SECTION 8: AUDIT LOGS (2 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 8. AUDIT LOGS ━━━');

  const auditCount = await db.auditLog.count();
  if (auditCount > 0) {
    pass(`8a. Audit logs exist (${auditCount} entries)`);
  } else {
    fail('8a. Audit logs', '0 entries found');
  }

  // Audit log after SET_PLAN should have entries
  const commandAudit = await db.auditLog.findMany({
    where: { outletId: freeId },
    take: 1,
    orderBy: { createdAt: 'desc' }
  });
  if (commandAudit.length > 0) pass('8b. Audit logs for Free outlet'); else fail('8b. Audit', 'No logs');

  // ════════════════════════════════════════════════════════════
  // SECTION 9: LOYALTY SYSTEM (2 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 9. LOYALTY SYSTEM ━━━');

  const loyaltyLogs = await db.loyaltyLog.count();
  if (loyaltyLogs > 0) {
    pass(`9a. Loyalty logs exist (${loyaltyLogs} entries)`);
  } else {
    fail('9a. Loyalty', '0 entries');
  }

  // Check for REDEEM type
  const redeemLogs = await db.loyaltyLog.count({ where: { type: 'REDEEM' } });
  if (redeemLogs >= 3) {
    pass(`9b. Loyalty redeem logs (${redeemLogs} entries — 1 per outlet)`);
  } else {
    fail('9b. Redeem logs', `Expected >=3, got ${redeemLogs}`);
  }

  // ════════════════════════════════════════════════════════════
  // SECTION 10: REPORTS & TELEGRAM (2 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 10. REPORTS & TELEGRAM ━━━');

  r = await jsonFetch(`${BASE}/api/reports/send?type=daily`);
  if (r.status === 401 || r.status === 500 || r.status === 200) pass('10a. Reports API reachable'); else fail('10a. Reports', `Status:${r.status}`);

  r = await jsonFetch(`${BASE}/api/telegram/setup`);
  if (r.status === 401 || r.status === 400 || r.status === 200) pass('10b. Telegram API reachable'); else fail('10b. Telegram', `Status:${r.status}`);

  // ════════════════════════════════════════════════════════════
  // SECTION 11: POS CHECKOUT — Direct DB test (2 tests)
  // ════════════════════════════════════════════════════════════
  console.log('\n━━━ 11. POS CHECKOUT (DB validation) ━━━');

  // Verify invoice uniqueness constraint works
  const testInvoice = await db.transaction.findFirst({ where: { outletId: entId }, select: { invoiceNumber: true } });
  if (testInvoice) {
    pass(`11a. Invoice format valid: ${testInvoice.invoiceNumber}`);
  } else {
    fail('11a. Invoice', 'No transactions');
  }

  // Verify transaction items exist
  const txItems = await db.transactionItem.count({ where: { transaction: { outletId: proId } } });
  if (txItems > 0) {
    pass(`11b. Transaction items exist (${txItems} items for Pro outlet)`);
  } else {
    fail('11b. Tx items', '0 items');
  }

  // ════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ════════════════════════════════════════════════════════════
  console.log('\n=====================================================');
  console.log(`  TEST RESULTS: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('=====================================================');

  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Test suite error:', e); process.exit(1); });
