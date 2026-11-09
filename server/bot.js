class BotController {
    updateBotState(bot, room, dt) {
        if (bot.isFrozen) return;

        // Drenar energía
        bot.energy -= dt;
        if (bot.energy <= 0) {
            bot.energy = 0;
            bot.isFrozen = true;
            return;
        }

        // Buscar el objetivo (bandera o base enemiga)
        let targetX = room.flagPos.x;
        let targetY = room.flagPos.y;

        if (bot.hasFlag) {
            targetX = bot.team === 'blue' ? 400 : 3600;
            targetY = 3600;
        }

        const angle = Math.atan2(targetY - bot.y, targetX - bot.x);
        const speed = bot.hasFlag ? 160 : 200;

        bot.x += Math.cos(angle) * speed * dt;
        bot.y += Math.sin(angle) * speed * dt;
        bot.facingLeft = Math.cos(angle) < 0;
    }
}

module.exports = BotController;
