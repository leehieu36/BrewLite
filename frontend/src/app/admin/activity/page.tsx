
"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { adminActivityLogs, type ActivityLog } from "@/lib/api";

const actionLabels: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  LOGIN: "Đăng nhập",
  LOGOUT: "Đăng xuất",
  CANCEL: "Hủy",
  CONFIRM: "Xác nhận",
};

export default function ActivityPage() {
  const { token } = useApp();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;

    try {
      setError("");
      const result = await adminActivityLogs(token, 1, 100);
      setLogs(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải nhật ký.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">ACTIVITY LOG</span>
          <h1>Nhật ký hoạt động</h1>
          <p>Theo dõi lịch sử thao tác trong hệ thống.</p>
        </div>

        <button className="admin-quiet-btn" onClick={load}>
          ↻ Làm mới
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Lịch sử hoạt động</h2>
            <p>{logs.length} hoạt động gần đây</p>
          </div>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Vai trò</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Nội dung</th>
                <th>Địa chỉ IP</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Đang tải nhật ký...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7}>Chưa có hoạt động nào.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {new Date(log.createdAt).toLocaleString("vi-VN")}
                    </td>

                    <td>
                      <strong>{log.actor?.name || "Hệ thống"}</strong>
                      <small>{log.actor?.email || ""}</small>
                    </td>

                    <td>{log.actorRole || "—"}</td>

                    <td>
                      <span className="admin-status">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>

                    <td>{log.entity || "—"}</td>
                    <td>{log.description || "—"}</td>
                    <td>{log.ipAddress || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
