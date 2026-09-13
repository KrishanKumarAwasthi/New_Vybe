# VIBE - Feature Documentation

## 📸 Posts Feature

### Creating Posts
- Navigate to Upload page
- Select image or video file
- Add a caption (optional)
- Click "Post" to share
- Post appears immediately on your profile and followers' feeds

### Interacting with Posts
- **Like Posts** - Click the heart icon to like/unlike
- **Comment** - Click comment icon, type message, submit
- **Save Posts** - Bookmark posts to your saved collection
- **View Profile** - Click on author's profile to see their posts

### Post Features
- Support for images and videos
- Like count display
- Comment section with author information
- Timestamp showing when posted
- Automatic media hosting via Cloudinary

---

## 🎬 Loops (Short Videos/Reels)

### Creating Loops
- Go to Upload page
- Record or select a short video
- Add caption if desired
- Submit to create loop
- Video appears on Loops page

### Watching Loops
- Navigate to Loops section
- Infinite scroll through videos
- Like or comment on loops
- Similar UX to TikTok/Instagram Reels

### Engagement
- Like/Unlike loops
- Comment with text
- View creator profile
- Share reactions

---

## 📖 Stories Feature

### Creating Stories
- Click "Your Story" at the top of feed
- Upload image or video
- Temporary content visible for 24 hours
- No captions needed (optional)

### Viewing Stories
- Click on user profile pictures in the stories carousel
- View stories chronologically
- Auto-advance to next story after a few seconds
- See who viewed your story

### Story Expiry
- Stories automatically expire after 24 hours
- Data is automatically deleted from database
- No manual cleanup needed

### Viewer Tracking
- See list of people who viewed your story
- Useful for understanding engagement
- Stored in the `viewers` array of story document

---

## 💬 Real-Time Messaging

### Key Features

#### Connection & Online Status
- Automatically connects via Socket.io when user logs in
- Displays online/offline status for all users
- Real-time online users list updates
- User ID linked to Socket.io connection

#### Sending Messages
- Search for user in conversations
- Click to open chat
- Type message in input field
- Press Send or Enter to transmit
- Message appears immediately in chat

#### Message Types
- **Text Messages** - Regular text conversations
- **Image Messages** - Share images directly in chat
- **Timestamps** - Each message shows when sent

#### Message Features
- Message history persists in database
- Sorted by timestamp
- Displays sender/receiver info
- Real-time delivery (no refresh needed)

### Socket.io Events Used
```
- connection: Establish socket connection with user ID
- disconnect: Clean up when user logs out
- getOnlineUsers: Broadcast online users list
- sendMessage: Emit message to recipient
- receiveMessage: Receive incoming messages in real-time
```

---

## 👤 User Profiles

### Profile Information
- **Profile Picture** - Avatar displayed on all posts
- **Username** - Unique identifier
- **Bio** - Personal description
- **Profession** - Job title/occupation
- **Gender** - Personal information
- **Follower Count** - Number of followers
- **Following Count** - Number of users followed

### Profile Actions
- **Follow/Unfollow** - Build your network
- **View Posts** - See user's timeline
- **View Loops** - Watch user's video content
- **View Story** - Watch user's story
- **View Profile** - Click user's name anywhere in app
- **Edit Profile** - Update your information (your own profile)

### Edit Profile
- Navigate to Edit Profile page
- Update profile picture
- Change bio
- Update profession
- Change gender
- Save changes

---

## 🔔 Notifications System

### Notification Types

#### Likes
- Triggered when someone likes your post or loop
- Shows who liked what content
- Click to view the liked post

#### Comments
- Triggered when someone comments on your post or loop
- Shows comment preview
- Click to view the discussion

#### Follows
- Triggered when someone follows your account
- Shows follower information
- Click to view their profile

### Real-Time Notifications
- Notifications appear instantly (within milliseconds)
- Push notification via Socket.io
- Notification badge on bell icon shows count
- Notifications persist until marked as read or deleted

