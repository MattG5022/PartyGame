import React, { useState, useEffect } from 'react';
import { Users, Gamepad2, Wifi, WifiOff } from 'lucide-react';

const GameLobby = () => {
  const [players, setPlayers] = useState([]);
  const [gameUrl, setGameUrl] = useState('');
  const [wsStatus, setWsStatus] = useState('connecting');
  const [activeGames, setActiveGames] = useState(new Map());
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const gameUrl = 'http://localhost:8080/join';
    setGameUrl(gameUrl);

    const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}`);
    setWs(ws);
    
    ws.onopen = () => {
      setWsStatus('connected');
      ws.send(JSON.stringify({ type: 'tvClient' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'playerUpdate') {
        setPlayers(data.players);
      } else if (data.type === 'gameUpdate') {
        const gameMap = new Map(data.games.map(game => [game.id, game]));
        setActiveGames(gameMap);
      }
    };

    ws.onclose = () => setWsStatus('disconnected');

    return () => ws.close();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-500';
      case 'starting': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            Game Lobby
          </h1>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {wsStatus === 'connected' ? <Wifi size={18} /> : <WifiOff size={18} />}
            <span className="text-sm font-medium capitalize">{wsStatus}</span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Join Section */}
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <Gamepad2 className="text-indigo-500" size={24} />
              <h2 className="text-2xl font-semibold">Join Game</h2>
            </div>
            <div className="bg-white p-6 rounded-xl mb-4">
              <img 
                src="/api/placeholder/200/200"
                alt="QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <p className="text-gray-400 mb-2">Scan QR code or visit:</p>
            <code className="block p-3 bg-gray-900/50 rounded-lg text-sm text-gray-300 font-mono break-all">
              {gameUrl}
            </code>
          </div>

          {/* Players Section */}
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <Users className="text-indigo-500" size={24} />
              <h2 className="text-2xl font-semibold">Players ({players.length})</h2>
            </div>
            {players.length === 0 ? (
              <p className="text-gray-400">Waiting for players to join...</p>
            ) : (
              <div className="space-y-3">
                {players.map(player => (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">{player.name}</span>
                    {player.gameId && (
                      <span className="ml-auto text-sm px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                        {activeGames.get(player.gameId)?.name || 'Unknown Game'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Games */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from(activeGames.values()).map(game => (
            <div key={game.id} className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-indigo-500/50 transition-colors">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-semibold">{game.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(game.status)}/20 text-${getStatusColor(game.status).replace('bg-', '')}`}>
                    {game.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-400 text-sm">
                  <span>Players</span>
                  <span>{game.players} / {game.maxPlayers}</span>
                </div>
                <div className="w-full bg-gray-700/30 rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${(game.players / game.maxPlayers) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameLobby;