const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unworthy')
        .setDescription('Kick users and send them a rejection message')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for rejection (optional)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const reason = interaction.options.getString('reason') || 
            `Sorry, you currently don't seem like a great fit for ${interaction.guild.name}.`;
        const channel = interaction.channel;
        const members = channel.members.filter(m => !m.user.bot);

        if (members.size === 0) {
            return interaction.reply({ content: 'No users found in this channel.', ephemeral: true });
        }

        // Build select menu options (max 25 due to Discord API limit)
        const options = members.map(member => ({
            label: member.displayName,
            description: member.user.tag,
            value: member.id
        })).slice(0, 25);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('unworthy-select-users')
            .setPlaceholder('Select users to kick')
            .setMinValues(1)
            .setMaxValues(options.length)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `Select users to kick from the server.\nReason: ${reason}`,
            components: [row],
            ephemeral: true
        });
    },

    async handleComponent(interaction) {
        if (interaction.customId !== 'unworthy-select-users') return false;

        // Extract reason from the message content if possible
        const reasonMatch = interaction.message.content.match(/Reason: (.*)$/);
        const reason = reasonMatch ? reasonMatch[1] : `Sorry, you currently don't seem like a great fit for ${interaction.guild.name}.`;
        const userIds = interaction.values;

        const results = { success: [], failed: [] };
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

        await interaction.update({ embeds: [responseEmbed], components: [] });
        return true;
    },
}; 