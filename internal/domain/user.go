package domain

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusActive   UserStatus = "ACTIVE"
	UserStatusInactive UserStatus = "INACTIVE"
	UserStatusBanned   UserStatus = "BANNED"
)

type User struct {
	ID                     uuid.UUID
	Name                   string
	Email                  string
	AvatarURL              string
	ReputationScore        int
	Status                 UserStatus
	LastWinAt              *time.Time
	ConsecutiveMissedVotes int
	CreatedAt              time.Time
	UpdatedAt              time.Time
}
