export default () => ({
  redis: {
    redisUrl: process.env.REDIS_URL || '',
  },
});
