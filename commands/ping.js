const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('ping'),
	async execute(interaction) {
		await interaction.reply({content: 'bong!', ephemeral: true});
	},
};
