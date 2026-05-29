FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ---- dependencies ----
FROM base AS deps
COPY package*.json ./
# Use npm install so the image builds even without a committed lockfile.
# In CI/CD, commit package-lock.json and switch back to: npm ci --frozen-lockfile
RUN npm install --prefer-offline

# ---- development ----
FROM deps AS development
ENV NODE_ENV=development
COPY . .
RUN mkdir -p uploads
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- production ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
RUN mkdir -p uploads
EXPOSE 3000
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
