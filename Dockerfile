# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install if package-lock.json doesn't exist)
RUN if [ -f "package-lock.json" ]; then \
        npm ci; \
    else \
        npm install && npm install --package-lock-only; \
    fi

# Copy source code
COPY . .

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built node modules and source code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/commands ./commands
COPY --from=builder /app/events ./events
COPY --from=builder /app/index.js .

# Create a non-root user
RUN addgroup -S bot && adduser -S bot -G bot
USER bot

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"]
