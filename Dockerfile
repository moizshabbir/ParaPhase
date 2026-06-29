# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the frontend assets and bundle the server using esbuild
RUN npm run build

# --- Production Stage ---
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy only production dependencies to keep the image lightweight
COPY package*.json ./
RUN npm ci --only=production

# Copy built distribution assets from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose the server port
EXPOSE 3000

# Start the bundled application using production script
CMD ["npm", "run", "start"]