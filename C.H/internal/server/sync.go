package server

import (
	"net/http"
	"strings"
)

func (s *Server) handleSync(w http.ResponseWriter, r *http.Request, userID int64) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		History []historyUploadItem `json:"history"`
		Rank    *rankUploadRequest  `json:"rank"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.History) == 0 && req.Rank == nil {
		writeError(w, http.StatusBadRequest, "history or rank is required")
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "begin tx failed")
		return
	}
	defer tx.Rollback(r.Context())

	historyCount := 0
	for _, item := range req.History {
		if item.AnimeID == 0 || strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.Cover) == "" {
			writeError(w, http.StatusBadRequest, "history item fields are required")
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
		historyCount++
	}

	var rankID *int64
	if req.Rank != nil {
		req.Rank.Title = strings.TrimSpace(req.Rank.Title)
		req.Rank.TierBoardName = strings.TrimSpace(req.Rank.TierBoardName)
		req.Rank.GridBoardName = strings.TrimSpace(req.Rank.GridBoardName)
		if req.Rank.Title == "" || req.Rank.TierBoardName == "" || req.Rank.GridBoardName == "" || len(req.Rank.Payload) == 0 {
			writeError(w, http.StatusBadRequest, "invalid rank payload")
			return
		}
		var id int64
		err := tx.QueryRow(r.Context(), `
			INSERT INTO rank_snapshots (user_id, title, tier_board_name, grid_board_name, payload)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, userID, req.Rank.Title, req.Rank.TierBoardName, req.Rank.GridBoardName, req.Rank.Payload).Scan(&id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "insert rank failed")
			return
		}
		rankID = &id
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "commit tx failed")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"history_uploaded": historyCount,
		"rank_id":          rankID,
	})
}
