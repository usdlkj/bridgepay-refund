export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  alertDedupMs: process.env.ALERT_DEDUP_MS || 30000,
  jwtSecret: process.env.JWT_SECRET || 'YCBqMzRNatsECcf3TnWU2r4SJs74Xsay',
  ilumaToken:
    process.env.ILUMA_TOKEN ||
    'iluma_development_t8kz0E2xEjjN7PiSBnFS045HQEFj2VSMF3udWckOCpKn8tT9pHsXahlteBL',
  logsFolder: process.env.LOGS_FOLDER || 'logs',
  blindIndexSecretKey:
    process.env.BLIND_INDEX_SECRET_KEY || 'default_blind_index_key',
  awsKmsKeyId: process.env.AWS_KMS_KEY_ID || '',
  awsRegion: process.env.AWS_REGION || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY || 'key',
  backdateAccountLastCheck: process.env.BACKDATE_ACCOUNT_LAST_CHECK || 30,
  ticketingApiBaseUrl:
    process.env.TICKETING_API_BASE_URL || 'http://8.210.58.52:9432',
  checkAccountWaitingTIme:process.env.CHECK_ACCOUNT_WAITING_TIME||600000
});
