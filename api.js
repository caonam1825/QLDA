import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Globe, FolderOpen } from "lucide-react";
import { api } from "../api";

export default function ChatPanel({ currentUser, projectId, projectName, onClose }) {
  const [room, setRoom] = useState("global"); // 'global' | projectId
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const { messages: msgs } = await api.getChatMessages(room);
      setMessages(msgs);
      setError("");
    } catch (e) {
      setError(e.message || "Không tải được tin nhắn");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), 8000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await api.sendChatMessage(room, body);
      setDraft("");
      await load(true);
    } catch (e) {
      setError(e.message || "Không gửi được tin nhắn");
    } finally {
      setSending(false);
    }
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card chat-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><MessageSquare size={16} /> Chat giữa các thành viên</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <div className="report-tabs">
          <button className={`report-tab ${room === "global" ? "report-tab-active" : ""}`} onClick={() => setRoom("global")} type="button">
            <Globe size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Toàn công ty
          </button>
          {projectId && (
            <button className={`report-tab ${room === projectId ? "report-tab-active" : ""}`} onClick={() => setRoom(projectId)} type="button">
              <FolderOpen size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {projectName || "Dự án hiện tại"}
            </button>
          )}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="chat-messages" ref={listRef}>
          {loading && <p className="invite-hint">Đang tải…</p>}
          {!loading && messages.length === 0 && <p className="invite-hint">Chưa có tin nhắn nào — hãy là người đầu tiên!</p>}
          {!loading && messages.map(m => (
            <div key={m.id} className={`chat-bubble-row ${m.mine ? "chat-bubble-row-mine" : ""}`}>
              <div className={`chat-bubble ${m.mine ? "chat-bubble-mine" : ""}`}>
                {!m.mine && <div className="chat-bubble-sender">{m.senderName}</div>}
                <div className="chat-bubble-body">{m.body}</div>
                <div className="chat-bubble-time">{formatTime(m.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>

        <form className="chat-input-row" onSubmit={handleSend}>
          <input
            type="text" placeholder="Nhập tin nhắn…" value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" disabled={sending || !draft.trim()}><Send size={14} /></button>
        </form>
      </div>
    </div>
  );
}
