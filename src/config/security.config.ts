export default () => ({
  security: {
    secMode: process.env.SECURITY_SEC_MODE || 'dev', // 'prod' | 'dev'
    kmsKeyId: process.env.SECURITY_KMS_KEY_ID,
    region: process.env.SECURITY_KMS_REGION || 'ap-southeast-3',
    localKek64: process.env.SECURITY_LOCAL_KEK64 || 'secret',
    bixSecret: process.env.SECURITY_BIX_SECRET || 'secret',
  },
});
