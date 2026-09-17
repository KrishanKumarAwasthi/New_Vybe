# Vybe — Local Development Guide

## Prerequisites

| Software | Version | Purpose |
|---|---|---|
| **Docker Desktop** | 4.x+ | Container runtime for all services and infrastructure |
| **Docker Compose** | v2 (included in Docker Desktop) | Multi-container orchestration |
| **Node.js** | 22.x | Frontend dev server (runs outside Docker) |
| **npm** | 11.x | Package management |

> [!IMPORTANT]
> Docker Desktop must be installed and running before starting the backend services.
> Download from: https://www.docker.com/products/docker-desktop/

---

## Project Structure

```
new_vybe/
├── frontend/                   # React SPA (runs locally with Vite)
├── backend/                    # Original monolith (preserved for reference)
├── services/                   # Microservices
│   ├── api-gateway/            # Reverse proxy (Port 8000)
│   ├── auth-service/           # Authentication (Port 3001)
│   ├── user-service/           # Profiles & social graph (Port 3002)
│   ├── content-service/        # Posts, Loops, Stories (Port 3003)
│   ├── messaging-service/      # Chat & Socket.io (Port 3004)
│   ├── notification-service/   # Event-driven notifications (Port 3005)
│   └── shared/                 # Shared constants (not a service)
├── docker-compose.yml          # Orchestration file
└── docs/                       # Documentation
```

---

## Quick Start (Full System)

### 1. Start all backend services and infrastructure

```bash
docker compose up --build
```

This starts:
- **MongoDB** on internal port 27017
- **Redis** on internal port 6379
- **Kafka** (KRaft mode) on internal port 9092
- **API Gateway** on **port 8000** (exposed to host)
- **Auth Service** on internal port 3001
- **User Service** on internal port 3002
- **Content Service** on internal port 3003
- **Messaging Service** on internal port 3004
- **Notification Service** on internal port 3005

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and communicates with the API Gateway at `http://localhost:8000`.

### 3. Open the app

Navigate to: **http://localhost:5173**

---

## Service Health Checks

Each service exposes a `/health` endpoint. You can verify them through the gateway:

```bash
# Direct health checks (only gateway is exposed to host)
curl http://localhost:8000/health

# Through internal network (from another container)
curl http://auth-service:3001/health
curl http://user-service:3002/health
curl http://content-service:3003/health
curl http://messaging-service:3004/health
curl http://notification-service:3005/health
```

---

## Common Docker Commands

### Start everything
```bash
docker compose up --build
```

### Start everything (detached / background)
```bash
docker compose up --build -d
```

### Stop everything
```bash
docker compose down
```

### Stop everything and remove volumes (CAUTION: destroys data)
```bash
docker compose down -v
```

### Rebuild a single service
```bash
docker compose up --build auth-service
```

### View logs for a specific service
```bash
docker compose logs -f auth-service
docker compose logs -f api-gateway
docker compose logs -f messaging-service
```

### Restart a single service
```bash
docker compose restart user-service
```

### Open a shell inside a container
```bash
docker compose exec auth-service sh
docker compose exec mongodb mongosh
docker compose exec redis redis-cli
```

---

## Starting Individual Services (Without Docker)

For rapid iteration on a single service, you can run it directly with Node.js while keeping infrastructure in Docker:

### 1. Start only infrastructure
```bash
docker compose up mongodb redis kafka
```

### 2. Run a service locally
```bash
cd services/auth-service
npm install
npm run dev
```

> [!NOTE]
> When running a service outside Docker, update its `.env` file to use `localhost` instead of Docker service names:
> ```
> MONGODB_URL=mongodb://localhost:27017/socialMedia
> REDIS_URL=redis://localhost:6379
> KAFKA_BROKERS=localhost:9092
> ```
> You'll also need to expose the infrastructure ports in `docker-compose.yml`.

---

## Service Map

| Service | Internal Port | Exposed Port | Docker Service Name | Description |
|---|---|---|---|---|
| MongoDB | 27017 | — | `mongodb` | Primary database |
| Redis | 6379 | — | `redis` | Cache |
| Kafka | 9092 | — | `kafka` | Async event bus |
| API Gateway | 8000 | **8000** | `api-gateway` | Client entry point |
| Auth Service | 3001 | — | `auth-service` | Authentication |
| User Service | 3002 | — | `user-service` | Profiles & graph |
| Content Service | 3003 | — | `content-service` | Posts/Loops/Stories |
| Messaging Service | 3004 | — | `messaging-service` | Chat & WebSocket |
| Notification Service | 3005 | — | `notification-service` | Notifications |

---

## Environment Variables

Each service has its own `.env` file. The `.env.example` file in each service directory shows all required variables.

### Shared across services

| Variable | Description | Used By |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string | All services |
| `JWT_SECRET` | JWT signing/verification secret | Auth, User, Content, Messaging, Notification |
| `REDIS_URL` | Redis connection string | User, Content, Messaging, Notification |
| `KAFKA_BROKERS` | Kafka broker addresses | User, Content, Messaging, Notification |

### Service-specific

| Variable | Description | Used By |
|---|---|---|
| `EMAIL` | Gmail address for OTP emails | Auth Service |
| `EMAIL_PASS` | Gmail app password | Auth Service |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | User, Content, Messaging |
| `CLOUDINARY_API_KEY` | Cloudinary API key | User, Content, Messaging |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | User, Content, Messaging |
| `FRONTEND_URL` | Frontend origin for CORS | API Gateway, Messaging |

### Docker Compose overrides

The `docker-compose.yml` sets infrastructure URLs using Docker service names (e.g., `mongodb://mongodb:27017/socialMedia`). These override the `.env` defaults.

---

## Network Architecture

All services communicate through Docker's internal `vybe-network` bridge network:

```
┌────────────────────── Docker Network: vybe-network ──────────────────────┐
│                                                                          │
│   mongodb:27017   redis:6379   kafka:9092                               │
│        │               │            │                                    │
│   ┌────┴───────────────┴────────────┴────────────────────┐              │
│   │                                                      │              │
│   │   auth-service:3001    user-service:3002              │              │
│   │   content-service:3003 messaging-service:3004         │              │
│   │   notification-service:3005                           │              │
│   │                                                      │              │
│   └──────────────────────┬───────────────────────────────┘              │
│                          │                                               │
│                  api-gateway:8000                                        │
│                                                                          │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
                    Exposed to host
                    (:8000 → localhost:8000)
                           │
                    Frontend (:5173)
```

Only port **8000** (API Gateway) is exposed to the host machine. All inter-service communication stays within Docker's internal network.

---

## Troubleshooting

### Kafka takes too long to start
Kafka with KRaft mode needs ~30 seconds to initialize. Other services that depend on Kafka will wait for its health check to pass before starting.

### MongoDB connection refused
Make sure the MongoDB container is healthy before starting services:
```bash
docker compose ps
```

### Port conflicts
If port 8000 is already in use (e.g., the old monolith is running), stop it first:
```bash
# Kill any process on port 8000
npx kill-port 8000
```

### Rebuilding from scratch
```bash
docker compose down -v
docker compose up --build
```
