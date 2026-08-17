# Production Dockerfile for Nexus Sales CRM
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY database/package*.json ./database/

# Install dependencies
RUN npm ci

# Copy full source
COPY . .

# Build database, frontend, and backend
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5506

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY database/package*.json ./database/

# Install production dependencies
RUN npm ci --only=production

COPY --from=builder /app/database ./database
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/build ./backend/build
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5506

CMD ["npm", "run", "start:backend"]
