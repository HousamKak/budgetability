# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001 -G nodejs

# Set ownership of nginx directories needed at runtime
RUN chown -R appuser:nodejs /var/cache/nginx && \
    chown -R appuser:nodejs /var/log/nginx && \
    chown -R appuser:nodejs /etc/nginx/conf.d && \
    chown -R appuser:nodejs /run && \
    chown -R appuser:nodejs /usr/share/nginx/html

# Use non-root user
USER appuser

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
