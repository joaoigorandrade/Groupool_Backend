-- name: CreateTransaction :one
INSERT INTO transactions (
  user_id,
  amount,
  type,
  description
) VALUES (
  $1, $2, $3, $4
)
RETURNING *;

-- name: GetTransaction :one
SELECT * FROM transactions
WHERE id = $1 LIMIT 1;

-- name: ListTransactionsByUser :many
SELECT * FROM transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetUserBalance :one
SELECT COALESCE(SUM(amount), 0)::DECIMAL
FROM transactions
WHERE user_id = $1;
