import { expect, test, type Page } from '@playwright/test';

const API_URL =
  process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3100';

const ACCESS_TOKEN_KEY = 'apex_access_token';
const E2E_TOKEN = 'e2e-access-token-not-a-production-secret';

/**
 * These tests use two local servers:
 * - Vite on :3000 for the real React application.
 * - tests/e2e/support/apiServer.mjs on :3100 for the real checkout/health
 *   handlers plus an in-memory, explicitly simulated PayPal replay surface.
 *
 * No test depends on the suspended Render backend. The billing UI test uses
 * Playwright network fixtures; those fixtures are test data, not production
 * balances or receipts.
 */

async function installBillingFixtures(page: Page) {
  await page.addInitScript(
    ({ tokenKey, token }) => {
      window.sessionStorage.setItem(tokenKey, token);
      const browserWindow = window as typeof window & {
        __apexOpenedUrls?: string[];
      };
      browserWindow.__apexOpenedUrls = [];
      window.open = ((url?: string | URL) => {
        browserWindow.__apexOpenedUrls?.push(String(url ?? ''));
        return {} as Window;
      }) as typeof window.open;
    },
    { tokenKey: ACCESS_TOKEN_KEY, token: E2E_TOKEN },
  );

  await page.route('**/v1/config/public', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paypal_env: 'sandbox',
        payments_enabled: true,
        demo_mode: true,
      }),
    }),
  );

  await page.route('**/v1/billing/balance', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available_cu: 5000,
        available_usd: 50,
        reserved_cu: 0,
        reserved_usd: 0,
        total_cu: 5000,
        active_clusters: 0,
        source: 'playwright_fixture_not_production',
      }),
    }),
  );

  await page.route('**/v1/billing/ledger', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route('**/v1/billing/security', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        row_level_security: 'FIXTURE',
        audit_immutability: 'FIXTURE',
        active_signing_kid: 'fixture',
        source: 'playwright_fixture_not_production',
      }),
    }),
  );
}

test.describe('public landing surface and navigation', () => {
  test('renders the early-access landing surface and navigates without a full reload', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toContainText('SOVEREIGN COMPUTE EXCHANGE');
    await expect(
      page.getByRole('button', { name: 'OPEN EXCHANGE TERMINAL' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .first()
      .getByRole('button', { name: 'BILLING & LEDGER', exact: true })
      .click();

    await expect(page).toHaveURL(/\/billing$/);
    await expect(
      page.getByRole('heading', {
        name: /Atomic Ledger & Webhook-Verified PayPal Settlement/i,
      }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .first()
      .getByRole('button', { name: 'TERMINAL', exact: true })
      .click();

    await expect(page).toHaveURL(/\/terminal$/);
    await expect(
      page.getByRole('heading', {
        name: /Autonomous CLI Terminal & JSON Inspector/i,
      }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/billing$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('does not fabricate a waitlist workflow that is not implemented', async ({
    page,
  }) => {
    // This workspace has no /waitlist route or waitlist form. The SPA falls
    // back to the public landing surface. Assert that current behavior so a
    // future waitlist implementation has a clear regression anchor and so the
    // suite never pretends a signup control exists.
    await page.goto('/waitlist');
    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toContainText('SOVEREIGN COMPUTE EXCHANGE');
    await expect(page.getByRole('form')).toHaveCount(0);
  });
});

test.describe('checkout quote contract', () => {
  test('quotes integer CU, never credits, and rejects malformed payloads', async ({
    request,
  }) => {    const valid = await request.post(`${API_URL}/api/checkout`, {
      data: {
        customer_id: 'tenant_e2e_01',
        usd_amount: 12.34,
      },
    });

    expect(valid.status()).toBe(200);
    expect(valid.headers()['x-ratelimit-mode']).toBe('test-bypass');

    const quote = await valid.json();
    expect(quote.status).toBe('initialized');
    expect(quote.customer_id).toBe('tenant_e2e_01');
    expect(quote.usd_amount).toBe(12.34);
    expect(quote.compute_units_quoted).toBe(1234);
    expect(quote.compute_units_credited).toBe(0);
    expect(quote.credited).toBe(false);
    expect(quote.minted_by).toBe('paypal_webhook_only');
    expect(quote.requires_webhook_confirmation).toBe(true);
    expect(Number.isFinite(Date.parse(quote.timestamp))).toBe(true);

    const invalidPayloads = [
      { customer_id: 'tenant_e2e_01', usd_amount: '12.34' },
      { customer_id: 'tenant_e2e_01', usd_amount: 0 },
      { customer_id: 'tenant_e2e_01', usd_amount: -5 },
      { customer_id: 'tenant_e2e_01', usd_amount: 0.001 },
      { customer_id: 'tenant_e2e_01', usd_amount: 10, tenant_id: 'other' },
      { customer_id: '', usd_amount: 10 },
      { customer_id: 'a'.repeat(129), usd_amount: 10 },
      { customer_id: 'tenant<script>', usd_amount: 10 },
    ];

    for (const payload of invalidPayloads) {
      const response = await request.post(`${API_URL}/api/checkout`, {
        data: payload,
      });
      expect(
        response.status(),
        `payload should be rejected: ${JSON.stringify(payload)}`,
      ).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('invalid_request');
    }
  });

  test('health response satisfies the shared contract', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-ratelimit-mode']).toBe('test-bypass');

    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        status: 'operational',
        system: 'ApexSovereign.ai',
        exchange: 'live',
        ledger_rate: '$1.00 = 100 CU',
      }),
    );
    expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
  });
});

test.describe('billing checkout initialization', () => {
  test('creates a PayPal order and does not mint CU on capture', async ({
    page,
  }) => {
    await installBillingFixtures(page);

    let createOrderIdempotencyKey = '';
    let createOrderBody: unknown = null;

    await page.route('**/v1/billing/paypal/create-order', async (route) => {
      createOrderIdempotencyKey =
        route.request().headers()['idempotency-key'] || '';
      createOrderBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order_id: 'ORDER-E2E-1',
          pack: 'developer',
          cu_amount: 5000,
          amount_usd: '50.00',
          status: 'CREATED',
        }),
      });
    });

    await page.route('**/v1/billing/paypal/capture', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'COMPLETED',
          order_id: 'ORDER-E2E-1',
          capture_id: 'CAP-E2E-1',
          already_captured: false,
        }),
      }),
    );

    await page.goto('/billing');
    await expect(
      page.getByRole('heading', { name: 'Buy compute units' }),
    ).toBeVisible();

    const balanceSection = page.locator(
      'section[aria-labelledby="billing-balance-heading"]',
    );
    const primaryBalance = balanceSection.locator('div.text-3xl').first();
    await expect(primaryBalance).toContainText('5,000 CU');

    const createOrder = page.getByRole('button', {
      name: /CREATE PAYPAL ORDER/i,
    });
    await expect(createOrder).toBeEnabled();
    await createOrder.click();

    await expect(page.getByText(/PayPal order created/i)).toBeVisible();
    await expect(page.getByText(/ORDER-E2E-1/)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /OPEN PAYPAL APPROVAL/i }),
    ).toHaveAttribute(
      'href',
      'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-E2E-1',
    );

    expect(createOrderBody).toEqual({ pack: 'developer' });
    expect(createOrderIdempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const openedUrls = await page.evaluate(() => {
      const browserWindow = window as typeof window & {
        __apexOpenedUrls?: string[];
      };
      return browserWindow.__apexOpenedUrls || [];
    });
    expect(openedUrls).toContain(
      'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-E2E-1',
    );

    await page
      .getByRole('button', { name: 'CAPTURE AFTER APPROVAL' })
      .click();

    await expect(
      page.getByText(
        /CU is minted only after the signed webhook is verified/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'CAPTURE AFTER APPROVAL' }),
    ).toHaveCount(0);
    await expect(primaryBalance).toContainText('5,000 CU');
    await expect(balanceSection.getByText('5,500 CU')).toHaveCount(0);
  });
});

