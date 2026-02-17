package domain

import (
	"time"

	"github.com/google/uuid"
)

type WithdrawalStatus string

const (
	WithdrawalStatusPending  WithdrawalStatus = "PENDING"
	WithdrawalStatusApproved WithdrawalStatus = "APPROVED"
	WithdrawalStatusRejected WithdrawalStatus = "REJECTED"
)

type WithdrawalRequest struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	Amount         float64
	Status         WithdrawalStatus
	Deadline       time.Time
	ContestReasons []string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
