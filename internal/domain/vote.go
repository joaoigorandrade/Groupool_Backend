package domain

import (
	"time"

	"github.com/google/uuid"
)

type VoteOption string

const (
	VoteOptionYes VoteOption = "YES"
	VoteOptionNo  VoteOption = "NO"
)

type Vote struct {
	ID          uuid.UUID
	ChallengeID uuid.UUID
	VoterID     uuid.UUID
	VoteOption  VoteOption
	CreatedAt   time.Time
}
