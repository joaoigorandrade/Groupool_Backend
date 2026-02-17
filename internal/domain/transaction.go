package domain

import (
	"time"

	"github.com/google/uuid"
)

type TransactionType string

const (
	TransactionTypeDeposit    TransactionType = "DEPOSIT"
	TransactionTypeWithdrawal TransactionType = "WITHDRAWAL"
	TransactionTypeBet        TransactionType = "BET"
	TransactionTypeWin        TransactionType = "WIN"
)

type Transaction struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Amount      float64
	Type        TransactionType
	Description string
	CreatedAt   time.Time
}
