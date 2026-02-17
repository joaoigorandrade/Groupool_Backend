package repository

import (
	"context"

	"groupool/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
)

type VoteRepository interface {
	CreateVote(ctx context.Context, arg db.CreateVoteParams) (db.Vote, error)
	GetVote(ctx context.Context, arg db.GetVoteParams) (db.Vote, error)
	ListVotesByChallenge(ctx context.Context, challengeID pgtype.UUID) ([]db.ListVotesByChallengeRow, error)
	CountVotesByOption(ctx context.Context, challengeID pgtype.UUID) ([]db.CountVotesByOptionRow, error)
}
