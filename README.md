# Volleyball 3v3 Game

A real-time multiplayer 3v3 volleyball game built with React, Express, Socket.io, and Supabase.

## Project Structure

```
volleyball-3v3/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── Auth/    # Authentication components
│   │   │   ├── Game/    # Game components
│   │   │   ├── Lobby/   # Lobby components
│   │   │   └── Character/ # Character selection components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API and socket services
│   │   │   ├── supabase.js
│   │   │   └── socket.js
│   │   ├── utils/       # Utility functions
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/             # Express backend
│   ├── src/
│   │   ├── config/     # Configuration files
│   │   │   └── supabase.js
│   │   ├── controllers/ # Route controllers
│   │   ├── services/   # Business logic
│   │   │   ├── matchmaking.js
│   │   │   └── gameRoom.js
│   │   ├── socket/     # Socket.io handlers
│   │   │   └── socketHandler.js
│   │   └── server.js   # Main server file
│   ├── .env
│   └── package.json
│
├── .gitignore
└── README.md
```

## Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **Socket.io Client** - Real-time communication
- **Supabase** - Authentication and database

### Backend
- **Express** - Web server
- **Socket.io** - WebSocket server
- **Supabase** - Authentication and database
- **Node.js** - Runtime environment

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd volleyball-3v3
```

2. Install client dependencies
```bash
cd client
npm install
```

3. Install server dependencies
```bash
cd ../server
npm install
```

### Configuration

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Configure server environment variables in `server/.env`:
```env
PORT=3001
CLIENT_URL=http://localhost:5173
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

3. Configure client environment variables in `client/.env`:
```env
VITE_SOCKET_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the Application

1. Start the server (from `server` directory):
```bash
npm run dev
```

2. Start the client (from `client` directory):
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Features

- Real-time multiplayer gameplay (3v3)
- Matchmaking system
- Player authentication
- Character selection
- Game lobby
- Score tracking
- Live game state synchronization

## Development

### Server Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

### Client Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.
