import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, Send, Users, Plus, LogOut } from 'lucide-react';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface Message {
  id: string;
  user: User;
  message: string;
  timestamp: string;
}

interface Room {
  id: string;
  name: string;
  userCount: number;
  users: User[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

// Auth Context
const AuthContext = React.createContext<AuthContextType | null>(null);

// Auth Provider
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token in URL (OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, '/');
    } else {
      // Check localStorage for existing token
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) {
      // Verify token with server
      fetch(`${process.env.REACT_APP_SERVER_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          logout();
        }
      })
      .catch(() => logout());
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const LoginScreen: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = `${process.env.REACT_APP_SERVER_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <MessageCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ChatApp</h1>
          <p className="text-gray-600">Connect and chat in real-time</p>
        </div>
        
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
        >
          <span>Sign in with Google</span>
        </button>
      </div>
    </div>
  );
};

// Chat Component
const ChatApp: React.FC = () => {
  const authContext = React.useContext(AuthContext);
  const { user, token, logout } = authContext!;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize socket connection
  useEffect(() => {
    if (token) {
      const newSocket = io(process.env.REACT_APP_SERVER_URL!, {
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setSocket(newSocket);
      });

      newSocket.on('message', (message: Message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('message_history', (data: { roomId: string; messages: Message[] }) => {
        setMessages(data.messages);
      });

      newSocket.on('user_joined', (data: { user: User; users: User[] }) => {
        setOnlineUsers(data.users);
      });

      newSocket.on('user_left', (data: { user: User; users: User[] }) => {
        setOnlineUsers(data.users);
      });

      newSocket.on('room_users', (data: { roomId: string; users: User[] }) => {
        setOnlineUsers(data.users);
      });

      newSocket.on('error', (error: string) => {
        console.error('Socket error:', error);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [token]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }, [token]);

  // Load rooms
  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token, fetchRooms]);

  // Scroll to bottom when new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newRoomName })
      });
      
      if (response.ok) {
        setNewRoomName('');
        setShowCreateRoom(false);
        fetchRooms();
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const joinRoom = (roomId: string) => {
    if (socket && roomId !== currentRoom) {
      socket.emit('join_room', roomId);
      setCurrentRoom(roomId);
      setMessages([]);
    }
  };

  const sendMessage = () => {
    if (!socket || !currentRoom || !newMessage.trim()) return;

    socket.emit('send_message', {
      roomId: currentRoom,
      message: newMessage
    });
    
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getCurrentRoomName = () => {
    const room = rooms.find(r => r.id === currentRoom);
    return room?.name || 'Select a room';
  };

  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-blue-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={user?.picture}
                alt={user?.name}
                className="w-8 h-8 rounded-full"
              />
              <div>
                <div className="font-semibold">{user?.name}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-blue-600 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rooms */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Rooms</h3>
              <button
                onClick={() => setShowCreateRoom(true)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showCreateRoom && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                  onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={createRoom}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateRoom(false)}
                    className="px-3 py-1 bg-gray-300 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => joinRoom(room.id)}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    currentRoom === room.id
                      ? 'bg-blue-100 border-l-4 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{room.name}</div>
                  <div className="text-sm text-gray-500 flex items-center">
                    <Users className="w-3 h-3 mr-1" />
                    {room.userCount} online
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Online Users */}
        {currentRoom && onlineUsers.length > 0 && (
          <div className="border-t border-gray-200 p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Online Users</h4>
            <div className="space-y-2">
              {onlineUsers.map((u) => (
                <div key={u.id} className="flex items-center space-x-2">
                  <img
                    src={u.picture}
                    alt={u.name}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm">{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h2 className="font-semibold text-lg">{getCurrentRoomName()}</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentRoom ? (
            messages.map((message) => (
              <div key={message.id} className="flex space-x-3">
                <img
                  src={message.user.picture}
                  alt={message.user.name}
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold">{message.user.name}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    {message.message}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a room to start chatting</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        {currentRoom && (
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthContext.Consumer>
        {(auth) => (
          auth?.user ? <ChatApp /> : <LoginScreen />
        )}
      </AuthContext.Consumer>
    </AuthProvider>
  );
};

export default App;