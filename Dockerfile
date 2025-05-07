# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built node modules and source code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/commands ./commands
COPY --from=builder /app/index.js .
COPY --from=builder /app/deploy-commands.js .

# Create a non-root user
RUN addgroup -S bot && adduser -S bot -G bot
USER bot

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"]
