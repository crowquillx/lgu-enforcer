const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unworthy')
        .setDescription('Kick users and send them a rejection message')
        .addStringOption(option =>
            option.setName('users')
                .setDescription('Space-separated list of user mentions or IDs')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for rejection (optional)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        // Defer the reply since this might take some time
        await interaction.deferReply({ ephemeral: true });

        const usersInput = interaction.options.getString('users');
        const userIds = usersInput.match(/\d+/g) || [];
        const reason = interaction.options.getString('reason') || 
            `Sorry, you currently don't seem like a great fit for ${interaction.guild.name}.`;

        if (userIds.length === 0) {
            return interaction.editReply('No valid users provided. Please provide user mentions or IDs.');
        }

        const results = {
            success: [],
            failed: []
        };

        // Process each user
        for (const userId of userIds) {
            try {
                const member = await interaction.guild.members.fetch(userId);
                
                if (!member.kickable) {
                    results.failed.push(`${member.user.tag} (cannot be kicked - bot lacks permissions or user has higher role)`);
                    continue;
                }

                // Try to send DM first
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Application Rejected')
                        .setDescription(`You have been removed from **${interaction.guild.name}**\n\n**Reason:** ${reason}`)
                        .setTimestamp();

                    await member.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    // Continue even if DM fails
                    console.log(`Could not send DM to ${member.user.tag}`);
                }

                // Kick the user
                await member.kick(reason);
                results.success.push(member.user.tag);
            } catch (error) {
                results.failed.push(`User ID: ${userId} (${error.message})`);
            }
        }

        // Create response message
        const responseEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Kick Operation Summary')
            .setDescription(`Results for kicking users from ${interaction.guild.name}`)
            .setTimestamp();

        if (results.success.length > 0) {
            responseEmbed.addFields({
                name: '✅ Successfully Kicked',
                value: results.success.map(user => `- ${user}`).join('\n')
            });
        }

        if (results.failed.length > 0) {
            responseEmbed.addFields({
                name: '❌ Failed to Kick',
                value: results.failed.map(user => `- ${user}`).join('\n')
            });
        }

        await interaction.editReply({ embeds: [responseEmbed] });
    }
}; 