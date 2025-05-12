const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            // Get the default role ID from environment variables
            const defaultRoleId = process.env.DEFAULT_ROLE_ID;
            
            if (!defaultRoleId) {
                console.log('No DEFAULT_ROLE_ID set in environment variables');
                return;
            }

            // Get the role from the guild
            const role = member.guild.roles.cache.get(defaultRoleId);
            
            if (!role) {
                console.log(`Default role with ID ${defaultRoleId} not found`);
                return;
            }

            // Assign the role to the new member
            await member.roles.add(role);
            console.log(`Assigned role ${role.name} to ${member.user.tag}`);
        } catch (error) {
            console.error('Error in guildMemberAdd event:', error);
        }
    },
}; 