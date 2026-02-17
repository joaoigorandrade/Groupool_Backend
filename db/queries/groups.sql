-- name: CreateGroup :one
INSERT INTO groups (
  name,
  description,
  creator_id
) VALUES (
  $1, $2, $3
)
RETURNING *;

-- name: GetGroup :one
SELECT * FROM groups
WHERE id = $1 LIMIT 1;

-- name: ListGroups :many
SELECT * FROM groups
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: UpdateGroup :one
UPDATE groups
SET
    name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteGroup :exec
DELETE FROM groups
WHERE id = $1;

-- name: AddGroupMember :one
INSERT INTO group_members (
  group_id,
  user_id,
  role
) VALUES (
  $1, $2, $3
)
RETURNING *;

-- name: GetGroupMember :one
SELECT * FROM group_members
WHERE group_id = $1 AND user_id = $2
LIMIT 1;

-- name: ListGroupMembers :many
SELECT gm.*, u.name, u.email
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = $1
ORDER BY gm.joined_at;

-- name: RemoveGroupMember :exec
DELETE FROM group_members
WHERE group_id = $1 AND user_id = $2;
