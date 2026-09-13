# VIBE - API Documentation

Base URL: `http://localhost:8000/api`

---

## 🔐 Authentication Endpoints

### Sign Up
**Endpoint:** `POST /auth/signup`

**Request Body:**
```json
{
  "name": "John Doe",
  "userName": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "userName": "johndoe",
    "email": "john@example.com"
  }
}
```

### Sign In
**Endpoint:** `POST /auth/signin`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "userName": "johndoe",
    "email": "john@example.com",
    "profileImage": "https://cloudinary.com/...",
    "bio": "Software Developer",
    "followers": [],
    "following": [],
    "posts": [],
    "saved": []
  }
}
```

### Forgot Password
**Endpoint:** `POST /auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

### Reset Password
**Endpoint:** `POST /auth/reset-password`

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## 👤 User Endpoints

### Get User Profile
**Endpoint:** `GET /user/profile/:userName`

**Parameters:**
- `userName` (string) - Username to fetch

**Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "userName": "johndoe",
    "email": "john@example.com",
    "profileImage": "https://cloudinary.com/...",
    "bio": "Software Developer",
    "profession": "Full Stack Developer",
    "gender": "Male",
    "followers": ["507f1f77bcf86cd799439012"],
    "following": ["507f1f77bcf86cd799439013"],
    "posts": ["607f1f77bcf86cd799439011"],
    "saved": [],
    "loops": ["607f1f77bcf86cd799439012"]
  }
}
```

### Edit Profile
**Endpoint:** `POST /user/edit-profile`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
name: "John Doe"
bio: "Software Engineer"
profession: "Full Stack Developer"
gender: "Male"
profileImage: <file>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "bio": "Software Engineer",
    "profession": "Full Stack Developer",
    "profileImage": "https://cloudinary.com/..."
  }
}
```

### Follow User
**Endpoint:** `POST /user/follow/:userId`

**Headers:**
```
Authorization: Bearer {token}
```

**Parameters:**
- `userId` (ObjectId) - User ID to follow

**Response (200):**
```json
{
  "success": true,
  "message": "User followed successfully",
  "following": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
}
```

### Unfollow User
**Endpoint:** `POST /user/unfollow/:userId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User unfollowed successfully"
}
```

### Get Followers
**Endpoint:** `GET /user/followers`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "followers": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Jane Smith",
      "userName": "janesmith",
      "profileImage": "https://cloudinary.com/..."
    }
  ]
}
```

### Get Following List
**Endpoint:** `GET /user/following`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "following": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Bob Johnson",
      "userName": "bobjohnson",
      "profileImage": "https://cloudinary.com/..."
    }
  ]
}
```

### Get Suggested Users
**Endpoint:** `GET /user/suggested`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "suggestedUsers": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Alice Brown",
      "userName": "alicebrown",
      "profileImage": "https://cloudinary.com/...",
      "bio": "Designer"
    }
  ]
}
```

---

## 📸 Post Endpoints

### Create Post
**Endpoint:** `POST /post/create`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
media: <file>
mediaType: "image"
caption: "Beautiful sunset!"
```

**Response (201):**
```json
{
  "success": true,
  "message": "Post created successfully",
  "post": {
    "_id": "607f1f77bcf86cd799439011",
    "author": "507f1f77bcf86cd799439011",
    "mediaType": "image",
    "media": "https://cloudinary.com/...",
    "caption": "Beautiful sunset!",
    "likes": [],
    "comments": [],
    "createdAt": "2024-04-23T10:30:00Z"
  }
}
```

### Get All Posts
**Endpoint:** `GET /post/all`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (number, optional) - Page number for pagination
- `limit` (number, optional) - Posts per page

**Response (200):**
```json
{
  "success": true,
  "posts": [
    {
      "_id": "607f1f77bcf86cd799439011",
      "author": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "userName": "johndoe",
        "profileImage": "https://cloudinary.com/..."
      },
      "mediaType": "image",
      "media": "https://cloudinary.com/...",
      "caption": "Beautiful sunset!",
      "likes": ["507f1f77bcf86cd799439012"],
      "comments": [
        {
          "author": "507f1f77bcf86cd799439012",
          "message": "Great shot!"
        }
      ],
      "createdAt": "2024-04-23T10:30:00Z"
    }
  ],
  "total": 45
}
```

### Get Single Post
**Endpoint:** `GET /post/:postId`

**Parameters:**
- `postId` (ObjectId) - Post ID

**Response (200):**
```json
{
  "success": true,
  "post": {
    "_id": "607f1f77bcf86cd799439011",
    "author": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "userName": "johndoe",
      "profileImage": "https://cloudinary.com/..."
    },
    "mediaType": "image",
    "media": "https://cloudinary.com/...",
    "caption": "Beautiful sunset!",
    "likes": ["507f1f77bcf86cd799439012"],
    "comments": []
  }
}
```

### Like Post
**Endpoint:** `POST /post/like/:postId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Post liked",
  "likes": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
}
```

### Comment on Post
**Endpoint:** `POST /post/comment/:postId`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Great photo!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Comment added successfully",
  "comments": [
    {
      "author": "507f1f77bcf86cd799439011",
      "message": "Great photo!"
    }
  ]
}
```

### Save Post
**Endpoint:** `POST /post/save/:postId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Post saved successfully"
}
```

### Delete Post
**Endpoint:** `DELETE /post/:postId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

---

