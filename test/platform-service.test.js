const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformService, teamBillingHeader } = require('../src/main/platform-service');
const { PlatformSession, MemoryTokenStore } = require('../src/main/platform-session');

function makeService(overrides = {}) {
  const calls = [];
  const client = {
    request: async (path, options) => {
      calls.push({ path, options });
      if (path === '/v1/me/billing-contexts') {
        return { data: {
          team_billing_available: true,
          contexts: [{
            wallet_owner_id: 'w1',
            billing_context: { kind: 'team', team_id: 't1' },
            role: 'owner', status: 'active', can_spend: true, can_recharge: true,
            available_micro_points: '100', reserved_micro_points: '0'
          }]
        } };
      }
      return { data: { ok: true, payment_context: { wallet_owner_id: 'w1', context: { kind: 'team', team_id: 't1' } } } };
    },
    ...overrides.client
  };
  const service = new PlatformService({
    client,
    session: overrides.session || new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'a', refreshToken: 'r' }) }),
    config: { productCode: 'elunvi-mart', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  return { service, calls };
}

test('billing contexts use the wallet-v1 contract header', async () => {
  const { service, calls } = makeService();
  await service.getBillingContexts();
  assert.equal(calls[0].path, '/v1/me/billing-contexts');
  assert.equal(calls[0].options.headers['X-Elunvi-Billing-Contract'], teamBillingHeader);
});

test('team checkout validates the frozen payment identity returned by Platform', async () => {
  const { service } = makeService();
  const checkout = await service.createCheckout({
    packageCode: 'points-100',
    billingContext: { kind: 'team', team_id: 't1' },
    idempotencyKey: 'checkout-1'
  });
  assert.deepEqual(checkout.paymentContext.context, { kind: 'team', team_id: 't1' });
});

test('team checkout rejects a mismatched frozen payment identity', async () => {
  const { service } = makeService({
    client: {
      request: async (path) => path === '/v1/me/billing-contexts'
        ? { data: {
          team_billing_available: true,
          contexts: [{ wallet_owner_id: 'w1', billing_context: { kind: 'team', team_id: 't1' }, role: 'owner', status: 'active', can_spend: true, can_recharge: true, available_micro_points: '100', reserved_micro_points: '0' }]
        } }
        : { data: { payment_context: { wallet_owner_id: 'w1', context: { kind: 'personal' } } } }
    }
  });
  await assert.rejects(() => service.createCheckout({
    packageCode: 'points-100',
    billingContext: { kind: 'team', team_id: 't1' },
    idempotencyKey: 'checkout-2'
  }), /支付身份不一致/);
});

test('protected operations fail clearly when no Platform session exists', async () => {
  const { service } = makeService({ session: new PlatformSession({ tokenStore: new MemoryTokenStore() }) });
  await assert.rejects(() => service.getProfile(), /请先登录/);
});
