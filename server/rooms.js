class RoomManager {
    constructor(maxPlayers = 59, reconnectTimeout = 60) {
        this.rooms = new Map();
        this.playerToRoom = new Map();
        this.maxPlayers = maxPlayers;
        this.reconnectTimeout = reconnectTimeout;
    }

    generateCleanCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evita caracteres confusos (O, 0, 1, I)
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createRoom(mode, hostSocketId, hostNickname) {
        let code = this.generateCleanCode();
        while (this.rooms.has(code)) code = this.generateCleanCode();

        const room = {
            code,
            mode,
            hostId: hostSocketId,
            players: new Map(),
            started: false,
            score: { blue: 0, red: 0 },
            flagCarrierId: null,
            flagPos: { x: 2000, y: 300 }
        };

        this.rooms.set(code, room);
        this.joinRoom(code, hostSocketId, hostNickname);
        return room;
    }

    joinRoom(code, socketId, nickname) {
        const room = this.rooms.get(code);
        if (!room) return { error: "La sala especificada no existe." };
        if (room.players.size >= this.maxPlayers) return { error: `La sala está llena (Máximo ${this.maxPlayers} jugadores).` };
        if (room.started) return { error: "La partida ya ha sido iniciada." };

        const team = room.players.size % 2 === 0 ? 'blue' : 'red';
        const player = {
            id: socketId,
            nickname: nickname || 'Viajero',
            team,
            x: team === 'blue' ? 400 : 3600,
            y: 3600,
            vx: 0, vy: 0,
            energy: 21.0,
            isFrozen: false,
            facingLeft: false,
            hasFlag: false,
            isBot: false
        };

        room.players.set(socketId, player);
        this.playerToRoom.set(socketId, code);
        return { room };
    }

    getRoom(code) {
        return this.rooms.get(code);
    }

    updatePlayerInput(roomCode, socketId, inputState) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;
        const player = room.players.get(socketId);
        if (player && !player.isFrozen) {
            player.vx = inputState.vx;
            player.vy = inputState.vy;
            player.facingLeft = inputState.facingLeft;
            return player;
        }
        return null;
    }

    handleDisconnect(socketId) {
        const roomCode = this.playerToRoom.get(socketId);
        if (!roomCode) return null;

        const room = this.rooms.get(roomCode);
        if (room) {
            room.players.delete(socketId);
            this.playerToRoom.delete(socketId);
            if (room.players.size === 0) {
                this.rooms.delete(roomCode);
            }
        }
        return roomCode;
    }

    updateGameStates(io, botController) {
        const dt = 1 / 30;

        for (const [code, room] of this.rooms.entries()) {
            if (!room.started) continue;

            // Actualizar estado de los jugadores y bots
            for (const [id, player] of room.players.entries()) {
                if (player.isBot) {
                    botController.updateBotState(player, room, dt);
                } else if (!player.isFrozen) {
                    player.energy -= dt;
                    if (player.energy <= 0) {
                        player.energy = 0;
                        player.isFrozen = true;
                    }
                    player.x += player.vx * 220 * dt;
                    player.y += player.vy * 220 * dt;
                }
            }

            // Emitir actualización de estado
            io.to(code).emit('gameStateUpdate', {
                players: Array.from(room.players.values()),
                score: room.score,
                flagPos: room.flagPos
            });
        }
    }
}

module.exports = RoomManager;
