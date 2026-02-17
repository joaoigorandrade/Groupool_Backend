package repository

import (
	"context"

	"groupool/internal/db"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository defines the interface for data access.
type Repository interface {
	db.Querier
	// Add custom methods here if needed, for example methods that use transactions
	ExecTx(ctx context.Context, fn func(db.Querier) error) error
}

// SQLRepository implements Repository using sqlc generated code.
type SQLRepository struct {
	*db.Queries
	connPool *pgxpool.Pool
}

// NewRepository creates a new SQLRepository.
func NewRepository(connPool *pgxpool.Pool) *SQLRepository {
	return &SQLRepository{
		Queries:  db.New(connPool),
		connPool: connPool,
	}
}

// ExecTx executes a function within a database transaction.
func (r *SQLRepository) ExecTx(ctx context.Context, fn func(db.Querier) error) error {
	tx, err := r.connPool.Begin(ctx)
	if err != nil {
		return err
	}

	q := db.New(tx)
	err = fn(q)
	if err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			return rbErr
		}
		return err
	}

	return tx.Commit(ctx)
}
