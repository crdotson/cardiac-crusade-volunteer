FROM node:24 AS frontend-builder
ARG VITE_BASE_PATH=/
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM node:24 AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./

FROM node:24-slim
WORKDIR /app
COPY --from=frontend-builder /app/client/dist ./client/dist
COPY --from=backend-builder /app/server ./server
WORKDIR /app/server
EXPOSE 3000
CMD ["npm", "start"]
