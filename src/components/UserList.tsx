import { useStore, User } from "../store";
import { getDistance } from "../utils";
import { MessageSquare, MapPin } from "lucide-react";

export default function UserList({ onSelectUser }: { onSelectUser: (user: User) => void }) {
  const { currentUser, users } = useStore();
  
  if (!currentUser || !currentUser.location) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Acquiring GPS signal...</p>
        </div>
      </div>
    );
  }

  const visibilityRadius = currentUser.isPremium ? 5 : 1; // km

  const visibleUsers = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!u.isOnline) return false;
    if (!u.location) return false;
    if (u.role === currentUser.role) return false;

    const distance = getDistance(
      currentUser.location!.lat,
      currentUser.location!.lng,
      u.location.lat,
      u.location.lng
    );

    return distance <= visibilityRadius;
  });

  return (
    <div className="h-full bg-gray-50 p-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Nearby {currentUser.role === 'driver' ? 'Passengers' : 'Drivers'}
      </h2>
      
      {visibleUsers.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-gray-500">No one nearby within {visibilityRadius}km.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleUsers.map(u => {
            const dist = getDistance(
              currentUser.location!.lat,
              currentUser.location!.lng,
              u.location!.lat,
              u.location!.lng
            ).toFixed(2);
            
            return (
              <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{u.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin size={14} className="text-indigo-400" />
                      {dist} km away
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => onSelectUser(u)} 
                  className="p-3 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                  title="Message"
                >
                  <MessageSquare size={20} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
