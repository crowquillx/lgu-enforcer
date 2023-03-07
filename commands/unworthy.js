const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unworthy')
		.setDescription('kicks and sends a message saying that they don\'t belong')
        .addUserOption(option => option.setName('target').setDescription('who must go?').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('reason for kicking?')),
	async execute(interaction, client) {
		const kickUser = interaction.options.getUser('target');
        const kickMember = await interaction.guild.members.fetch(kickUser.id);
        const channel = interaction.channel;

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return await interaction.reply({content: "kick members perm is required for this command. dummy.", ephemeral: true});
        if (!kickMember) return await interaction.reply({content: 'that user is not in the server.', ephemeral: true});
        if (!kickMember.kickable) return await interaction.reply({content: "this user is too powerful for me to kick", ephemeral: true})

        let reason = interaction.options.getString('reason');
        if (!reason) reason = `Sorry, you currently don't seem like a great fit for **${interaction.guild.name} .`

        const dmEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription(`:exclamation: You have been removed from **${interaction.guild.name} | ${reason}`)

        const embed = new EmbedBuilder()
        .setColor("Aqua")
        .setDescription(`white_check_mark: ${kickUser.tag} has been disposed of | ${reason}`)

        await kickMember.send({ embeds: [dmEmbed] }).catch(err => {
            return;
        });

        await kickMember.kick({ reason: reason}).catch (err => {
            interaction.reply({content: "there was an error.", ephemeral: true})
        });

        await interaction.reply({embeds: [embed], ephemeral:true});
	},
};