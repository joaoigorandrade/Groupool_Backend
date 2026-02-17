package repository

import (
	"context"

	"groupool/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
)

type TransactionRepository interface {
	CreateTransaction(ctx context.Context, arg db.CreateTransactionParams) (db.Transaction, error)
	GetTransaction(ctx context.Context, id pgtype.UUID) (db.Transaction, error)
	ListTransactionsByUser(ctx context.Context, arg db.ListTransactionsByUserParams) ([]db.Transaction, error)
	GetUserBalance(ctx context.Context, userID pgtype.UUID) (pgtype.Numeric, error)
}
