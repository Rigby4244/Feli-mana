FROM node:18-alpine

WORKDIR /app

# Copy package manifests first and install production deps
# Use npm ci when a lockfile exists for reproducible installs
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
			npm ci --only=production --silent; \
		else \
			npm install --only=production --silent; \
		fi

# Copy rest of application
COPY . ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
