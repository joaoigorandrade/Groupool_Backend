package domain

import (
	"time"

	"github.com/google/uuid"
)

type MemberRole string

const (
	MemberRoleAdmin  MemberRole = "ADMIN"
	MemberRoleMember MemberRole = "MEMBER"
)

type GroupMember struct {
	GroupID          uuid.UUID
	UserID           uuid.UUID
	Role             MemberRole
	CurrentEquity    float64
	FrozenBalance    float64
	AvailableBalance float64
	JoinedAt         time.Time
}
