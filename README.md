# Real-Time Chat Application

A full-stack real-time chat application built with React, TypeScript, Node.js, Express, and Socket.IO.


https://github.com/user-attachments/assets/87707fb0-2c32-4966-8468-643be7805147




## Features

- **Real-time messaging** with Socket.IO
- **OAuth2 authentication** (Google OAuth)
- **Multiple chat rooms** with dynamic creation
- **Online user tracking** per room
- **Message history** (in-memory storage)
- **Room management** with active room listings

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO
- **Authentication**: Google OAuth2
- **Real-time Communication**: Socket.IO

## Project Structure

```
chat-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API routes
│   │   └── socket/        # Socket.IO handlers
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google OAuth2 credentials

### 1. Clone the repository
```bash
git clone <repository-url>
cd chat-app
```

### 2. Backend Setup
```bash
cd server
npm install

# Create .env file
cp .env.example .env
# Add your Google OAuth credentials to .env:
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# JWT_SECRET=your_jwt_secret
# CLIENT_URL=http://localhost:3000

npm run dev
```

### 3. Frontend Setup
```bash
cd client
npm install

# Create .env file
echo "REACT_APP_SERVER_URL=http://localhost:3001" > .env
echo "REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id" >> .env

npm start
```

### 4. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth2 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback`
   - `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your browser
2. Click "Sign in with Google" to authenticate
3. Create a new room or join an existing one
4. Start chatting in real-time!

## Architecture Overview

### Frontend Architecture
- **React with TypeScript** for type safety
- **Custom hooks** for Socket.IO connection and room management
- **Context API** for global state management (auth, socket)
- **Tailwind CSS** for rapid UI development

### Backend Architecture
- **Express.js** server with RESTful API endpoints
- **Socket.IO** for real-time bidirectional communication
- **JWT-based authentication** with Google OAuth2
- **In-memory storage** for rooms and messages (easily replaceable with DB)

### Socket.IO Events
- `join_room` - User joins a chat room
- `leave_room` - User leaves a chat room
- `send_message` - User sends a message
- `message` - Broadcast message to room
- `user_joined` - Notify when user joins
- `user_left` - Notify when user leaves
- `room_users` - Update online users list

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/verify` - Verify JWT token

### Chat Rooms
- `GET /api/rooms` - Get all active rooms
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:id/messages` - Get room message history

## What I'd Improve with More Time

### Immediate Improvements (Next 2-4 hours)
1. **Database Integration**: Replace in-memory storage with PostgreSQL/MongoDB
2. **Message Persistence**: Store chat history permanently
3. **User Profiles**: Enhanced user management and profiles
4. **File Sharing**: Image and file upload capabilities

### Medium-term Improvements (1-2 weeks)
1. **Testing Suite**: Comprehensive Jest unit tests and Cypress e2e tests
2. **Message Features**: Reactions, replies, message editing
3. **Admin Features**: Room moderation, user management
4. **Mobile Optimization**: PWA capabilities and mobile-first design

### Long-term Improvements (1+ months)
1. **Scalability**: Redis for session management, message queuing
2. **Microservices**: Split into authentication, chat, and notification services
3. **Advanced Features**: Voice/video calls, screen sharing
4. **Analytics**: User engagement metrics and room analytics

### Production Considerations
1. **Security**: Rate limiting, input validation, XSS protection
2. **Performance**: Message pagination, lazy loading, CDN
3. **Monitoring**: Error tracking, performance monitoring
4. **DevOps**: Docker containers, CI/CD pipeline, auto-scaling

## Performance Optimizations

- **Connection pooling** for database operations
- **Message batching** for high-frequency updates
- **React.memo** for preventing unnecessary re-renders
- **Debounced typing indicators**
- **Efficient state management** with useCallback and useMemo

## Security Measures

- **JWT token validation** on all protected routes
- **CORS configuration** for cross-origin requests
- **Input sanitization** to prevent XSS attacks
- **Rate limiting** on message sending
- **Secure OAuth2 implementation**

## Development Notes

This implementation prioritizes:
1. **Working functionality** over perfect optimization
2. **Clean, readable code** structure
3. **Type safety** with TypeScript
4. **Real-time performance** with efficient Socket.IO usage
5. **Scalable architecture** that can grow with requirements

The codebase is structured to be easily extendable and maintainable, with clear separation of concerns and modular components.
