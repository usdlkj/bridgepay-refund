# T04 Refund RabbitMQ delivery

Refund's shared RabbitMQ consumer uses manual acknowledgement with a prefetch limit of 10. Every registered RPC and the Iluma polling event acknowledges only after its handler returns. Before processing any delivery, Refund declares two durable failure queues:

The HTTP server starts only after the RabbitMQ consumer connects. If it cannot start, the process fails instead of reporting HTTP readiness.

- `${RABBITMQ_QUEUE}.retry`: holds failed Xendit callbacks and Iluma polling events for 60 seconds, then dead-letters them back to the main Refund queue. Three delayed retries are allowed after the first attempt.
- `${RABBITMQ_QUEUE}.failed`: retains a fourth failed callback or polling event. Failed payout and other RPC requests go here after their first failed attempt; broker retries must not initiate another payout.

Refund publishes the original message to the replacement queue as persistent and waits for broker confirmation before acknowledging the original. If it cannot declare the queues or confirm the replacement, the original remains unacknowledged. The broker account must be able to declare and publish to both suffix queues and consume the main queue. Preserve the failed queue for investigation; reconcile payout state with Xendit before any manual replay. These queues can contain provider callback data and require the same access controls as the main queue.

This change protects work after it reaches Refund. Gateway's refund webhook still returns `OK` before its Refund RPC is confirmed. That separate Gateway handoff must be fixed before closing T04. A coordinated staging test must verify the actual broker's queue arguments, delayed return, failure retention, consumer restart and idempotent payout behavior before release. The existing local payout and notification recovery migrations must be applied before their accompanying Refund code is deployed.
