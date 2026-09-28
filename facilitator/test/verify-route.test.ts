import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { PAYER, decodeExtensionResponses, facilitatorRequest, validBazaarDeclaration } from './fixtures.js';

// The route is exercised over real HTTP; chain and database access are stubbed out.
vi.mock('../src/clients.js', () => ({
  publicClient: {},
  walletClient: {},
  facilitatorAccount: { address: '0x1a642f0E3c3aF545E7AcBD38b07251B3990914F1' },
  USDC_ABI: [],
  splitEcdsaSignature: () => null,
}));
vi.mock('../src/db.js', () => ({ isDatabaseConfigured: () => false, pool: {} }));
vi.mock('../src/merchantStore.js', () => ({ getAllMerchants: async () => [], getMerchantByAddress: async () => null }));
vi.mock('../src/verify.js', () => ({
  verifyPayment: async () => ({ response: { isValid: false, invalidReason: 'invalid_exact_evm_signature', payer: PAYER } }),
}));

let server: Server;
let base: string;

beforeAll(async () => {
  const { app } = await import('../src/server.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function verify(body: unknown) {
  const res = await fetch(`${base}/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, header: decodeExtensionResponses(res.headers.get('extension-responses')), body: await res.json() };
}

describe('GET /supported', () => {
  it('advertises the bazaar extension', async () => {
    const supported = await (await fetch(`${base}/supported`)).json();
    expect(supported.extensions).toEqual(['bazaar']);
  });
});

describe('POST /verify with a bazaar declaration', () => {
  it('returns 200 and a rejected EXTENSION-RESPONSES header for a malformed declaration, without touching the payment result', async () => {
    const { status, header, body } = await verify(facilitatorRequest({ info: { input: { type: 'grpc' } }, schema: { type: 'object' } }));
    expect(status).toBe(200);
    expect(body).toMatchObject({ isValid: false, invalidReason: 'invalid_exact_evm_signature', payer: PAYER });
    expect(header).toEqual({
      bazaar: { status: 'rejected', rejectedReason: expect.stringContaining('input.type must be "http" or "mcp"') },
    });
  });

  it('reports processing for a valid declaration (indexing waits for settle)', async () => {
    const { status, header } = await verify(facilitatorRequest(validBazaarDeclaration()));
    expect(status).toBe(200);
    expect(header).toEqual({ bazaar: { status: 'processing' } });
  });

  it('sends no header when the payload carries no declaration', async () => {
    const { status, header } = await verify(facilitatorRequest(undefined));
    expect(status).toBe(200);
    expect(header).toBeNull();
  });
});

describe('GET /discovery/resources', () => {
  it('validates query parameters', async () => {
    expect((await fetch(`${base}/discovery/resources?type=grpc`)).status).toBe(400);
    expect((await fetch(`${base}/discovery/resources?limit=0`)).status).toBe(400);
    expect((await fetch(`${base}/discovery/resources?limit=101`)).status).toBe(400);
    expect((await fetch(`${base}/discovery/resources?offset=-1`)).status).toBe(400);
  });

  it('returns 503 when no database is configured', async () => {
    expect((await fetch(`${base}/discovery/resources`)).status).toBe(503);
  });
});
