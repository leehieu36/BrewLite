# Backend tests

## Unit tests (business logic)

```bash
npm test
```

Covers loyalty-point payment, insufficient balance, duplicate payment prevention, points earned on order completion, and exact points refund on cancellation.

## HTTP/API tests

```bash
npm run test:e2e
```

Starts an in-memory Nest HTTP application. The JWT guard is replaced with a test-only identity; the real `RolesGuard` and controllers remain active. These tests cover the health endpoint and role restrictions for order cancellation, order status updates, and payment confirmation. They do not require a real PostgreSQL database.

The service tests mock Prisma transaction methods to isolate business rules. They are not a substitute for a separate end-to-end test against a disposable PostgreSQL database.
