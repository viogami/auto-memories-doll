package server

import (
	"net/http"
	"strings"
)

type removedHistoryQueryItem struct {
	AnimeID   int64  `json:"anime_id"`
	Name      string `json:"name"`
	Cover     string `json:"cover"`
	RemovedAt string `json:"removed_at"`
	AddedAt   string `json:"added_at"`
}

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

	unique := make([]historyUploadItem, 0, len(req.Items))
	seen := make(map[int64]struct{}, len(req.Items))
	for i := len(req.Items) - 1; i >= 0; i-- {
		item := req.Items[i]
		if item.AnimeID == 0 || strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.Cover) == "" {
			writeError(w, http.StatusBadRequest, "anime_id, name, cover are required")
			return
		}
		if _, ok := seen[item.AnimeID]; ok {
			continue
		}
		seen[item.AnimeID] = struct{}{}
		unique = append(unique, item)
	}

	for i, j := 0, len(unique)-1; i < j; i, j = i+1, j-1 {
		unique[i], unique[j] = unique[j], unique[i]
	}

	for _, item := range unique {

		clientAddedAt := parseRFC3339Nullable(item.AddedAt)
		_, err := tx.Exec(r.Context(), `
			INSERT INTO anime_history_records (user_id, anime_id, anime_name, cover, client_added_at, is_deleted, updated_at)
			VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
			ON CONFLICT (user_id, anime_id) DO UPDATE
			SET anime_name = EXCLUDED.anime_name,
			    cover = EXCLUDED.cover,
			    client_added_at = EXCLUDED.client_added_at,
			    is_deleted = FALSE,
			    updated_at = NOW()
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

	writeJSON(w, http.StatusCreated, map[string]any{"uploaded": len(unique)})
}

func (s *Server) listHistory(w http.ResponseWriter, r *http.Request, userID int64) {
	limit := parseLimit(r.URL.Query().Get("limit"), 50, 1, 200)

	rows, err := s.pool.Query(r.Context(), `
		SELECT id, anime_id, anime_name, cover,
		       COALESCE(client_added_at::text, '') AS client_added_at,
		       created_at::text
		FROM anime_history_records
		WHERE user_id = $1 AND is_deleted = FALSE
		ORDER BY COALESCE(client_added_at, updated_at, created_at) DESC, updated_at DESC
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

	removedRows, err := s.pool.Query(r.Context(), `
		SELECT anime_id, anime_name, cover,
		       updated_at::text AS removed_at,
		       COALESCE(client_added_at::text, '') AS added_at
		FROM anime_history_records
		WHERE user_id = $1 AND is_deleted = TRUE
		ORDER BY updated_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query removed history failed")
		return
	}
	defer removedRows.Close()

	removedItems := make([]removedHistoryQueryItem, 0, limit)
	for removedRows.Next() {
		var item removedHistoryQueryItem
		if err := removedRows.Scan(&item.AnimeID, &item.Name, &item.Cover, &item.RemovedAt, &item.AddedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "scan removed history failed")
			return
		}
		removedItems = append(removedItems, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items":         items,
		"removed_items": removedItems,
	})
}
