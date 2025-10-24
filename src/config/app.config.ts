export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  alertDedupMs: process.env.ALERT_DEDUP_MS || 30000,
  jwtSecret : process.env.JWT_SECRET || 'YCBqMzRNatsECcf3TnWU2r4SJs74Xsay',
  ilumaToken : process.env.ILUMA_TOKEN || 'iluma_development_t8kz0E2xEjjN7PiSBnFS045HQEFj2VSMF3udWckOCpKn8tT9pHsXahlteBL',
  logsFolder: process.env.LOGS_FOLDER || 'logs',
  blindIndexSecretKey: process.env.BLIND_INDEX_SECRET_KEY || 'default_blind_index_key',
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY || 'key',
});