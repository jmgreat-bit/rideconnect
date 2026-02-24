/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { useStore, User } from "./store";
import MapView from "./components/MapView";
import Chat from "./components/Chat";
import UserList from "./components/UserList";
import Inbox from "./components/Inbox";
import Settings from "./components/Settings";
import { Map, List, MessageCircle, Settings as SettingsIcon } from "lucide-react";

export default function App() {
  const { currentUser, connect, updateLocation } = useStore();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"driver" | "passenger">("passenger");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "list" | "messages" | "settings">("map");
  const [connecting, setConnecting] = useState(false);

  // Global geolocation watcher
  useEffect(() => {
    if (!currentUser) return;

    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by your browser");
      const defaultLoc: [number, number] = [37.7749, -122.4194];
      updateLocation({ lat: defaultLoc[0], lng: defaultLoc[1] });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error("Error getting location:", err);
        const defaultLoc: [number, number] = [37.7749, -122.4194];
        updateLocation({ lat: defaultLoc[0], lng: defaultLoc[1] });
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser, updateLocation]);

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || connecting) return;
    setConnecting(true);
    await connect(name.trim(), role);
    setConnecting(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Map className="text-white h-8 w-8" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            RideConnect
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Find rides or passengers instantly
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
            <form className="space-y-6" onSubmit={handleConnect}>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${role === 'passenger' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                    <input
                      type="radio"
                      className="sr-only"
                      name="role"
                      value="passenger"
                      checked={role === "passenger"}
                      onChange={() => setRole("passenger")}
                    />
                    <span className="font-semibold">Passenger</span>
                  </label>
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${role === 'driver' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                    <input
                      type="radio"
                      className="sr-only"
                      name="role"
                      value="driver"
                      checked={role === "driver"}
                      onChange={() => setRole("driver")}
                    />
                    <span className="font-semibold">Driver</span>
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!name.trim() || connecting}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {connecting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      Connecting...
                    </span>
                  ) : (
                    "Enter App"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm z-10 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
              <Map className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">RideConnect</h1>
            <span className="ml-4 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 capitalize hidden sm:inline-block">
              {currentUser.role}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {currentUser.isOnline ? (
              <span className="flex items-center text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Online
              </span>
            ) : (
              <span className="flex items-center text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
                Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex">
        {/* Main View Area */}
        <div className={`flex-1 transition-all duration-300 ${selectedUser ? "hidden md:block" : "block"}`}>
          {activeTab === "map" && <MapView onSelectUser={setSelectedUser} />}
          {activeTab === "list" && <UserList onSelectUser={setSelectedUser} />}
          {activeTab === "messages" && <Inbox onSelectUser={setSelectedUser} />}
          {activeTab === "settings" && <Settings />}
        </div>

        {/* Chat Sidebar */}
        {selectedUser && (
          <div className="absolute inset-0 z-20 md:relative md:inset-auto w-full md:w-96 flex-shrink-0 transition-all duration-300 border-l border-gray-200 bg-white">
            <Chat selectedUser={selectedUser} onClose={() => setSelectedUser(null)} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 z-10 pb-safe">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => { setActiveTab("map"); setSelectedUser(null); }}
            className={`flex flex-col items-center py-3 px-4 flex-1 ${activeTab === "map" ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            <Map size={24} className={activeTab === "map" ? "fill-indigo-50" : ""} />
            <span className="text-xs mt-1 font-medium">Map</span>
          </button>
          <button
            onClick={() => { setActiveTab("list"); setSelectedUser(null); }}
            className={`flex flex-col items-center py-3 px-4 flex-1 ${activeTab === "list" ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            <List size={24} />
            <span className="text-xs mt-1 font-medium">List</span>
          </button>
          <button
            onClick={() => { setActiveTab("messages"); setSelectedUser(null); }}
            className={`flex flex-col items-center py-3 px-4 flex-1 ${activeTab === "messages" ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            <MessageCircle size={24} className={activeTab === "messages" ? "fill-indigo-50" : ""} />
            <span className="text-xs mt-1 font-medium">Messages</span>
          </button>
          <button
            onClick={() => { setActiveTab("settings"); setSelectedUser(null); }}
            className={`flex flex-col items-center py-3 px-4 flex-1 ${activeTab === "settings" ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            <SettingsIcon size={24} />
            <span className="text-xs mt-1 font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
