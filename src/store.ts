import { create } from "zustand";
import { supabase, supabaseConfigured } from "./lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Location {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  role: "driver" | "passenger";
  lat: number | null;
  lng: number | null;
  is_online: boolean;
  is_premium: boolean;
  // Kept for component compatibility
  location: Location | null;
  isOnline: boolean;
  isPremium: boolean;
}

export interface Message {
  id: string;
  from_user: string;
  to_user: string;
  text: string;
  created_at: string;
  // Compatibility aliases
  from: string;
  to: string;
  timestamp: number;
}

// Map DB row to User with compatibility fields
function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    lat: row.lat,
    lng: row.lng,
    is_online: row.is_online,
    is_premium: row.is_premium,
    // Compatibility
    location: row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null,
    isOnline: row.is_online,
    isPremium: row.is_premium,
  };
}

// Map DB row to Message with compatibility fields
function mapMessage(row: any): Message {
  return {
    id: row.id,
    from_user: row.from_user,
    to_user: row.to_user,
    text: row.text,
    created_at: row.created_at,
    // Compatibility
    from: row.from_user,
    to: row.to_user,
    timestamp: new Date(row.created_at).getTime(),
  };
}

interface AppState {
  currentUser: User | null;
  users: User[];
  messages: Message[];
  channel: RealtimeChannel | null;

  connect: (name: string, role: "driver" | "passenger") => Promise<string | null>;
  updateLocation: (location: Location) => void;
  toggleOnline: (isOnline: boolean) => void;
  togglePremium: (isPremium: boolean) => void;
  sendMessage: (to: string, text: string) => void;
  cleanup: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  users: [],
  messages: [],
  channel: null,

  connect: async (name, role) => {
    // Check if Supabase is configured
    if (!supabaseConfigured) {
      return "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
    }

    // 1. Insert user into Supabase
    const { data: userData, error } = await supabase
      .from("users")
      .insert({ name, role, is_online: false, is_premium: false })
      .select()
      .single();

    if (error || !userData) {
      console.error("Failed to create user:", error);
      return error?.message || "Failed to connect. Please try again.";
    }

    const currentUser = mapUser(userData);
    set({ currentUser });

    // 2. Fetch all existing users
    const { data: allUsers } = await supabase
      .from("users")
      .select("*");

    if (allUsers) {
      set({ users: allUsers.map(mapUser) });
    }

    // 3. Fetch existing messages for this user
    const { data: existingMessages } = await supabase
      .from("messages")
      .select("*")
      .or(`from_user.eq.${currentUser.id},to_user.eq.${currentUser.id}`)
      .order("created_at", { ascending: true });

    if (existingMessages) {
      set({ messages: existingMessages.map(mapMessage) });
    }

    // 4. Subscribe to realtime changes
    const channel = supabase
      .channel("rideconnect")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (payload) => {
          const { users } = get();

          if (payload.eventType === "INSERT") {
            const newUser = mapUser(payload.new);
            set({ users: [...users, newUser] });
          } else if (payload.eventType === "UPDATE") {
            const updatedUser = mapUser(payload.new);
            set({
              users: users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
            });
            // Update currentUser if it's us
            const { currentUser } = get();
            if (currentUser && currentUser.id === updatedUser.id) {
              set({ currentUser: updatedUser });
            }
          } else if (payload.eventType === "DELETE") {
            set({
              users: users.filter((u) => u.id !== (payload.old as any).id),
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = mapMessage(payload.new);
          const { currentUser, messages } = get();

          // Only add if it involves us
          if (
            currentUser &&
            (newMessage.from_user === currentUser.id || newMessage.to_user === currentUser.id)
          ) {
            // Avoid duplicates
            if (!messages.find((m) => m.id === newMessage.id)) {
              set({ messages: [...messages, newMessage] });
            }
          }
        }
      )
      .subscribe();

    set({ channel });

    // 5. Cleanup on page unload — mark user offline and delete
    window.addEventListener("beforeunload", () => {
      supabase.from("users").delete().eq("id", currentUser.id).then();
    });

    return null; // success
  },

  updateLocation: async (location) => {
    const { currentUser } = get();
    if (!currentUser) return;

    // Optimistic local update
    set({
      currentUser: {
        ...currentUser,
        lat: location.lat,
        lng: location.lng,
        location,
      },
    });

    // Update in Supabase
    await supabase
      .from("users")
      .update({ lat: location.lat, lng: location.lng, last_seen: new Date().toISOString() })
      .eq("id", currentUser.id);
  },

  toggleOnline: async (isOnline) => {
    const { currentUser } = get();
    if (!currentUser) return;

    set({
      currentUser: { ...currentUser, is_online: isOnline, isOnline },
    });

    await supabase
      .from("users")
      .update({ is_online: isOnline })
      .eq("id", currentUser.id);
  },

  togglePremium: async (isPremium) => {
    const { currentUser } = get();
    if (!currentUser) return;

    set({
      currentUser: { ...currentUser, is_premium: isPremium, isPremium },
    });

    await supabase
      .from("users")
      .update({ is_premium: isPremium })
      .eq("id", currentUser.id);
  },

  sendMessage: async (to, text) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({ from_user: currentUser.id, to_user: to, text })
      .select()
      .single();

    if (error) {
      console.error("Failed to send message:", error);
      return;
    }

    // Add locally immediately (realtime will also fire, but we deduplicate)
    if (data) {
      const msg = mapMessage(data);
      const { messages } = get();
      if (!messages.find((m) => m.id === msg.id)) {
        set({ messages: [...messages, msg] });
      }
    }
  },

  cleanup: () => {
    const { channel, currentUser } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (currentUser) {
      supabase.from("users").delete().eq("id", currentUser.id).then();
    }
    set({ currentUser: null, users: [], messages: [], channel: null });
  },
}));
