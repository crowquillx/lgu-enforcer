const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`${interaction.commandName} ain't exist.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
            // Check if this is a rate limit error that was already handled by the command
            if (error.handledByCommand) {
                return;
            }
			console.error(`brother, something went wrong when running ${interaction.commandName}, please let tan know.`);
			console.error(error);
		}
	},
};
