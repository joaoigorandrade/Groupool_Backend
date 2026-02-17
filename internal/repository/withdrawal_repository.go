package repository

import (
	"context"

	"groupool/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
)

type WithdrawalRepository interface {
	CreateWithdrawalRequest(ctx context.Context, arg db.CreateWithdrawalRequestParams) (db.WithdrawalRequest, error)
	GetWithdrawalRequest(ctx context.Context, id pgtype.UUID) (db.WithdrawalRequest, error)
	ListWithdrawalRequests(ctx context.Context, arg db.ListWithdrawalRequestsParams) ([]db.WithdrawalRequest, error)
	UpdateWithdrawalStatus(ctx context.Context, arg db.UpdateWithdrawalStatusParams) (db.WithdrawalRequest, error)
	ListPendingWithdrawals(ctx context.Context) ([]db.WithdrawalRequest, error)
}
