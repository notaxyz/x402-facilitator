// Runs before every test file. config.ts reads these at import time.
process.env.NODE_ENV = 'test';
process.env.NETWORK = 'eip155:421614';
// Throwaway key (private key 0x01…01); never funded, never used onchain in tests
process.env.FACILITATOR_PRIVATE_KEY = '0x0101010101010101010101010101010101010101010101010101010101010101';
delete process.env.DATABASE_URL;
delete process.env.ADMIN_API_KEY_HASH;
