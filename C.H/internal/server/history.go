package server

import (
	"net/http"
	"strings"
)

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request, userID int64) {
	switch r.Method {
	case http.MethodPost:
		s.uploadHistory(w, r, userID)
	case http.MethodGet:
		s.listHistory(w, r, userID)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) uploadHistory(w http.ResponseWriter, r *http.Request, userID int64) {
	var req struct {
		Items []historyUploadItem `json:"items"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "items cannot be empty")
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "begin tx failed")
		return
	}
	defer tx.Rollback(r.Context())

	for _, item := range req.Items {
		if item.AnimeID == 0 || strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.Cover) == "" {
			writeError(w, http.StatusBadRequest, "anime_id, name, cover are required")
			return
		}

		clientAddedAt := parseRFC3339Nullable(item.AddedAt)
		_, err := tx.Exec(r.Context(), `
			INSERT INTO anime_history_records (user_id, anime_id, anime_name, cover, client_added_at)
			VALUES ($1, $2, $3, $4, $5)
		`, userID, item.AnimeID, item.Name, item.Cover, clientAddedAt)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "insert history failed")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"uploaded": len(req.Items)})
}

func (s *Server) listHistory(w http.ResponseWriter, r *http.Request, userID int64) {
	limit := parseLimit(r.URL.Query().Get("limit"), 50, 1, 200)

	rows, err := s.pool.Query(r.Context(), `
		SELECT id, anime_id, anime_name, cover,
		       COALESCE(client_added_at::text, '') AS client_added_at,
		       created_at::text
		FROM anime_history_records
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query history failed")
		return
	}
	defer rows.Close()

	items := make([]historyQueryItem, 0, limit)
	for rows.Next() {
		var item historyQueryItem
		if err := rows.Scan(&item.ID, &item.AnimeID, &item.Name, &item.Cover, &item.AddedAt, &item.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "scan history failed")
			return
		}
		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
