const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');

const getTargetChannel = (interaction) => {
	const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
	return TARGET_CHANNEL_ID
		? interaction.guild.channels.cache.get(TARGET_CHANNEL_ID)
		: interaction.channel;
};

const getEligibleMembers = (guild, channel) => {
	return guild.members.cache.filter(
		m => !m.user.bot && channel.permissionsFor(m)?.has(PermissionFlagsBits.ViewChannel)
	);
};

const buildKickComponents = (membersArr, page, reason) => {
	const pageSize = 25;
	const totalPages = Math.max(1, Math.ceil(membersArr.length / pageSize));
	const safePage = Math.min(Math.max(page, 1), totalPages);
	const pagedMembers = membersArr.slice((safePage - 1) * pageSize, safePage * pageSize);

	const options = pagedMembers.map(member => ({
		label: member.displayName.slice(0, 100),
		description: (member.user.username || member.user.tag || member.id).slice(0, 100),
		value: member.id,
	}));

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`unworthy-select-users-page-${safePage}`)
		.setPlaceholder('Select users to kick')
		.setMinValues(1)
		.setMaxValues(Math.min(options.length, 25))
		.addOptions(options);

	const components = [new ActionRowBuilder().addComponents(selectMenu)];
	if (totalPages > 1) {
		const buttonRow = new ActionRowBuilder();
		if (safePage > 1) {
			buttonRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`unworthy-prev-page-${safePage}`)
					.setLabel('Previous')
					.setStyle(ButtonStyle.Primary)
			);
		}
		if (safePage < totalPages) {
			buttonRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`unworthy-next-page-${safePage}`)
					.setLabel('Next')
					.setStyle(ButtonStyle.Primary)
			);
		}
		if (buttonRow.components.length) {
			components.push(buttonRow);
		}
	}

	return {
		content: `Select users to kick from the server.\nReason: ${reason} (Page ${safePage}/${totalPages})`,
		components,
	};
};

const extractReason = (messageContent, guildName) => {
	const reasonMatch = messageContent.match(/Reason: (.*?)(?: \(Page|$)/);
	return reasonMatch?.[1]?.trim()
		|| `Sorry, you currently don't seem like a great fit for ${guildName}.`;
};

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

		await interaction.guild.members.fetch();

		const channel = getTargetChannel(interaction);
		if (!channel) {
			await interaction.reply({ content: 'Target channel not found.', flags: MessageFlags.Ephemeral });
			return;
		}

		const members = getEligibleMembers(interaction.guild, channel);
		if (members.size === 0) {
			await interaction.reply({ content: 'No users found in this channel.', flags: MessageFlags.Ephemeral });
			return;
		}

		const payload = buildKickComponents(Array.from(members.values()), 1, reason);
		await interaction.reply({
			...payload,
			flags: MessageFlags.Ephemeral,
		});
	},

	async handleComponent(interaction) {
		try {
			if (interaction.customId.startsWith('unworthy-prev-page-') || interaction.customId.startsWith('unworthy-next-page-')) {
				const isPrev = interaction.customId.startsWith('unworthy-prev-page-');
				const currentPage = parseInt(interaction.customId.split('-').pop(), 10);
				const newPage = isPrev ? currentPage - 1 : currentPage + 1;
				const reason = extractReason(interaction.message.content, interaction.guild.name);

				await interaction.guild.members.fetch();
				const channel = getTargetChannel(interaction);
				if (!channel) {
					await interaction.update({ content: 'Target channel not found.', components: [] });
					return true;
				}

				const members = getEligibleMembers(interaction.guild, channel);
				const payload = buildKickComponents(Array.from(members.values()), newPage, reason);
				await interaction.update(payload);
				return true;
			}

			if (interaction.customId.startsWith('unworthy-select-users-page-')) {
				const reason = extractReason(interaction.message.content, interaction.guild.name);
				const userIds = interaction.values;
				const results = { success: [], failed: [] };

				for (const userId of userIds) {
					try {
						const member = await interaction.guild.members.fetch(userId);
						if (!member.kickable) {
							results.failed.push(`${member.user.tag} (cannot be kicked - bot lacks permissions or user has higher role)`);
							continue;
						}

						try {
							const dmEmbed = new EmbedBuilder()
								.setColor('#FF0000')
								.setTitle('Application Rejected')
								.setDescription(`You have been removed from **${interaction.guild.name}**\n\n**Reason:** ${reason}`)
								.setTimestamp();
							await member.send({ embeds: [dmEmbed] });
						} catch {
							console.log(`Could not send DM to ${member.user.tag}`);
						}

						await member.kick(reason);
						results.success.push(member.user.tag);
					} catch (error) {
						results.failed.push(`User ID: ${userId} (${error.message})`);
					}
				}

				const responseEmbed = new EmbedBuilder()
					.setColor('#00FF00')
					.setTitle('Kick Operation Summary')
					.setDescription(`Results for kicking users from ${interaction.guild.name}`)
					.setTimestamp();

				if (results.success.length > 0) {
					responseEmbed.addFields({
						name: '✅ Successfully Kicked',
						value: results.success.map(user => `- ${user}`).join('\n').slice(0, 1024),
					});
				}
				if (results.failed.length > 0) {
					responseEmbed.addFields({
						name: '❌ Failed to Kick',
						value: results.failed.map(user => `- ${user}`).join('\n').slice(0, 1024),
					});
				}

				await interaction.update({ embeds: [responseEmbed], content: null, components: [] });
				return true;
			}

			return false;
		} catch (error) {
			console.error('[unworthy.handleComponent] Error:', error);
			try {
				const payload = { content: 'An error occurred while processing your request.', ephemeral: true };
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp(payload);
				} else if (interaction.isRepliable()) {
					await interaction.reply(payload);
				}
			} catch (replyError) {
				console.error('[unworthy.handleComponent] Failed to send error reply:', replyError);
			}
			return false;
		}
	},
};
