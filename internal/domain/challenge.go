package domain

import (
	"time"

	"github.com/google/uuid"
)

type ChallengeStatus string

const (
	ChallengeStatusDraft     ChallengeStatus = "DRAFT"
	ChallengeStatusActive    ChallengeStatus = "ACTIVE"
	ChallengeStatusCompleted ChallengeStatus = "COMPLETED"
	ChallengeStatusCancelled ChallengeStatus = "CANCELLED"
)

type Challenge struct {
	ID          uuid.UUID
	GroupID     uuid.UUID
	CreatorID   uuid.UUID
	Title       string
	Description string
	BuyIn       float64
	StartTime   time.Time
	EndTime     time.Time
	Status      ChallengeStatus
	ProofURL    string
	WinnerID    *uuid.UUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
