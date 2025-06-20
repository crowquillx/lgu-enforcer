require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildPresences
	],
	partials: [
		Partials.Channel,
		Partials.Message,
		Partials.User,
		Partials.GuildMember
	]
});

// Create commands collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

// Load and register event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (!event || !event.name || typeof event.execute !== 'function') {
        console.log(`[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
        continue;
    }
    if (event.once) {
        client.once(event.name, (...args) => {
            console.log(`[EVENT] (once) ${event.name} triggered with args:`, args.map(a => a?.user?.tag || a?.id || typeof a));
            event.execute(...args);
        });
    } else {
        client.on(event.name, (...args) => {
            console.log(`[EVENT] ${event.name} triggered with args:`, args.map(a => a?.user?.tag || a?.id || typeof a));
            event.execute(...args);
        });
    }
}

// Function to deploy commands
async function deployCommands() {
	try {
		console.log('Started refreshing application (/) commands.');

		const commands = [];
		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const command = require(filePath);
			if ('data' in command && 'execute' in command) {
				commands.push(command.data.toJSON());
			}
		}

		const rest = new REST().setToken(process.env.DISCORD_TOKEN);
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error('Error deploying commands:', error);
	}
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, async readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	
	// Deploy commands when the bot starts
	await deployCommands();
});

// Handle interactions
client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.autocomplete(interaction);
		} catch (error) {
			console.error(error);
		}
		return;
	}

	// Handle select menu interactions for commands
	if (interaction.isStringSelectMenu()) {
		// Try to find a command that can handle this component
		for (const [, command] of client.commands) {
			if (typeof command.handleComponent === 'function') {
				const handled = await command.handleComponent(interaction);
				if (handled) return;
			}
		}
		console.error('No command handled the select menu interaction.');
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
