FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy source
COPY . .

# Ensure .env is not baked into image in production; use secrets / env injection at runtime
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
