const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allowed')
        .setDescription('Remove a role from multiple users')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('users')
                .setDescription('Space-separated list of user mentions or IDs')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        // Defer the reply since this might take some time
        await interaction.deferReply();

        const role = interaction.options.getRole('role');
        const usersInput = interaction.options.getString('users');
        const userIds = usersInput.match(/\d+/g) || [];

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
                
                if (!member.roles.cache.has(role.id)) {
                    results.failed.push(`${member.user.tag} (didn't have the role)`);
                    continue;
                }

                await member.roles.remove(role);
                results.success.push(member.user.tag);
            } catch (error) {
                results.failed.push(`User ID: ${userId} (${error.message})`);
            }
        }

        // Create response message
        let response = `Role removal summary for ${role.name}:\n\n`;
        
        if (results.success.length > 0) {
            response += `✅ Successfully removed role from:\n${results.success.map(user => `- ${user}`).join('\n')}\n\n`;
        }
        
        if (results.failed.length > 0) {
            response += `❌ Failed to remove role from:\n${results.failed.map(user => `- ${user}`).join('\n')}`;
        }

        await interaction.editReply(response);
    },
}; 