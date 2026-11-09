const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');
const BotController = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const MAX_JUGADORES = 59;
const TIEMPO_RECONEXION = 60; // Segundos

app.use(express.static(path.join(__dirname, '../public')));

const roomManager = new RoomManager(MAX_JUGADORES, TIEMPO_RECONEXION);
const botController = new BotController();

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

    // Crear Sala Multijugador
    socket.on('createRoom', ({ mode, nickname }, callback) => {
        const room = roomManager.createRoom(mode, socket.id, nickname);
        socket.join(room.code);
        callback({ success: true, roomCode: room.code, playerId: socket.id });
    });

    // Unirse a una Sala
    socket.on('joinRoom', ({ code, nickname }, callback) => {
        const result = roomManager.joinRoom(code, socket.id, nickname);
        if (result.error) {
            return callback({ success: false, message: result.error });
        }
        socket.join(code);
        io.to(code).emit('roomUpdated', result.room);
        callback({ success: true, roomCode: code, playerId: socket.id });
    });

    // Actualización de Movimiento del Jugador
    socket.on('playerMove', ({ roomCode, inputState }) => {
        const updatedPlayer = roomManager.updatePlayerInput(roomCode, socket.id, inputState);
        if (updatedPlayer) {
            socket.to(roomCode).emit('playerState', updatedPlayer);
        }
    });

    // Iniciar Partida desde Lobby
    socket.on('startGame', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (room && room.hostId === socket.id) {
            room.started = true;
            io.to(roomCode).emit('gameStarted', room);
        }
    });

    // Manejo de Desconexión
    socket.on('disconnect', () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        const roomCode = roomManager.handleDisconnect(socket.id);
        if (roomCode) {
            io.to(roomCode).emit('playerDisconnected', { socketId: socket.id });
        }
    });
});

// Bucle principal de actualización en tiempo real (30 Hz)
setInterval(() => {
    roomManager.updateGameStates(io, botController);
}, 1000 / 30);

server.listen(PORT, () => {
    console.log(`Servidor de Snow Us escuchando en el puerto ${PORT}`);
});
