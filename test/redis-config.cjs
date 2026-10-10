const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const redisConfig = require('../dist/config/redis.config').default;
const previous = process.env.REDIS_URL;
try {
  process.env.REDIS_URL = 'rediss://bridgepay-refund:synthetic@redis.example:6379';
  const config = new ConfigService(redisConfig());
  assert.equal(config.get('redis.redisUrl'), process.env.REDIS_URL);
  assert.equal(config.get('redisUrl'), undefined);
  delete process.env.REDIS_URL;
  assert.equal(redisConfig().redis.redisUrl, '', 'Missing URL must disable Redis rather than connect to localhost');
  console.log('PASS: namespaced Refund Redis configuration and disabled default');
} finally {
  if (previous === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = previous;
}
