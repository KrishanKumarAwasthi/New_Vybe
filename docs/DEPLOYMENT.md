# VIBE - Setup & Deployment Guide

## 🛠️ Local Development Setup

### Prerequisites
- Node.js (v14+) and npm
- MongoDB (local or MongoDB Atlas)
- Cloudinary account
- Gmail account (for email service)

### Step-by-Step Setup

#### 1. Clone Repository
```bash
git clone <repository-url>
cd VIBE
```

#### 2. Backend Configuration

```bash
cd backend
npm install
```

Create `.env` file in backend directory:
```env
PORT=8000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vibe
JWT_SECRET=your_secret_key_here_min_32_chars
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

**Setting up Cloudinary:**
1. Go to cloudinary.com
2. Sign up for free account
3. Get API credentials from dashboard
4. Add to .env file

**Setting up Gmail:**
1. Enable 2-factor authentication on Gmail
2. Generate app-specific password
3. Use app password in EMAIL_PASS

**Setting up MongoDB:**
```bash
# Option 1: Local MongoDB
mongod

# Option 2: MongoDB Atlas (recommended)
# Go to mongodb.com/cloud/atlas
# Create cluster and get connection string
```

Start backend:
```bash
npm run dev
```

Backend will run on `http://localhost:8000`

#### 3. Frontend Configuration

```bash
cd frontend
npm install
```

The frontend is pre-configured to connect to `http://localhost:8000`

Start frontend:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

#### 4. Access the Application
- Navigate to `http://localhost:5173`
- Sign up for a new account
- Start exploring VIBE!

---

## 🐳 Docker Deployment (Optional)

### Docker Setup

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8000

CMD ["node", "index.js"]
```

Create `frontend/Dockerfile`:
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Create `docker-compose.yml` in root:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: vibe
    volumes:
      - mongo_data:/data/db

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/vibe
      - JWT_SECRET=${JWT_SECRET}
      - CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
      - CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
      - CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASS=${EMAIL_PASS}
      - FRONTEND_URL=http://localhost:3000
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  mongo_data:
```

Run with Docker:
```bash
docker-compose up
```

---

## 🚀 Production Deployment

### Option 1: Vercel (Frontend) + Railway/Render (Backend)

#### Deploy Frontend to Vercel
1. Push code to GitHub
2. Go to vercel.com
3. Import repository
4. Set build command: `npm run build`
5. Set output directory: `dist`
6. Add environment variable: `VITE_API_URL=your_backend_url`

#### Deploy Backend to Railway
1. Go to railway.app
2. Create new project
3. Add MongoDB plugin
4. Connect GitHub repository
5. Set environment variables
6. Deploy

### Option 2: Heroku

#### Deploy Backend
```bash
heroku login
heroku create your-app-name
git push heroku main
```

Set config vars:
```bash
heroku config:set MONGODB_URI=your_connection_string
heroku config:set JWT_SECRET=your_secret
# ... other vars
```

#### Deploy Frontend to Netlify
```bash
npm run build
# Deploy dist folder to Netlify
```

### Option 3: AWS

#### Setup EC2 Instance
1. Create EC2 instance (Ubuntu)
2. Install Node.js and MongoDB
3. Clone repository
4. Set environment variables
5. Start server with PM2

```bash
# On EC2 instance
sudo apt update
sudo apt install nodejs npm mongodb

npm install -g pm2
pm2 start backend/index.js
pm2 save
```

#### Setup RDS Database
1. Create RDS instance for MongoDB
2. Update MONGODB_URI in .env
3. Configure security groups

#### Setup S3 for Media
Replace Cloudinary with AWS S3:
```bash
npm install aws-sdk
```

Configure in backend with S3 credentials.

---

## 🔧 Environment Variables Checklist

### Backend (.env)
- [ ] PORT - Server port (default: 8000)
- [ ] MONGODB_URI - MongoDB connection string
- [ ] JWT_SECRET - JWT signing secret (min 32 chars)
- [ ] CLOUDINARY_CLOUD_NAME - Cloudinary cloud name
- [ ] CLOUDINARY_API_KEY - Cloudinary API key
- [ ] CLOUDINARY_API_SECRET - Cloudinary API secret
- [ ] EMAIL_USER - Gmail address
- [ ] EMAIL_PASS - Gmail app password
- [ ] FRONTEND_URL - Frontend URL
- [ ] NODE_ENV - development/production

### Frontend
- [ ] VITE_API_URL - Backend API URL (production only)

---

## 📊 Database Backup

### MongoDB Atlas Backup
1. Go to MongoDB Atlas dashboard
2. Click "Backup"
3. Enable automated backups
4. Set backup frequency (daily recommended)
5. Configure retention policy

### Local MongoDB Backup
```bash
# Backup
mongodump --uri "mongodb://localhost:27017/vibe" --out ./backup

# Restore
mongorestore --uri "mongodb://localhost:27017/vibe" ./backup/vibe
```

---

## 🔒 Security Checklist

### Before Production
- [ ] Change JWT_SECRET to strong random string
- [ ] Enable HTTPS/SSL certificate
- [ ] Set secure CORS origins (not * )
- [ ] Enable MongoDB authentication
- [ ] Use environment variables (never commit .env)
- [ ] Enable rate limiting on API
- [ ] Set up firewall rules
- [ ] Enable logging/monitoring
- [ ] Regular security audits
- [ ] Keep dependencies updated

### Regular Maintenance
```bash
# Update all packages
npm update

# Check for vulnerabilities
npm audit
npm audit fix

# Update specific package
npm update package-name
```

---

## 🧪 Testing

### Backend Testing
```bash
# Create test files
mkdir backend/__tests__

# Install test framework
npm install --save-dev jest supertest

# Run tests
npm test
```

### Frontend Testing
```bash
# Install testing library
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest

# Run tests
npm run test
```

---

## 📈 Monitoring & Analytics

### Setup Monitoring
1. **LogRocket** - Frontend error tracking
2. **Sentry** - Error monitoring
3. **New Relic** - Application performance
4. **Google Analytics** - User analytics

```bash
# Install Sentry
npm install @sentry/react

# Initialize in main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your_sentry_dsn",
  environment: "production"
});
```

### Performance Monitoring
```bash
# Check bundle size
npm run build
# Analyze with webpack-bundle-analyzer
```

---

## 🐛 Troubleshooting

### Backend Issues

**MongoDB Connection Error**
```bash
# Check MongoDB is running
mongo --version

# Check connection string
# Ensure IP is whitelisted in MongoDB Atlas
```

**Port Already in Use**
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

**Cloudinary Upload Error**
- Check API credentials
- Verify file size limits
- Check file format support

### Frontend Issues

**CORS Error**
- Check FRONTEND_URL in backend .env
- Ensure backend is running
- Check allowed origins in socket.io

**Socket.io Connection Failed**
- Verify backend server is running
- Check socket.io port (same as backend port)
- Check firewall rules

**Build Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run build
```

---

## 📞 Support

For deployment issues, refer to:
- Node.js docs: nodejs.org
- MongoDB docs: mongodb.com/docs
- Vite docs: vitejs.dev
- React docs: react.dev
- Socket.io docs: socket.io/docs

---

## 🔄 Continuous Integration/Deployment (CI/CD)

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: |
          git config --global user.name 'Deployment Bot'
          git config --global user.email 'bot@example.com'
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

---

**Last Updated:** April 23, 2026
