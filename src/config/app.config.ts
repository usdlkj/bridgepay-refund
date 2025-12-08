export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  alertDedupMs: process.env.ALERT_DEDUP_MS || 30000,
  jwtSecret: process.env.JWT_SECRET || 'YCBqMzRNatsECcf3TnWU2r4SJs74Xsay',
  logsFolder: process.env.LOGS_FOLDER,
  ticketingApiBaseUrl:
    process.env.TICKETING_API_BASE_URL || 'http://8.210.58.52:9432',
  bankAccountCheckTtlDays: parseInt(
    process.env.BANK_ACCOUNT_CHECK_TTL_DAYS || '10',
    10,
  ),
  iluma: {
    baseUrl: process.env.ILUMA_BASE_URL || 'https://api.iluma.com',
    token: process.env.ILUMA_TOKEN || '',
    checkAccountWaitMs: parseInt(
      process.env.CHECK_ACCOUNT_MAX_WAIT_MS || '7000',
      10,
    ),
    checkAccountMinSleepMs: parseInt(
      process.env.CHECK_ACCOUNT_MIN_SLEEP_MS || '500',
      10,
    ),
    checkAccountMaxSleepMs: parseInt(
      process.env.CHECK_ACCOUNT_MAX_SLEEP_MS || '2000',
      10,
    ),
  },
  credentialEncryptionKey:
    process.env.CREDENTIAL_ENCRYPTION_KEY || 'bridgepay2020',
});
