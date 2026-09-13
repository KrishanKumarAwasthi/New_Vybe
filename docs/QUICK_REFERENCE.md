# VIBE - Quick Reference Card

## 🚀 Quick Start Commands

### Backend
```bash
cd backend
npm install
# Edit .env with your configuration
npm run dev
# Server runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

---

## 📋 Key Features at a Glance

| Feature | Description | Status |
|---------|-------------|--------|
| 👤 User Authentication | Sign up, sign in, forgot password with OTP | ✅ Complete |
| 📸 Posts | Create, like, comment, save posts | ✅ Complete |
| 🎬 Loops | Short videos with engagement | ✅ Complete |
| 📖 Stories | 24-hour temporary content | ✅ Complete |
| 💬 Real-Time Messaging | Socket.io powered instant chat | ✅ Complete |
| 🔔 Notifications | Like, comment, follow alerts | ✅ Complete |
| 👥 Follow System | Follow/unfollow users | ✅ Complete |
| 🔍 Search | Find users | ✅ Complete |
| 💾 Save Posts | Bookmark favorite posts | ✅ Complete |

---

## 🏗️ Tech Stack Summary

**Frontend:** React 19 + Vite + Redux + Tailwind CSS + Socket.io Client  
**Backend:** Node.js + Express + MongoDB + Socket.io  
**Media:** Cloudinary  
**Authentication:** JWT + Bcryptjs  
**Email:** Nodemailer  

---

## 📱 Main Pages

- **Home** - Feed of posts from followed users
- **Profile** - User profile with posts and loops
- **Messages** - Real-time chat with users
- **Stories** - View and create stories
- **Loops** - Short video content
- **Notifications** - Activity alerts
- **Search** - Find users
- **Upload** - Create posts/loops

---

## 🔗 Important Links

| Resource | Link |
|----------|------|
| Main README | [README.md](./README.md) |
| Features | [docs/FEATURES.md](./docs/FEATURES.md) |
| API Docs | [docs/API.md](./docs/API.md) |
| Setup Guide | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| Doc Index | [docs/README.md](./docs/README.md) |

---

## 📊 Project Structure

```
VIBE/
├── backend/          # Express server
├── frontend/         # React app
├── docs/            # Documentation
│   ├── README.md
│   ├── FEATURES.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── SCREENSHOTS.md
└── README.md        # Main documentation
```

---

## 🔐 Environment Variables Needed

### Backend (.env)
```
PORT=8000
MONGODB_URI=<connection_string>
JWT_SECRET=<secret>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
EMAIL_USER=<email>
EMAIL_PASS=<password>
FRONTEND_URL=http://localhost:5173
```

---

## 💾 Database Models

1. **User** - Name, email, password, profile, followers, following
2. **Post** - Author, media, caption, likes, comments
3. **Loop** - Author, media, caption, likes, comments
4. **Story** - Author, media, viewers, 24-hour expiry
5. **Message** - Sender, receiver, message, image
6. **Notification** - Sender, receiver, type, message
7. **Conversation** - Users in chat

---

## 🎯 API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /auth/signup | Register |
| POST | /auth/signin | Login |
| GET | /user/profile/:userName | Get profile |
| POST | /post/create | Create post |
| POST | /post/like/:postId | Like post |
| POST | /message/send | Send message |
| GET | /message/:userId | Get messages |
| POST | /notification/all | Get notifications |

See [docs/API.md](./docs/API.md) for complete API reference.

---

## 🔗 Socket.io Events

- `getOnlineUsers` - Get list of online users
- `sendMessage` - Send message in real-time
- `receiveMessage` - Receive message
- `newNotification` - Get notification alert

---

## 🛠️ Development Commands

```bash
# Backend
npm run dev              # Start with nodemon
npm test                 # Run tests (to be configured)

# Frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run preview          # Preview production build
```

---

## 📊 Key Metrics

- **Models:** 7
- **API Endpoints:** 40+
- **Frontend Pages:** 12+
- **Components:** 15+
- **Custom Hooks:** 8
- **Redux Slices:** 7

---

## ✅ Checklist for Setup

- [ ] Clone repository
- [ ] Install backend dependencies
- [ ] Create backend .env file
- [ ] Set up MongoDB connection
- [ ] Configure Cloudinary
- [ ] Configure Nodemailer
- [ ] Install frontend dependencies
- [ ] Start backend server
- [ ] Start frontend server
- [ ] Test signup/login
- [ ] Test create post
- [ ] Test messaging
- [ ] Test stories

---

## 🎓 Learning Path

1. **Understand Architecture** - Read [README.md](./README.md)
2. **Learn Features** - Read [docs/FEATURES.md](./docs/FEATURES.md)
3. **Explore API** - Study [docs/API.md](./docs/API.md)
4. **Setup Locally** - Follow [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
5. **Start Coding** - Make changes in src/

---

## 🚀 Deployment Checklist

- [ ] Set production environment variables
- [ ] Disable CORS wildcard (set specific origins)
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure error logging
- [ ] Set up monitoring
- [ ] Create .env.production
- [ ] Build frontend: `npm run build`
- [ ] Deploy to hosting service
- [ ] Test all features in production

---

## 🐛 Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Port already in use | Change PORT in .env or kill process |
| MongoDB connection failed | Check connection string and network access |
| CORS error | Verify FRONTEND_URL in backend .env |
| Socket.io not connecting | Ensure backend is running |
| Cloudinary upload fails | Check API credentials |

---

## 📞 Need Help?

1. Check [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) troubleshooting section
2. Review [docs/API.md](./docs/API.md) for endpoint details
3. Read [docs/FEATURES.md](./docs/FEATURES.md) for feature explanations
4. Check logs in terminal/console

---

**Ready to start? Begin with `npm install` in both folders!** 🎉

**Last Updated:** April 23, 2026
