const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            console.log(`[guildMemberAdd] New member joined:`, {
                userTag: member.user?.tag,
                userId: member.user?.id,
                guildId: member.guild?.id,
                guildName: member.guild?.name
            });

            // Get the default role ID from environment variables
            const defaultRoleId = process.env.DEFAULT_ROLE_ID;
            console.log(`[guildMemberAdd] DEFAULT_ROLE_ID from env:`, defaultRoleId);
            
            if (!defaultRoleId) {
                console.log('[guildMemberAdd] No DEFAULT_ROLE_ID set in environment variables');
                return;
            }

            // Get the role from the guild
            const role = member.guild.roles.cache.get(defaultRoleId);
            console.log(`[guildMemberAdd] Fetched role:`, role ? {id: role.id, name: role.name} : null);
            
            if (!role) {
                console.log(`[guildMemberAdd] Default role with ID ${defaultRoleId} not found in guild ${member.guild?.name} (${member.guild?.id})`);
                return;
            }

            // Assign the role to the new member
            console.log(`[guildMemberAdd] Attempting to assign role ${role.name} (${role.id}) to user ${member.user.tag} (${member.user.id})`);
            await member.roles.add(role);
            console.log(`[guildMemberAdd] Successfully assigned role ${role.name} (${role.id}) to user ${member.user.tag} (${member.user.id})`);
        } catch (error) {
            console.error('[guildMemberAdd] Error in guildMemberAdd event:', error);
        }
    },
}; 