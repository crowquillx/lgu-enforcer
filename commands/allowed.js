const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allowed')
        .setDescription('Remove a role from multiple users')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const role = interaction.options.getRole('role');
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
            .setCustomId('allowed-select-users')
            .setPlaceholder('Select users to remove the role from')
            .setMinValues(1)
            .setMaxValues(options.length)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `Select users to remove the role **${role.name}** from:`,
            components: [row],
            ephemeral: true
        });
    },

    // Add an interaction handler for the select menu
    async handleComponent(interaction) {
        if (interaction.customId !== 'allowed-select-users') return false;

        const role = interaction.message.content.match(/\*\*(.+)\*\*/)[1];
        const userIds = interaction.values;
        const guildRole = interaction.guild.roles.cache.find(r => r.name === role);

        if (!guildRole) {
            await interaction.update({ content: 'Role not found.', components: [] });
            return true;
        }

        const results = { success: [], failed: [] };
        for (const userId of userIds) {
            try {
                const member = await interaction.guild.members.fetch(userId);
                if (!member.roles.cache.has(guildRole.id)) {
                    results.failed.push(`${member.user.tag} (didn't have the role)`);
                    continue;
                }
                await member.roles.remove(guildRole);
                results.success.push(member.user.tag);
            } catch (error) {
                results.failed.push(`User ID: ${userId} (${error.message})`);
            }
        }

        let response = `Role removal summary for **${guildRole.name}**:\n\n`;
        if (results.success.length > 0) {
            response += `✅ Successfully removed role from:\n${results.success.map(user => `- ${user}`).join('\n')}\n\n`;
        }
        if (results.failed.length > 0) {
            response += `❌ Failed to remove role from:\n${results.failed.map(user => `- ${user}`).join('\n')}`;
        }

        await interaction.update({ content: response, components: [] });
        return true;
    },
}; 