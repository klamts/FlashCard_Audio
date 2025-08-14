import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PublicChatState, PublicChatPlayer, ChatMessage } from '../types';

const PublicChat: React.FC = () => {
  const [chatState, setChatState] = useState<PublicChatState | null>(null);
  const [playerName, setPlayerName] = useState(localStorage.getItem('publicChatPlayerName') || '');
  const [roomCodeToJoin, setRoomCodeToJoin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isHost, setIsHost] = useState(false);
  
  const peerRef = useRef<any>(null);
  const hostConnectionRef = useRef<any>(null); // For clients
  const clientConnectionsRef = useRef<any>({}); // For host
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
    }
    Object.values(clientConnectionsRef.current).forEach((conn: any) => conn.close());
    clientConnectionsRef.current = {};
    if (hostConnectionRef.current) {
        hostConnectionRef.current.close();
        hostConnectionRef.current = null;
    }
    setChatState(null);
    setIsHost(false);
    setError(null);
  }, []);

  const broadcastState = useCallback((state: PublicChatState) => {
    Object.values(clientConnectionsRef.current).forEach((conn: any) => {
        conn.send({ type: 'STATE_UPDATE', payload: state });
    });
  }, []);

  useEffect(() => {
    if (isHost && chatState) {
        broadcastState(chatState);
    }
  }, [isHost, chatState, broadcastState]);
  
  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatState?.messages]);

  const handleHost = () => {
    if (!playerName.trim()) {
        setError('Please enter a name to host a chat.');
        return;
    }
    localStorage.setItem('publicChatPlayerName', playerName.trim());
    cleanup();
    setIsHost(true);

    const peer = new window.Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      const hostPlayer: PublicChatPlayer = { id, name: playerName.trim() };
      setChatState({
        hostId: id,
        players: { [id]: hostPlayer },
        messages: [],
      });
    });

    peer.on('connection', (conn) => {
      clientConnectionsRef.current[conn.peer] = conn;
      conn.on('data', (data) => handleHostData(conn, data));
      conn.on('close', () => handleClientDisconnect(conn.peer));
    });

    peer.on('error', (err) => {
        setError(`PeerJS Error: ${err.message}`);
        cleanup();
    });
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomCodeToJoin.trim()) {
        setError('Please enter your name and a room code.');
        return;
    }
    localStorage.setItem('publicChatPlayerName', playerName.trim());
    cleanup();

    const peer = new window.Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      const conn = peer.connect(roomCodeToJoin.trim());
      if (!conn) {
          setError("Failed to connect. Please check the room code.");
          cleanup();
          return;
      }
      hostConnectionRef.current = conn;
      conn.on('open', () => {
        conn.send({ type: 'JOIN_REQUEST', payload: { id, name: playerName.trim() } });
      });
      conn.on('data', (data) => {
        if (data.type === 'STATE_UPDATE') {
          setChatState(data.payload);
        }
      });
      conn.on('close', () => {
        setError('Disconnected from host.');
        cleanup();
      });
       conn.on('error', (err) => {
           setError(`Connection Error: ${err.message}`);
           cleanup();
       });
    });

     peer.on('error', (err) => {
        setError(`PeerJS Error: ${err.message}`);
        cleanup();
    });
  };
  
  const handleHostData = (conn: any, data: any) => {
    if (data.type === 'JOIN_REQUEST') {
      const newPlayer = data.payload as PublicChatPlayer;
      setChatState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: { ...prev.players, [newPlayer.id]: newPlayer },
        };
      });
    } else if (data.type === 'CHAT_MESSAGE') {
       setChatState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, data.payload],
        };
      });
    }
  };

  const handleClientDisconnect = (peerId: string) => {
    delete clientConnectionsRef.current[peerId];
    setChatState(prev => {
        if (!prev) return null;
        const newPlayers = { ...prev.players };
        delete newPlayers[peerId];
        return { ...prev, players: newPlayers };
    });
  };
  
  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      name: playerName,
      message: newMessage.trim(),
      timestamp: Date.now(),
    };

    if (isHost) {
      setChatState(prev => prev ? { ...prev, messages: [...prev.messages, message] } : null);
    } else {
      hostConnectionRef.current?.send({ type: 'CHAT_MESSAGE', payload: message });
    }
    setNewMessage('');
  };

  const handleCopyCode = async () => {
      if (!chatState?.hostId) return;
      try {
          await navigator.clipboard.writeText(chatState.hostId);
          alert('Room code copied to clipboard!');
      } catch (err) {
          setError('Failed to copy code.');
      }
  };

  if (!chatState) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-bold text-center text-teal-400 mb-4">Public LAN Chat</h3>
        {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white col-span-1 md:col-span-2"
          />
          <button onClick={handleHost} className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-semibold">
            Host Chat Room
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomCodeToJoin}
              onChange={(e) => setRoomCodeToJoin(e.target.value)}
              placeholder="Enter room code"
              className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
            <button onClick={handleJoin} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold">
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4">
      <div className="w-full md:w-48 flex-shrink-0">
        <h3 className="text-lg font-bold text-teal-400 mb-2">In Chat ({Object.keys(chatState.players).length})</h3>
        <ul className="space-y-1 text-sm">
          {Object.values(chatState.players).map(p => (
            <li key={p.id} className="text-white truncate" title={p.name}>{p.name} {p.id === chatState.hostId ? '👑' : ''}</li>
          ))}
        </ul>
        {isHost && (
            <div className="mt-4">
                <button onClick={handleCopyCode} className="text-xs w-full bg-gray-600 hover:bg-gray-500 py-1 px-2 rounded">Copy Code</button>
            </div>
        )}
        <button onClick={cleanup} className="text-xs w-full mt-2 bg-red-800 hover:bg-red-700 py-1 px-2 rounded">Disconnect</button>
      </div>
      <div className="flex-grow flex flex-col">
        <div ref={chatContainerRef} className="flex-grow bg-gray-900/50 p-2 rounded-lg overflow-y-auto mb-2 h-40">
           {chatState.messages.map((msg, index) => (
              <div key={index} className="mb-1 text-sm">
                  <span className={`font-bold ${msg.name === playerName ? 'text-purple-400' : 'text-cyan-400'}`}>{msg.name}: </span>
                  <span className="text-white break-words">{msg.message}</span>
              </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-grow px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
          />
          <button onClick={sendMessage} className="px-4 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold">Send</button>
        </div>
      </div>
    </div>
  );
};

export default PublicChat;
