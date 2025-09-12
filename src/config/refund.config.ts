export default () => ({
  refund:{
    baseUrl: process.env.CHECKOUT_BASE_URL || 'http://localhost:3001',
    keyFilePrivate : process.env.KEY_FILE_PRIVATE || 'midware-dev',
    keyFilePublic : process.env.KEY_FILE_PUBLIC || 'midware-dev.pub',
    keyFilePrivatePass : process.env.KEY_FILE_PRIVATE_PASS||'',
    keyFilePublicPass : process.env.KEY_FILE_PUBLIC_PASS||'',
  }

});