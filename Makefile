.PHONY: dev build start db-generate db-migrate

# Start dev server with auto-reload (use during development)
dev:
	npm run dev

# Compile TypeScript to dist/ (required before `make start`)
build:
	npm run build

# Run the compiled server (production / staging)
start: build
	npm run start

# After editing src/db/schema.ts — generate a new migration file
db-generate:
	npm run db:generate

# Apply pending migrations to the database
db-migrate:
	npm run db:push
