import { useStore, User } from "../store";
import { MessageSquare } from "lucide-react";

export default function Inbox({ onSelectUser }: { onSelectUser: (user: User) => void }) {
  const { currentUser, messages, users } = useStore();
  
  if (!currentUser) return null;

  // Find all unique users we have chatted with
  const chattedUserIds = new Set<string>();
  messages.forEach(m => {
    if (m.from === currentUser.id) chattedUserIds.add(m.to);
    if (m.to === currentUser.id) chattedUserIds.add(m.from);
  });

  const chattedUsers = Array.from(chattedUserIds)
    .map(id => users.find(u => u.id === id))
    .filter(Boolean) as User[];

  return (
    <div className="h-full bg-gray-50 p-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
      
      {chattedUsers.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500">No messages yet. Start a conversation from the map or list!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chattedUsers.map(u => {
            // Get the last message in the conversation
            const lastMessage = messages
              .filter(m => (m.from === u.id && m.to === currentUser.id) || (m.from === currentUser.id && m.to === u.id))
              .pop();
              
            return (
              <div 
                key={u.id} 
                onClick={() => onSelectUser(u)} 
                className="bg-white p-4 rounded-xl shadow-sm cursor-pointer hover:bg-indigo-50 border border-gray-100 flex items-center gap-4 transition-all"
              >
                <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 text-lg truncate">{u.name}</h3>
                    {lastMessage && (
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {lastMessage?.from === currentUser.id ? "You: " : ""}{lastMessage?.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
