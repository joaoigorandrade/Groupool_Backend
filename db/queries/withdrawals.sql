-- name: CreateWithdrawalRequest :one
INSERT INTO withdrawal_requests (
  user_id,
  amount,
  status
) VALUES (
  $1, $2, 'PENDING'
)
RETURNING *;

-- name: GetWithdrawalRequest :one
SELECT * FROM withdrawal_requests
WHERE id = $1 LIMIT 1;

-- name: ListWithdrawalRequests :many
SELECT * FROM withdrawal_requests
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateWithdrawalStatus :one
UPDATE withdrawal_requests
SET
    status = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListPendingWithdrawals :many
SELECT * FROM withdrawal_requests
WHERE status = 'PENDING'
ORDER BY created_at ASC;
