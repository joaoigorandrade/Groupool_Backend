DB_URL=postgresql://root:secret@localhost:5432/groupool?sslmode=disable

.PHONY: run build test docker-up docker-down createdb dropdb migrateup migratedown sqlc

run:
	go run cmd/api/main.go

build:
	go build -o bin/api cmd/api/main.go

test:
	go test -v -cover ./...

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

createdb:
	docker exec -it groupool_backend-postgres-1 createdb --username=root --owner=root groupool

dropdb:
	docker exec -it groupool_backend-postgres-1 dropdb groupool

migrateup:
	migrate -path db/migrations -database "$(DB_URL)" -verbose up

migratedown:
	migrate -path db/migrations -database "$(DB_URL)" -verbose down

sqlc:
	sqlc generate
