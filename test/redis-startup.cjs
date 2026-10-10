// Existing local dependencies only; no payout, provider or ticketing requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const env = require('dotenv').parse(fs.readFileSync(process.env.REFUND_STARTUP_ENV_FILE || path.join(root, '.env')));
if (process.env.REFUND_STARTUP_DATABASE) env.DB_DATABASE = process.env.REFUND_STARTUP_DATABASE;
const local = host => ['127.0.0.1', 'localhost'].includes(host);
assert.ok(local(env.DB_HOST), 'Local PostgreSQL only');
assert.ok(local(new URL(env.RABBITMQ_URL).hostname), 'Local RabbitMQ only');
const Redis = require('ioredis');
const amqp = require('amqplib');
const id = crypto.randomUUID();
const username = `refund-startup-${id}`;
const password = crypto.randomBytes(32).toString('hex');
const queue = username;
const cacheKey = `startup-${id}`;
const rules = JSON.parse(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
const admin = new Redis({ host: '127.0.0.1', port: 6379, password: 'redis', maxRetriesPerRequest: 0 });
let app, broker, userCreated = false;

(async () => {
  try {
    // Redis selectors must each remain a single ACL argument.
    const tokens = rules.refund.split(' ').reduce((args, token) => {
      if (token.startsWith('(')) args.push(token);
      else if (args.at(-1)?.startsWith('(') && !args.at(-1).endsWith(')')) args[args.length - 1] += ' ' + token;
      else args.push(token);
      return args;
    }, []);
    await admin.acl('SETUSER', username, 'reset', `>${password}`, ...tokens);
    userCreated = true;
    const url = `redis://${username}:${password}@127.0.0.1:6379/0`;
    Object.assign(process.env, env, {
      NODE_ENV: 'development', LOGS_FOLDER: '', REDIS_URL: url,
      RABBITMQ_QUEUE: queue, RABBITMQ_CORE_QUEUE: `${queue}-core`,
      RABBITMQ_ENCRYPTOR_QUEUE: `${queue}-encryptor`,
    });
    const { NestFactory } = require('@nestjs/core');
    const { Transport } = require('@nestjs/microservices');
    const { ConfigService } = require('@nestjs/config');
    const { CACHE_MANAGER } = require('@nestjs/cache-manager');
    const { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.init();
    assert.equal(app.get(ConfigService).get('redis.redisUrl'), url, 'App must register Redis configuration');
    const cache = app.get(CACHE_MANAGER);
    await cache.set(cacheKey, { synthetic: true }, 10000);
    assert.deepEqual(await cache.get(cacheKey), { synthetic: true });
    const keys = [];
    let cursor = '0';
    do {
      const [next, found] = await admin.scan(cursor, 'MATCH', `bridgepay:refund:cache:*${cacheKey}*`, 'COUNT', 100);
      cursor = next;
      keys.push(...found);
    } while (cursor !== '0');
    assert.equal(keys.length, 1, 'Cache must reach Redis rather than silently fall back to memory');
    assert.ok(await admin.pttl(keys[0]) > 0, 'Redis cache must expire');
    await cache.del(cacheKey);
    broker = await amqp.connect(env.RABBITMQ_URL);
    app.connectMicroservice({ transport: Transport.RMQ, options: {
      urls: [env.RABBITMQ_URL], queue, queueOptions: { durable: true }, noAck: true,
    } });
    await app.startAllMicroservices();
    await app.listen(0, '127.0.0.1');
    const response = await fetch(await app.getUrl(), { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    const channel = await broker.createChannel();
    assert.equal((await channel.checkQueue(queue)).consumerCount, 1);
    console.log('PASS Refund app initialization, registered Redis config, scoped Redis cache/TTL, HTTP and isolated RabbitMQ consumer');
  } finally {
    if (app) {
      const { CACHE_MANAGER } = require('@nestjs/cache-manager');
      const cache = app.get(CACHE_MANAGER);
      await cache.del(cacheKey);
      await app.close();
      await cache.disconnect();
    }
    if (broker) {
      const channel = await broker.createChannel();
      await channel.deleteQueue(queue);
      await broker.close();
    }
    if (userCreated) await admin.acl('DELUSER', username);
    await admin.quit();
  }
})().catch(() => {
  console.error('FAIL Refund startup check; credential details suppressed');
  process.exitCode = 1;
});
