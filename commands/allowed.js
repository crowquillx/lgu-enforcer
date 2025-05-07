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
                .setDescription('Select users to remove the role from')
                .setRequired(true)
                .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const role = interaction.options.getRole('role');
        
        if (!role) {
            return interaction.respond([]);
        }

        try {
            // Fetch all members if they're not cached
            if (!interaction.guild.members.cache.size) {
                await interaction.guild.members.fetch();
            }

            // Get all members with the role
            const membersWithRole = interaction.guild.members.cache.filter(member => 
                member.roles.cache.has(role.id)
            );

            // Filter based on user input
            const filtered = membersWithRole.filter(member => {
                const searchTerm = focusedValue.toLowerCase();
                return member.user.username.toLowerCase().includes(searchTerm) ||
                       member.user.tag.toLowerCase().includes(searchTerm) ||
                       member.displayName.toLowerCase().includes(searchTerm);
            });

            // Format the choices
            const choices = filtered.map(member => ({
                name: `${member.displayName} (${member.user.tag})`,
                value: member.id
            })).slice(0, 25); // Discord has a limit of 25 choices

            await interaction.respond(choices);
        } catch (error) {
            console.error('Error in autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        // Defer the reply since this might take some time
        await interaction.deferReply();

        const role = interaction.options.getRole('role');
        const userIds = interaction.options.getString('users').split(',').map(id => id.trim());

        if (userIds.length === 0) {
            return interaction.editReply('No valid users provided. Please select users from the list.');
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