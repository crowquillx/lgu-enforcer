const { Events, ActivityType } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`${client.user.tag} is ready to rumble`);
		client.user.setActivity('russia discourse', { type: ActivityType.Watching });
		
	},
};

