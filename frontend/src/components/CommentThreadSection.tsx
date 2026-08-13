import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, AtSign, ShieldAlert, User, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface CommentThreadSectionProps {
  leadId?: string;
  dealId?: string;
}

export function CommentThreadSection({ leadId, dealId }: CommentThreadSectionProps) {
  const { token, user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = async () => {
    if (!token || (!leadId && !dealId)) return;
    try {
      const param = leadId ? `leadId=${leadId}` : `dealId=${dealId}`;
      const res = await fetch(`/api/v1/coaching-notes/record?${param}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error("Failed to fetch record comments", err);
    }
  };

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch team users for mentions", err);
    }
  };

  useEffect(() => {
    fetchComments();
    fetchUsers();
  }, [leadId, dealId, token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);

    const lastAtIndex = val.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex >= val.length - 15) {
      const query = val.slice(lastAtIndex + 1);
      if (!query.includes(" ")) {
        setMentionQuery(query.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (userName: string) => {
    const lastAtIndex = content.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const prefix = content.slice(0, lastAtIndex);
      const newText = `${prefix}@${userName} `;
      setContent(newText);
    }
    setShowMentions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading || !token) return;
    setLoading(true);

    try {
      const res = await fetch("/api/v1/coaching-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leadId: leadId || null,
          dealId: dealId || null,
          content: content.trim()
        })
      });

      if (res.ok) {
        setContent("");
        fetchComments();
      }
    } catch (err) {
      console.error("Failed to submit comment", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = teamUsers.filter(u =>
    u.name.toLowerCase().includes(mentionQuery) || (u.email && u.email.toLowerCase().includes(mentionQuery))
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Team Comments & Notes
          </h3>
          <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
            {comments.length}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
          <AtSign className="w-3.5 h-3.5 text-cyan-500" /> Type @name to notify teammates
        </span>
      </div>

      {/* COMMENTS LIST */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-4">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
            No team comments yet. Start the conversation below!
          </div>
        ) : (
          comments.map((item) => {
            const isDirected = Boolean(item.targetUserId);
            const authorName = item.author?.name || "Team Member";
            const initials = authorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all text-xs ${
                  isDirected
                    ? "bg-amber-500/5 border-amber-500/30 dark:bg-amber-950/20"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center text-white ${
                      isDirected ? "bg-amber-600" : "bg-primary"
                    }`}>
                      {initials}
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{authorName}</span>
                    {isDirected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] rounded-full">
                        <ShieldAlert className="w-3 h-3" /> Directed Coaching Note
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] rounded-full">
                        Team Comment
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-8 font-medium">
                  {item.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* INPUT FORM WITH @MENTION POPUP */}
      <form onSubmit={handleSubmit} className="relative">
        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 max-h-40 overflow-y-auto py-1">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
              Mention Teammate
            </div>
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u.name)}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-primary flex items-center justify-between"
              >
                <span className="font-semibold">{u.name}</span>
                <span className="text-[10px] text-slate-400">{u.role}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={handleInputChange}
              placeholder="Write a team comment or @mention a colleague..."
              className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => {
                setContent(prev => prev + "@");
                setShowMentions(true);
                if (inputRef.current) inputRef.current.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
              title="Add @mention"
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!content.trim() || loading}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </form>
    </div>
  );
}