test.describe('PayPal webhook replay simulation', () => {
  test('credits once and returns zero on duplicate event or capture ids', async ({
    request,
  }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const event = {
      id: `WH-E2E-${suffix}`,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: `CAP-E2E-${suffix}`,
        custom_id: `tenant_e2e_webhook_${suffix}:500:IDEM-${suffix}`,
        amount: { currency_code: 'USD', value: '5.00' },
        supplementary_data: {
          related_ids: { order_id: `ORDER-E2E-${suffix}` },
        },
        payer: { email_address: 'buyer@example.com' },
      },
    };

    const first = await request.post(
      `${API_URL}/__e2e__/webhooks/paypal/replay`,
      { data: event },
    );
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.status).toBe('PROCESSED');
    expect(firstBody.replay).toBe(false);
    expect(firstBody.simulated).toBe(true);
    expect(firstBody.signature_verified).toBe(false);
    expect(firstBody.minted_by).toBe('e2e_simulator_not_production');
    expect(firstBody.compute_units_credited).toBe(500);
    expect(firstBody.balance_before_cu).toBe(0);
    expect(firstBody.balance_cu).toBe(500);

    const duplicateEvent = await request.post(
      `${API_URL}/__e2e__/webhooks/paypal/replay`,
      { data: event },
    );
    expect(duplicateEvent.status()).toBe(200);
    const duplicateEventBody = await duplicateEvent.json();
    expect(duplicateEventBody.status).toBe('REPLAY');
    expect(duplicateEventBody.replay).toBe(true);
    expect(duplicateEventBody.reason).toBe('duplicate_event_id');
    expect(duplicateEventBody.compute_units_credited).toBe(0);
    expect(duplicateEventBody.balance_cu).toBe(500);

    const duplicateCapture = await request.post(
      `${API_URL}/__e2e__/webhooks/paypal/replay`,
      {
        data: {
          ...event,
          id: `WH-E2E-SECOND-${suffix}`,
        },
      },
    );
    expect(duplicateCapture.status()).toBe(200);
    const duplicateCaptureBody = await duplicateCapture.json();
    expect(duplicateCaptureBody.status).toBe('REPLAY');
    expect(duplicateCaptureBody.reason).toBe('duplicate_capture_id');
    expect(duplicateCaptureBody.compute_units_credited).toBe(0);
    expect(duplicateCaptureBody.balance_cu).toBe(500);
  });

  test('rejects a capture event without a validated USD amount', async ({
    request,
  }) => {
    const response = await request.post(
      `${API_URL}/__e2e__/webhooks/paypal/replay`,
      {
        data: {
          id: `WH-E2E-INVALID-${Date.now()}`,
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: `CAP-E2E-INVALID-${Date.now()}`,
            custom_id: 'tenant_e2e_invalid:100:IDEM-INVALID',
          },
        },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('invalid_webhook_payload');
  });
});
