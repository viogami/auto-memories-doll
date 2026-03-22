type BackendStatus = "checking" | "online" | "offline";

type CloudPanelProps = {
  panelTitle: string;
  backendStatus: BackendStatus;
  token: string;
  currentUser: string;
  authUsername: string;
  authPassword: string;
  loadingCloud: boolean;
  syncingCloud: boolean;
  syncControlEnabled: boolean;
  cloudMessage: string;
  onCheckBackendStatus: () => void;
  onLogout: () => void;
  onAuthUsernameChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onSubmitAuth: (mode: "login" | "register") => void;
  onSyncControlEnabledChange: (value: boolean) => void;
  onConfirmPullFromCloud: () => void;
  onConfirmPushToCloud: () => void;
};

export function CloudPanel({
  panelTitle,
  backendStatus,
  token,
  currentUser,
  authUsername,
  authPassword,
  loadingCloud,
  syncingCloud,
  syncControlEnabled,
  cloudMessage,
  onCheckBackendStatus,
  onLogout,
  onAuthUsernameChange,
  onAuthPasswordChange,
  onSubmitAuth,
  onSyncControlEnabledChange,
  onConfirmPullFromCloud,
  onConfirmPushToCloud,
}: CloudPanelProps) {
  return (
    <section className="panel cloud-panel">
      <div className="panel-head">
        <h2>{panelTitle}</h2>
        <span
          className={`cloud-state ${
            backendStatus === "checking"
              ? "checking"
              : backendStatus === "online"
                ? "online"
                : "offline"
          }`}
        >
          {backendStatus === "checking"
            ? "连接检测中"
            : backendStatus === "online"
              ? token
                ? "后端在线 / 已登录"
                : "后端在线 / 未登录"
              : "后端离线"}
        </span>
      </div>

      <div className="cloud-cards">
        <div className="cloud-card auth-card">
          <h3>账号</h3>
          {token ? (
            <div className="cloud-summary">
              <p className="cloud-user">
                当前用户：{currentUser || authUsername}
              </p>
              <p className="cloud-user">登录成功后已隐藏登录输入框。</p>
              <div className="cloud-actions compact">
                <button
                  className="ghost"
                  onClick={onCheckBackendStatus}
                  disabled={loadingCloud}
                >
                  刷新连接状态
                </button>
                <button
                  className="ghost danger"
                  onClick={onLogout}
                  disabled={!token}
                >
                  退出
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cloud-auth-grid">
                <input
                  value={authUsername}
                  onChange={(event) => onAuthUsernameChange(event.target.value)}
                  placeholder="用户名"
                />
                <input
                  value={authPassword}
                  onChange={(event) => onAuthPasswordChange(event.target.value)}
                  placeholder="密码"
                  type="password"
                />
              </div>
              <div className="cloud-actions compact">
                <button
                  className="primary"
                  onClick={() => onSubmitAuth("login")}
                  disabled={loadingCloud || backendStatus === "offline"}
                >
                  登录
                </button>
                <button
                  className="ghost"
                  onClick={() => onSubmitAuth("register")}
                  disabled={loadingCloud || backendStatus === "offline"}
                >
                  注册
                </button>
              </div>
            </>
          )}
        </div>

        <div className="cloud-card sync-card">
          <h3>同步控制</h3>
          <label className="cloud-toggle">
            <input
              type="checkbox"
              checked={syncControlEnabled}
              onChange={(event) =>
                onSyncControlEnabledChange(event.target.checked)
              }
            />
            <span>启用手动同步操作（默认关闭）</span>
          </label>
          <p className="cloud-user">
            未勾选时，登录后会自动拉取云端；勾选后可手动选择同步方向
          </p>

          <div className="cloud-actions">
            <button
              className="ghost"
              onClick={onConfirmPullFromCloud}
              disabled={
                loadingCloud ||
                !token ||
                backendStatus !== "online" ||
                !syncControlEnabled
              }
            >
              拉取云端
            </button>
            <button
              className="primary"
              onClick={onConfirmPushToCloud}
              disabled={
                syncingCloud ||
                !token ||
                backendStatus !== "online" ||
                !syncControlEnabled
              }
            >
              {syncingCloud ? "上传中..." : "立即上传"}
            </button>
          </div>
        </div>
      </div>

      <p className="cloud-message">{cloudMessage || "未连接云端"}</p>
    </section>
  );
}
