export default () => ({
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    refundQueue: process.env.RABBITMQ_QUEUE || 'bridgepay-refund',
    coreQueue: process.env.RABBITMQ_QUEUE_CORE || 'bridgepay-core'
  },
});