# Use Node.js as base image
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies first (caching optimization)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npx nest build

# Use a smaller base image for production
FROM node:22-alpine

# Install curl (for healthcheck)
RUN apk add --no-cache curl

# Set the working directory
WORKDIR /usr/src/app

# Copy only necessary files from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Expose the application port
EXPOSE 3000

# Start the NestJS application
CMD ["node", "dist/main"]