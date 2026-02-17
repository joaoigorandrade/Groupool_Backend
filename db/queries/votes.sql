-- name: CreateVote :one
INSERT INTO votes (
  challenge_id,
  voter_id,
  vote_option
) VALUES (
  $1, $2, $3
)
RETURNING *;

-- name: GetVote :one
SELECT * FROM votes
WHERE challenge_id = $1 AND voter_id = $2
LIMIT 1;

-- name: ListVotesByChallenge :many
SELECT v.*, u.name as voter_name
FROM votes v
JOIN users u ON v.voter_id = u.id
WHERE v.challenge_id = $1;

-- name: CountVotesByOption :many
SELECT vote_option, COUNT(*) as count
FROM votes
WHERE challenge_id = $1
GROUP BY vote_option;
