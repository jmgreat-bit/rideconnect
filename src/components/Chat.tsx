import { useState, useEffect, useRef } from "react";
import { useStore, User } from "../store";

export default function Chat({ selectedUser, onClose }: { selectedUser: User; onClose: () => void }) {
  const { currentUser, messages, sendMessage } = useStore();
  const [text, setText] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!currentUser) return null;

  // Filter messages between current user and selected user
  const chatMessages = messages.filter(
    (m) =>
      (m.from === currentUser.id && m.to === selectedUser.id) ||
      (m.from === selectedUser.id && m.to === currentUser.id)
  );

  const handleSend = async () => {
    if (!text.trim()) return;
    const msgText = text.trim();
    setText("");
    setSendStatus("sending");
    setErrorDetail("");
    
    try {
      await sendMessage(selectedUser.id, msgText);
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 2000);
    } catch (err: any) {
      setSendStatus("error");
      setErrorDetail(err?.message || "Unknown error");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
            {selectedUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-900">{selectedUser.name}</h3>
            <p className="text-xs text-gray-500 capitalize">{selectedUser.role}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 focus:outline-none"
        >
          <span className="sr-only">Close panel</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Debug info bar */}
      <div className="px-4 py-1.5 bg-gray-100 border-b border-gray-200 text-[10px] text-gray-500 font-mono flex justify-between">
        <span>You: {currentUser.id.substring(0, 8)}...</span>
        <span>To: {selectedUser.id.substring(0, 8)}...</span>
        <span>
          {sendStatus === "sending" && "⏳ Sending..."}
          {sendStatus === "sent" && "✅ Sent!"}
          {sendStatus === "error" && `❌ ${errorDetail || "Failed"}`}
          {sendStatus === "idle" && `💬 ${chatMessages.length} msgs`}
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-10">
              <p>No messages yet. Send one below!</p>
              <p className="text-xs text-gray-400 mt-2">Messages sync every ~5 seconds</p>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isMe = msg.from === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                      isMe
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-900 border border-gray-200"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span
                      className={`text-xs mt-1 block ${
                        isMe ? "text-indigo-200" : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex space-x-3"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendStatus === "sending"}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {sendStatus === "sending" ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
