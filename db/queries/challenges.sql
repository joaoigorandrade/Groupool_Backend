-- name: CreateChallenge :one
INSERT INTO challenges (
  group_id,
  creator_id,
  title,
  description,
  start_time,
  end_time,
  status
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: GetChallenge :one
SELECT * FROM challenges
WHERE id = $1 LIMIT 1;

-- name: ListChallengesByGroup :many
SELECT * FROM challenges
WHERE group_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateChallengeStatus :one
UPDATE challenges
SET
    status = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: AddChallengeParticipant :one
INSERT INTO challenge_participants (
    challenge_id,
    user_id
) VALUES (
    $1, $2
)
RETURNING *;

-- name: ListChallengeParticipants :many
SELECT cp.*, u.name, u.email
FROM challenge_participants cp
JOIN users u ON cp.user_id = u.id
WHERE cp.challenge_id = $1;

-- name: GetActiveChallengeByGroup :one
SELECT * FROM challenges
WHERE group_id = $1 AND status = 'ACTIVE'
LIMIT 1;
