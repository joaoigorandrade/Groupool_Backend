package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"groupool/config"
	"groupool/internal/handler"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	r := chi.NewRouter()

	// Marketplace middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", handler.HealthCheck)

	address := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("Server running on port %s", cfg.Server.Port)
	if err := http.ListenAndServe(address, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
