package repository

import (
	"context"

	"groupool/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
)

type ChallengeRepository interface {
	CreateChallenge(ctx context.Context, arg db.CreateChallengeParams) (db.Challenge, error)
	GetChallenge(ctx context.Context, id pgtype.UUID) (db.Challenge, error)
	ListChallengesByGroup(ctx context.Context, arg db.ListChallengesByGroupParams) ([]db.Challenge, error)
	UpdateChallengeStatus(ctx context.Context, arg db.UpdateChallengeStatusParams) (db.Challenge, error)
	AddChallengeParticipant(ctx context.Context, arg db.AddChallengeParticipantParams) (db.ChallengeParticipant, error)
	ListChallengeParticipants(ctx context.Context, challengeID pgtype.UUID) ([]db.ListChallengeParticipantsRow, error)
	GetActiveChallengeByGroup(ctx context.Context, groupID pgtype.UUID) (db.Challenge, error)
}