## 🎬 Loop Endpoints

### Create Loop
**Endpoint:** `POST /loop/create`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
media: <video-file>
caption: "Check out this awesome clip!"
```

**Response (201):**
```json
{
  "success": true,
  "message": "Loop created successfully",
  "loop": {
    "_id": "607f1f77bcf86cd799439012",
    "author": "507f1f77bcf86cd799439011",
    "media": "https://cloudinary.com/...",
    "caption": "Check out this awesome clip!",
    "likes": [],
    "comments": [],
    "createdAt": "2024-04-23T11:45:00Z"
  }
}
```

### Get All Loops
**Endpoint:** `GET /loop/all`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "loops": [
    {
      "_id": "607f1f77bcf86cd799439012",
      "author": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "userName": "johndoe",
        "profileImage": "https://cloudinary.com/..."
      },
      "media": "https://cloudinary.com/...",
      "caption": "Check out this awesome clip!",
      "likes": [],
      "comments": []
    }
  ]
}
```

### Like Loop
**Endpoint:** `POST /loop/like/:loopId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Loop liked"
}
```

### Comment on Loop
**Endpoint:** `POST /loop/comment/:loopId`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Awesome content!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Comment added successfully"
}
```

### Delete Loop
**Endpoint:** `DELETE /loop/:loopId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Loop deleted successfully"
}
```

---

## 📖 Story Endpoints

### Create Story
**Endpoint:** `POST /story/create`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
media: <file>
mediaType: "image"
```

**Response (201):**
```json
{
  "success": true,
  "message": "Story created successfully",
  "story": {
    "_id": "607f1f77bcf86cd799439013",
    "author": "507f1f77bcf86cd799439011",
    "mediaType": "image",
    "media": "https://cloudinary.com/...",
    "viewers": [],
    "createdAt": "2024-04-23T12:00:00Z"
  }
}
```

### Get User Story
**Endpoint:** `GET /story/user/:userId`

**Parameters:**
- `userId` (ObjectId) - User ID

**Response (200):**
```json
{
  "success": true,
  "story": {
    "_id": "607f1f77bcf86cd799439013",
    "author": "507f1f77bcf86cd799439011",
    "media": "https://cloudinary.com/...",
    "viewers": ["507f1f77bcf86cd799439012"],
    "mediaType": "image",
    "createdAt": "2024-04-23T12:00:00Z"
  }
}
```

### Mark Story as Viewed
**Endpoint:** `POST /story/:storyId/view`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Story viewed successfully",
  "viewers": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
}
```

### Delete Story
**Endpoint:** `DELETE /story/:storyId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Story deleted successfully"
}
```

---

## 💬 Message Endpoints

### Send Message
**Endpoint:** `POST /message/send`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "receiver": "507f1f77bcf86cd799439012",
  "message": "Hey, how are you?",
  "image": null
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageData": {
    "_id": "707f1f77bcf86cd799439011",
    "sender": "507f1f77bcf86cd799439011",
    "receiver": "507f1f77bcf86cd799439012",
    "message": "Hey, how are you?",
    "image": null,
    "createdAt": "2024-04-23T13:00:00Z"
  }
}
```

### Get Chat History
**Endpoint:** `GET /message/:userId`

**Headers:**
```
Authorization: Bearer {token}
```

**Parameters:**
- `userId` (ObjectId) - User ID to get messages with

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "707f1f77bcf86cd799439011",
      "sender": "507f1f77bcf86cd799439011",
      "receiver": "507f1f77bcf86cd799439012",
      "message": "Hey, how are you?",
      "image": null,
      "createdAt": "2024-04-23T13:00:00Z"
    }
  ]
}
```

### Get All Conversations
**Endpoint:** `GET /message/all-conversations`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "conversations": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Jane Smith",
      "userName": "janesmith",
      "profileImage": "https://cloudinary.com/...",
      "lastMessage": "See you tomorrow!",
      "lastMessageTime": "2024-04-23T12:45:00Z"
    }
  ]
}
```

---

## 🔔 Notification Endpoints

### Get All Notifications
**Endpoint:** `GET /notification/all`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "807f1f77bcf86cd799439011",
      "sender": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Jane Smith",
        "userName": "janesmith",
        "profileImage": "https://cloudinary.com/..."
      },
      "type": "like",
      "message": "Jane liked your post",
      "post": "607f1f77bcf86cd799439011",
      "isRead": false,
      "createdAt": "2024-04-23T14:00:00Z"
    }
  ]
}
```

### Mark Notification as Read
**Endpoint:** `POST /notification/:notificationId/read`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### Delete Notification
**Endpoint:** `DELETE /notification/:notificationId`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized - please login"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid input parameters"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 🔗 Socket.io Events

### Client Events (Emit)
```javascript
// Connect to socket with user ID
socket.emit('connection', { userId: 'user_id' });

// Send message
socket.emit('sendMessage', { receiver: 'receiver_id', message: 'text' });

// Typing indicator
socket.emit('typing', { receiver: 'receiver_id' });
```

### Server Events (Listen)
```javascript
// Get online users list
socket.on('getOnlineUsers', (users) => {
  console.log('Online users:', users);
});

// Receive new message
socket.on('receiveMessage', (message) => {
  console.log('New message:', message);
});

// Receive notification
socket.on('newNotification', (notification) => {
  console.log('New notification:', notification);
});
```

---

**Last Updated:** April 23, 2026
