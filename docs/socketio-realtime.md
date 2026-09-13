# Real-Time Communication (Socket.IO)

This document describes the real-time communication architecture implemented in Phase 7 of the microservices migration.

## 1. Socket.IO Server Location

The Socket.IO server lives entirely within the **Messaging Service** (`port 3004`).
- It binds to the same HTTP server that handles the REST API for messages.
- It is responsible for tracking online users, mapping `userId` to `socket.id`, and broadcasting real-time events.

## 2. API Gateway Routing

The API Gateway (`port 8000`) acts as a reverse proxy for Socket.IO traffic.
- It routes all traffic starting with `/socket.io` to the Messaging Service.
- It fully supports WebSocket upgrades (`ws: true`).
- The gateway passes all cookies and HTTP headers transparently during the handshake, ensuring authentication works.

## 3. Authentication Mechanism

Socket.IO connections are authenticated securely using the existing **JWT** (JSON Web Token) infrastructure.
- The frontend connects with `withCredentials: true`, sending the auth cookie.
- A custom Socket.IO middleware in `messaging-service/socket.js` intercepts the connection.
- It parses the `cookie` header, extracts the `token`, and verifies it against `JWT_SECRET`.
- If valid, the `userId` is extracted from the decoded token and attached to the socket object. This prevents clients from spoofing their identity.

## 4. Main Real-Time Events

- `connection`: Fired when a client connects. The server binds the authenticated `userId` to the `socket.id`.
- `disconnect`: Fired when a client disconnects. The server removes the `socket.id` mapping.
- `getOnlineUsers`: Broadcast to all clients whenever someone connects or disconnects to update presence indicators.
- `newMessage`: Emitted to a specific user's socket when they receive a new direct message.
- `newNotification`: Emitted to a specific user's socket when a notification (like, comment, follow) is generated for them.

## 5. Message Delivery Flow

1. User A sends a message to User B via HTTP `POST /api/message/send/:receiverId`.
2. The Gateway routes this to the Messaging Service.
3. The Messaging Service validates the request, uploads images (if any) to Cloudinary, and persists the message and conversation in MongoDB.
4. The Messaging Service looks up User B in the `userSocketMap`.
5. If User B is connected, it calls `io.to(receiverSocketId).emit("newMessage", newMessage)`.
6. User B receives the event in real-time.

## 6. Connection/Reconnection Behavior

- **Reconnection**: If the network drops, Socket.IO client automatically tries to reconnect. The server's JWT middleware will re-authenticate the user silently using their cookies.
- **Multiple Connections**: The current implementation maps one `userId` to exactly one `socket.id`. If a user connects on a second tab, the first mapping is overwritten (the second tab will receive subsequent events).

## 7. Offline Recipient Behavior

- If User B is offline (not in `userSocketMap`), the real-time emit is simply skipped.
- The message is fully persisted in MongoDB during step 3.
- When User B comes online later, their client makes standard HTTP requests (`GET /api/message/getAll/:receiverId`) to fetch their historical messages. Socket.IO is strictly for real-time pushing, not for guaranteed message queuing.

## 8. Relationship Between Kafka and Socket.IO

- **Kafka** is the durable asynchronous event broker for backend-to-backend communication (e.g., Content Service publishing `POST_LIKED`, Notification Service consuming it).
- **Socket.IO** is the ephemeral real-time transport for backend-to-frontend communication.

## 9. Why Redis is NOT used for Socket.IO

In this architecture, Redis is strictly used for **caching** (e.g., user profiles and posts). It is explicitly NOT used for Socket.IO because:
1. **No Distributed Sockets**: We do not run multiple instances of the Messaging Service that need to coordinate socket state. A single instance manages all `socket.id` mappings.
2. **Complexity**: Introducing `redis-socket.io-adapter` adds unnecessary moving parts and failure modes for a deployment that doesn't currently require horizontally scaling the socket server.
3. **Separation of Concerns**: Keeping Redis focused on fast-read caching prevents real-time messaging volatility from affecting core application performance.
