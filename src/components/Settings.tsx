import { useStore } from "../store";
import { Shield, Wifi, LogOut } from "lucide-react";

export default function Settings() {
  const { currentUser, toggleOnline, togglePremium, demoMode, toggleDemoMode, users } = useStore();
  
  if (!currentUser) return null;

  return (
    <div className="h-full bg-gray-50 p-4 overflow-y-auto w-full">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        
        {/* Live Status Card */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Live System Sync</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-medium text-green-700 uppercase">Live</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/60 p-2 rounded-xl border border-indigo-50">
              <span className="text-[10px] text-indigo-500 block">Total Active</span>
              <span className="text-sm font-bold text-indigo-900">{users.length + (currentUser ? 1 : 0)} People</span>
            </div>
            <div className="bg-white/60 p-2 rounded-xl border border-indigo-50">
              <span className="text-[10px] text-indigo-500 block">Vision Radius</span>
              <span className="text-sm font-bold text-indigo-900">{currentUser?.isPremium ? '10km' : '3km'}</span>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full mt-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-white/80 rounded-lg border border-indigo-100 hover:bg-white transition-colors"
          >
            Force Sync Now
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-5 bg-indigo-50/50">
            <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-sm border-2 border-white">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{currentUser.name}</h3>
              <p className="text-indigo-600 font-medium capitalize mt-1 px-3 py-1 bg-indigo-100 rounded-full inline-block text-sm">
                {currentUser.role}
              </p>
            </div>
          </div>
          
          <div className="p-2">
            {/* Online Toggle */}
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${currentUser.isOnline ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Wifi size={24} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">Go Online</p>
                  <p className="text-sm text-gray-500">Become visible to {currentUser.role === 'driver' ? 'passengers' : 'drivers'}</p>
                </div>
              </div>
              <button
                onClick={() => toggleOnline(!currentUser.isOnline)}
                className={`${
                  currentUser.isOnline ? "bg-green-500" : "bg-gray-200"
                } relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
              >
                <span
                  className={`${
                    currentUser.isOnline ? "translate-x-7" : "translate-x-0"
                  } pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>

            <div className="h-px bg-gray-100 mx-4"></div>

            {/* Premium Toggle */}
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${currentUser.isPremium ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Shield size={24} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">Premium Range</p>
                  <p className="text-sm text-gray-500">Boost vision to 10km radius</p>
                </div>
              </div>
              <button
                onClick={() => togglePremium(!currentUser.isPremium)}
                className={`${
                  currentUser.isPremium ? "bg-indigo-600" : "bg-gray-200"
                } relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              >
                <span
                  className={`${
                    currentUser.isPremium ? "translate-x-7" : "translate-x-0"
                  } pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>

            <div className="h-px bg-gray-100 mx-4"></div>

            {/* Demo Mode Toggle */}
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${demoMode ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Shield size={24} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">Pitch Demo Mode</p>
                  <p className="text-sm text-gray-500">Simulate fake moving people for UNIPOD</p>
                </div>
              </div>
              <button
                onClick={() => toggleDemoMode(!demoMode)}
                className={`${
                  demoMode ? "bg-orange-500" : "bg-gray-200"
                } relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2`}
              >
                <span
                  className={`${
                    demoMode ? "translate-x-7" : "translate-x-0"
                  } pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={() => window.location.reload()} 
          className="w-full flex items-center justify-center gap-2 p-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl font-bold transition-colors"
        >
          <LogOut size={20} />
          Log Out & Exit
        </button>
      </div>
    </div>
  );
}
