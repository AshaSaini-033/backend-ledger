# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Copy installed dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
