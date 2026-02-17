package domain

import (
	"time"

	"github.com/google/uuid"
)

type Group struct {
	ID                  uuid.UUID
	Name                string
	Description         string
	CreatorID           uuid.UUID
	TotalPool           float64
	MaxActiveChallenges int
	VoteWindowDuration  time.Duration
	CooldownTimer       time.Duration
	CreatedAt           time.Time
	UpdatedAt           time.Time
}
