import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logging.js';
import { encodeExtensionResponses, evaluateBazaarDeclaration } from '../src/bazaar.js';
import { normalizedPayment, validBazaarDeclaration } from './fixtures.js';

const logger = createLogger({ context: 'test' });

describe('evaluateBazaarDeclaration', () => {
  it('reports declared: false when the payload carries no bazaar extension', () => {
    expect(evaluateBazaarDeclaration(normalizedPayment(undefined), logger)).toEqual({ declared: false });
  });

  it('accepts a declaration produced by declareDiscoveryExtension', () => {
    const result = evaluateBazaarDeclaration(normalizedPayment(validBazaarDeclaration()), logger);
    expect(result.declared).toBe(true);
    if (!result.declared || !result.valid) throw new Error('expected valid');
    expect(result.resource.resourceUrl).toBe('http://localhost:3100/analyze');
    expect(result.resource.discoveryInfo.input.type).toBe('http');
    expect('method' in result.resource && result.resource.method).toBe('GET');
  });

  it('rejects an unknown input type without throwing', () => {
    const result = evaluateBazaarDeclaration(
      normalizedPayment({ info: { input: { type: 'grpc' } }, schema: { type: 'object' } }),
      logger
    );
    expect(result).toMatchObject({ declared: true, valid: false });
    expect((result as any).rejectedReason).toMatch(/input.type must be "http" or "mcp"/);
  });

  it('rejects a schema that references an external document', () => {
    const declaration = validBazaarDeclaration();
    (declaration.schema as any).$ref = 'https://evil.example/schema.json';
    const result = evaluateBazaarDeclaration(normalizedPayment(declaration), logger);
    expect(result).toMatchObject({ declared: true, valid: false });
    expect((result as any).rejectedReason).toMatch(/external \$ref/);
  });

  it('rejects info that does not satisfy its own schema', () => {
    const declaration = validBazaarDeclaration();
    (declaration.info as any).input.method = 'POST'; // schema enum is GET/HEAD/DELETE
    const result = evaluateBazaarDeclaration(normalizedPayment(declaration), logger);
    expect(result).toMatchObject({ declared: true, valid: false });
    expect((result as any).rejectedReason).toMatch(/schema validation/);
  });

  it('rejects an http declaration with no method', () => {
    const declaration = validBazaarDeclaration();
    delete (declaration.info as any).input.method;
    const result = evaluateBazaarDeclaration(normalizedPayment(declaration), logger);
    expect((result as any).rejectedReason).toMatch(/method is required/);
  });

  it('rejects a relative resource url', () => {
    const result = evaluateBazaarDeclaration(normalizedPayment(validBazaarDeclaration(), '/analyze'), logger);
    expect((result as any).rejectedReason).toMatch(/absolute http\(s\) URL/);
  });

  it('rejects non-object declarations', () => {
    expect((evaluateBazaarDeclaration(normalizedPayment('nope'), logger) as any).rejectedReason).toMatch(/must be an object/);
    expect((evaluateBazaarDeclaration(normalizedPayment({ info: {} }), logger) as any).rejectedReason).toMatch(/schema is required/);
  });
});

describe('encodeExtensionResponses', () => {
  it('produces the spec example encoding', () => {
    expect(encodeExtensionResponses({ bazaar: { status: 'success' } })).toBe('eyJiYXphYXIiOnsic3RhdHVzIjoic3VjY2VzcyJ9fQ==');
  });
});
