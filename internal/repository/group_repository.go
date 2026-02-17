package repository

import (
	"context"

	"groupool/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
)

type GroupRepository interface {
	CreateGroup(ctx context.Context, arg db.CreateGroupParams) (db.Group, error)
	GetGroup(ctx context.Context, id pgtype.UUID) (db.Group, error)
	ListGroups(ctx context.Context, arg db.ListGroupsParams) ([]db.Group, error)
	UpdateGroup(ctx context.Context, arg db.UpdateGroupParams) (db.Group, error)
	DeleteGroup(ctx context.Context, id pgtype.UUID) error
	AddGroupMember(ctx context.Context, arg db.AddGroupMemberParams) (db.GroupMember, error)
	GetGroupMember(ctx context.Context, arg db.GetGroupMemberParams) (db.GroupMember, error)
	ListGroupMembers(ctx context.Context, groupID pgtype.UUID) ([]db.ListGroupMembersRow, error)
	RemoveGroupMember(ctx context.Context, arg db.RemoveGroupMemberParams) error
}
