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
	unique := make([]historyUploadItem, 0, len(req.History))
	seen := make(map[int64]struct{}, len(req.History))
	for i := len(req.History) - 1; i >= 0; i-- {
		item := req.History[i]
		if item.AnimeID == 0 || strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.Cover) == "" {
			writeError(w, http.StatusBadRequest, "history item fields are required")
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

	activeIDs := make([]int64, 0, len(unique))
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
		activeIDs = append(activeIDs, item.AnimeID)
		historyCount++
	}

	if len(activeIDs) == 0 {
		_, err := tx.Exec(r.Context(), `
			UPDATE anime_history_records
			SET is_deleted = TRUE,
			    updated_at = NOW()
			WHERE user_id = $1 AND is_deleted = FALSE
		`, userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "mark deleted failed")
			return
		}
	} else {
		_, err := tx.Exec(r.Context(), `
			UPDATE anime_history_records
			SET is_deleted = TRUE,
			    updated_at = NOW()
			WHERE user_id = $1
			  AND is_deleted = FALSE
			  AND NOT (anime_id = ANY($2::BIGINT[]))
		`, userID, activeIDs)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "mark deleted failed")
			return
		}
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
