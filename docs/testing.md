# Testing Architecture

This document describes the automated integration testing strategy for the Vybe microservices architecture. 

## 1. Testing Strategy

Vybe uses a **Black-Box Integration Testing** approach. Instead of complex unit tests that mock external dependencies, our test suite acts as an external client connecting directly to the **API Gateway**. 

This inherently validates:
- API Gateway routing and Proxy behavior
- Authentication Middleware
- End-to-end functionality across Service Boundaries
- Asynchronous side-effects (Kafka)
- Application caching (Redis)
- Real-time events (Socket.io)

We prioritize validating correctness and integration over superficial code coverage.

## 2. Test Categories

Tests are organized into logical domains inside the `tests/` directory:

- `api.test.js`: Validates correct proxy resolution across all major microservices (`/api/auth`, `/api/user`, `/api/post`).
- `auth.test.js`: Validates the signup and signin flows, JWT cookie assignment, and secure boundary enforcement for protected routes.
- `kafka.test.js`: Validates end-to-end asynchronous Kafka events. (e.g. `User Service` publishing a `USER_FOLLOWED` event, and the `Notification Service` consuming it to create a MongoDB record).
- `redis.test.js`: Validates that operations appropriately populate, hit, and invalidate the Redis cache.
- `socket.test.js`: Validates that real-time `Socket.io` events are correctly broadcasted and received over authenticated WebSockets.

## 3. How to Start Docker

The test suite requires the full application stack to be running locally via Docker Compose.
Run this from the project root:
```bash
docker-compose up -d
```

## 4. How to Run Tests

The testing suite uses `Jest` and `Axios`. Tests are isolated in the `tests/` directory.

```bash
cd tests
npm install
npm test
```

### Running Specific Tests
To run an individual test suite (e.g., just the authentication tests):
```bash
npx jest auth.test.js --runInBand
```

## 5. Required Environment Variables

No special `.env` files are required for the `tests/` directory itself, as the test suite is configured to target the standard local API Gateway port by default (`http://localhost:8000`).

The primary application stack (Docker Compose) relies on the standard `.env` configuration (MongoDB URI, JWT Secrets, etc.).

## 6. Important Flows Covered

1. **Gateway Proxying**: Validates that standard client requests are correctly routed to the correct backend microservice seamlessly.
2. **Real-time Messaging**: Validates that HTTP REST triggers in the Messaging Service successfully emit socket payloads directly to connected clients.
3. **Kafka Event Driven Notifications**: Validates the complete flow from an action (following a user) to the eventual creation of a notification via Kafka consumers.
4. **Redis Cache Mutations**: Validates that updating a user's profile successfully invalidates the stale Redis cache and fetches the new data.

## 7. Known Limitations

- **Rate Limiting**: Because the tests run sequentially but fast, `express-rate-limit` on the API Gateway may occasionally trigger a `429 Too Many Requests` error if you run the suite back-to-back rapidly. Wait 15 minutes or restart the `vybe-api-gateway` container to wipe its rate limit memory cache.
- **Destructive State**: The tests actively insert dummy user data into the development database.
- **Not for Load Testing**: This test suite uses Jest and is purely designed for functional correctness, not performance or stress testing.
