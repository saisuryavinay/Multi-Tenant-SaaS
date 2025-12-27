FROM node:18-alpine

WORKDIR /app

# Install build dependencies for bcrypt compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

# Lightweight wait-for-db + migrations + seeds before start
RUN cat <<'SH' > /app/entrypoint.sh
#!/bin/sh
set -e

# Normalize potential CRLF line endings if present (needed because build context may come from Windows)
sed -i 's/\r$//' /app/entrypoint.sh 2>/dev/null || true

echo "Waiting for database at ${DB_HOST}:${DB_PORT:-5432}..."
for i in $(seq 1 30); do
  node -e "const { Client } = require('pg'); const c = new Client({host: process.env.DB_HOST, port: process.env.DB_PORT||5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}); c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1));" && break
  echo "DB not ready yet (${i}/30). Retrying in 2s..."
  sleep 2
 done

echo "Running migrations..."
npm run migrate

echo "Running seeds..."
npm run seed

echo "Starting server..."
exec npm start
SH
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/entrypoint.sh"]
