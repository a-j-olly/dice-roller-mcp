# Multi-stage build for minimal production image
FROM node:22-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Production stage with minimal base image
FROM node:22-slim AS production

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home mcp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port 3000
EXPOSE 3000

# Default command runs HTTP transport on port 3000
CMD ["node", "dist/index.js", "--transport=http", "--port=3000"]