### Notification Center
- Dedicated page showing all notifications
- Chronologically ordered
- Mark as read/unread
- Delete individual notifications
- Clear all notifications option

---

## 🔍 Search Functionality

### Search Capabilities
- **User Search** - Find users by username
- **Search Bar** - Located in navigation
- **Real-time Results** - Results update as you type
- **Profile Links** - Click to view found users

### Using Search
1. Click search icon in navigation
2. Type username or search term
3. Browse results
4. Click profile to view details

---

## 📱 Follow System

### Following Users
- Click "Follow" button on any profile
- User appears in your Following list
- Their posts appear in your feed
- You can see their stories

### Followers
- Users who follow you
- Listed on your profile
- Click to view their profiles
- Can unfollow from their profiles

### Interaction Benefits
- See followed users' posts in feed
- Get notifications for their activity
- Direct message them
- View their stories

---

## 🛡️ Security Features

### Password Security
- Bcryptjs hashing with salt rounds
- Passwords never stored in plain text
- Salt rounds: 10 for optimal security

### Authentication
- JWT tokens for API authentication
- Tokens stored in HTTP-only cookies
- Token expiration for security
- Secure sign-out removes tokens

### OTP Verification
- Email-based OTP for password reset
- OTP expires after 30 minutes
- Prevents unauthorized password changes
- Email sent via Nodemailer

### Data Privacy
- User data protected with authentication middleware
- Only authenticated users can create content
- Private messages encrypted in transit via HTTPS
- Cloudinary media hosting with security

---

## 🖥️ Technical Features

### Frontend State Management
- Redux Toolkit for centralized state
- Persistent Redux store
- Slices for different features:
  - userSlice: User data
  - postSlice: Posts state
  - loopSlice: Loops state
  - storySlice: Stories state
  - messageSlice: Messages state
  - socketSlice: Socket.io connection
  - notificationSlice: Notifications

### API Communication
- Axios for HTTP requests
- Automatic token inclusion in headers
- Error handling with try-catch
- Proper HTTP status codes

### Performance Optimizations
- Vite bundling for fast loading
- Code splitting via React Router
- Image optimization via Cloudinary
- Lazy loading of components
- Spinner components for loading states

### Responsive Design
- Mobile-first approach
- Tailwind CSS responsive utilities
- Works on phones, tablets, desktops
- Touch-friendly buttons and spacing

---

## 🔄 Data Flow

### User Registration
1. User fills signup form
2. Frontend validates input
3. Password hashed on backend
4. User document created in MongoDB
5. JWT token generated
6. User redirected to home

### Creating a Post
1. User selects image/video
2. Frontend uploads to Cloudinary
3. Post document created with media URL
4. Post added to user's posts array
5. Post appears in followers' feeds
6. Notifications sent to followers

### Sending a Message
1. User types message
2. Click send button
3. Message emitted via Socket.io
4. Backend saves to database
5. Receiver gets real-time notification
6. Message appears in chat immediately

### Liking Content
1. User clicks like button
2. Like sent to backend
3. User ID added to likes array
4. Like count incremented
5. Notification sent to content author
6. Button changes state to "liked"

---

## 🚀 Performance Metrics

- **Load Time:** < 2 seconds for home page
- **Message Latency:** < 100ms via Socket.io
- **Media Upload:** Handled by Cloudinary CDN
- **Database Queries:** Optimized with indexing
- **Real-time Users:** Supports hundreds of concurrent users

---

## 📚 API Rate Limiting (Future Enhancement)

Currently no rate limiting implemented. Consider adding:
- Per-IP rate limiting
- Per-user rate limiting
- Endpoint-specific limits
- Sliding window implementation

---

## 🔮 Upcoming Features

- [ ] Direct message groups
- [ ] Video call integration
- [ ] Hashtag support (#hashtag)
- [ ] Post scheduling
- [ ] Content recommendation algorithm
- [ ] Story music/stickers
- [ ] Trending page
- [ ] Badge system (verified, popular creators)
- [ ] Dark/Light theme toggle
- [ ] Push notifications to mobile devices
