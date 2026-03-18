import { create } from "zustand";
import { supabase, supabaseConfigured } from "./lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { generateDriverResponse } from "./services/geminiService";

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
  last_seen?: string;
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
    last_seen: row.last_seen,
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

  demoMode: boolean;
  fakeUsers: User[];

  connect: (name: string, role: "driver" | "passenger") => Promise<string | null>;
  updateLocation: (location: Location) => void;
  toggleOnline: (isOnline: boolean) => void;
  togglePremium: (isPremium: boolean) => void;
  toggleDemoMode: (enabled: boolean) => void;
  sendMessage: (to: string, text: string) => void;
  cleanup: () => void;
}

let demoInterval: any = null;
let heartbeatInterval: any = null;
let cleanupHandler: (() => void) | null = null;
const KIGALI_CENTER = { lat: -1.9441, lng: 30.0619 };

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  users: [],
  demoMode: false,
  fakeUsers: [],
  messages: [],
  channel: null,

  connect: async (name, role) => {
    // Check if Supabase is configured
    if (!supabaseConfigured) {
      return "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
    }

    // ──────────────────────────────────────────
    // FIX #1: Insert as is_online: TRUE so the user is immediately visible
    // FIX #4: Set last_seen to now so they pass any freshness filters
    // ──────────────────────────────────────────
    const { data: userData, error } = await supabase
      .from("users")
      .insert({ 
        name, 
        role, 
        is_online: true,         // ← was false, making users invisible on join
        is_premium: false,
        lat: KIGALI_CENTER.lat,
        lng: KIGALI_CENTER.lng,
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !userData) {
      console.error("Failed to create user:", error);
      return error?.message || "Failed to connect. Please try again.";
    }

    const currentUser = mapUser(userData);
    set({ currentUser });

    // ──────────────────────────────────────────
    // FIX: Mark stale users OFFLINE (not delete!)
    // Deleting users cascades and destroys all their messages.
    // Mark them offline so they disappear from the map but messages survive.
    // ──────────────────────────────────────────
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    try {
      await supabase
        .from("users")
        .update({ is_online: false })
        .lt("last_seen", twoMinAgo)
        .neq("id", currentUser.id);
      console.log("[CLEANUP] Marked stale users offline (older than 2 minutes)");
    } catch (err) {
      console.error("Ghost cleanup failed:", err);
    }

    // Fetch remaining users (after ghost cleanup)
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
            // Avoid duplicates
            if (!users.find((u) => u.id === newUser.id)) {
              console.log("[RT] New user joined:", newUser.name);
              set({ users: [...users, newUser] });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedUser = mapUser(payload.new);
            const exists = users.find((u) => u.id === updatedUser.id);
            
            if (exists) {
              set({
                users: users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
              });
            } else {
              // UPSERT: user wasn't in our list yet
              console.log("[RT] User appeared:", updatedUser.name);
              set({ users: [...users, updatedUser] });
            }

            // Update currentUser if it's us
            const { currentUser: cu } = get();
            if (cu && cu.id === updatedUser.id) {
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
          const { currentUser: cu, messages } = get();

          // Only add if it involves us
          if (
            cu &&
            (newMessage.from_user === cu.id || newMessage.to_user === cu.id)
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

    // ──────────────────────────────────────────
    // 5. Heartbeat & Polling Fallback (every 5 seconds)
    // ──────────────────────────────────────────
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
      const { currentUser: cu, messages: currentMessages } = get();
      if (!cu) return;

      // A. Send Heartbeat
      try {
        await supabase
          .from("users")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", cu.id);
      } catch (err) {
        console.error("Heartbeat failed:", err);
      }

      // B. FALLBACK: Poll for users (guarantees sync even if WebSockets fail)
      try {
        const { data: allUsers } = await supabase.from("users").select("*");
        if (allUsers) {
          // Keep currentUser instance intact to avoid unnecessary re-renders of own state
          const mappedUsers = allUsers.map(mapUser).map(u => u.id === cu.id ? cu : u);
          set({ users: mappedUsers });
        }
      } catch (err) {
        console.error("User poll failed:", err);
      }

      // C. FALLBACK: Poll for messages (always update — don't compare lengths)
      try {
        const { data: existingMsgs } = await supabase
          .from("messages")
          .select("*")
          .or(`from_user.eq.${cu.id},to_user.eq.${cu.id}`)
          .order("created_at", { ascending: true });
        
        if (existingMsgs) {
          const newMessages = existingMsgs.map(mapMessage);
          // Compare latest message ID to avoid unnecessary re-renders
          const currentLatestId = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : null;
          const newLatestId = newMessages.length > 0 ? newMessages[newMessages.length - 1].id : null;
          if (currentLatestId !== newLatestId || newMessages.length !== currentMessages.length) {
            set({ messages: newMessages });
          }
        }
      } catch (err) {
        console.error("Message poll failed:", err);
      }
    }, 5000);

    // ──────────────────────────────────────────
    // FIX: Remove `pagehide` — it fires when switching tabs!
    // Only use `beforeunload` and mark OFFLINE instead of deleting.
    // The stale cleanup on next connect will handle actual deletion.
    // ──────────────────────────────────────────
    if (cleanupHandler) {
      window.removeEventListener("beforeunload", cleanupHandler);
    }

    cleanupHandler = () => {
      const { currentUser: cu } = get();
      if (cu) {
        // Mark offline instead of deleting — more reliable
        // sendBeacon is the only way to reliably send data during unload
        if (navigator.sendBeacon) {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?id=eq.${cu.id}`;
          navigator.sendBeacon(
            url,
            new Blob(
              [JSON.stringify({ is_online: false })],
              { type: 'application/json' }
            )
          );
        }
        // Fallback: try supabase call (may not complete)
        supabase.from("users").update({ is_online: false }).eq("id", cu.id).then();
      }
    };

    window.addEventListener("beforeunload", cleanupHandler);

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
    try {
      await supabase
        .from("users")
        .update({ lat: location.lat, lng: location.lng, last_seen: new Date().toISOString() })
        .eq("id", currentUser.id);
    } catch (err) {
      console.error("Location update failed:", err);
    }
  },

  // ──────────────────────────────────────────
  // FIX #2: toggleOnline now also updates last_seen
  // so the user immediately appears fresh to others
  // ──────────────────────────────────────────
  toggleOnline: async (isOnline) => {
    const { currentUser } = get();
    if (!currentUser) return;

    set({
      currentUser: { ...currentUser, is_online: isOnline, isOnline },
    });

    try {
      await supabase
        .from("users")
        .update({ is_online: isOnline, last_seen: new Date().toISOString() })
        .eq("id", currentUser.id);
    } catch (err) {
      console.error("Toggle online failed:", err);
    }
  },

  togglePremium: async (isPremium) => {
    const { currentUser } = get();
    if (!currentUser) return;

    set({
      currentUser: { ...currentUser, is_premium: isPremium, isPremium },
    });

    try {
      await supabase
        .from("users")
        .update({ is_premium: isPremium })
        .eq("id", currentUser.id);
    } catch (err) {
      console.error("Toggle premium failed:", err);
    }
  },

  toggleDemoMode: (enabled) => {
    set({ demoMode: enabled });
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
    }

    if (enabled) {
      const { currentUser } = get();
      const baseLat = currentUser?.lat || KIGALI_CENTER.lat;
      const baseLng = currentUser?.lng || KIGALI_CENTER.lng;

      const oppositeRole = currentUser?.role === "driver" ? "passenger" : "driver";
      const namePrefix = oppositeRole === "driver" ? "Driver " : "Passenger ";

      const initialFakeUsers: User[] = Array.from({ length: 4 }).map((_, i) => ({
        id: `demo-driver-${i}`,
        name: `${namePrefix}${["Alice", "Bob", "Charlie", "Diana"][i]}`,
        role: oppositeRole,
        lat: baseLat + (Math.random() - 0.5) * 0.02,
        lng: baseLng + (Math.random() - 0.5) * 0.02,
        is_online: true,
        is_premium: false,
        location: { lat: 0, lng: 0 },
        isOnline: true,
        isPremium: false,
      }));

      // Update location objects
      initialFakeUsers.forEach(u => u.location = { lat: u.lat!, lng: u.lng! });

      set({ fakeUsers: initialFakeUsers });

      // Move them randomly every 3 seconds
      demoInterval = setInterval(() => {
        set((state) => ({
          fakeUsers: state.fakeUsers.map((u) => {
            const newLat = u.lat! + (Math.random() - 0.5) * 0.001;
            const newLng = u.lng! + (Math.random() - 0.5) * 0.001;
            return {
              ...u,
              lat: newLat,
              lng: newLng,
              location: { lat: newLat, lng: newLng }
            };
          })
        }));
      }, 3000);
    } else {
      set({ fakeUsers: [] });
    }
  },

  sendMessage: async (to, text) => {
    const { currentUser } = get();
    if (!currentUser) return;

    // 1. Is it a fake user? Bypass Supabase entirely!
    if (to.startsWith("demo-driver-")) {
      const fakeOutgoingMsg: Message = {
        id: `local-msg-${Date.now()}`,
        from_user: currentUser.id,
        to_user: to,
        text,
        created_at: new Date().toISOString(),
        from: currentUser.id,
        to: to,
        timestamp: Date.now()
      };
      
      set((state) => ({ messages: [...state.messages, fakeOutgoingMsg] }));

      // Trigger AI Response
      const { fakeUsers } = get();
      const driverObj = fakeUsers.find(u => u.id === to);
      const driverName = driverObj ? (driverObj.name.replace("Driver ", "").replace("Passenger ", "")) : "John";
      const driverRole = driverObj ? driverObj.role : "driver";

      setTimeout(async () => {
        try {
          const aiReply = await generateDriverResponse(driverName, text, driverRole);
          
          const fakeIncomingMsg: Message = {
            id: `local-msg-${Date.now() + 1}`,
            from_user: to,
            to_user: currentUser.id,
            text: aiReply,
            created_at: new Date().toISOString(),
            from: to,
            to: currentUser.id,
            timestamp: Date.now() + 1
          };

          set((state) => ({ messages: [...state.messages, fakeIncomingMsg] }));
        } catch (err) {
          console.error("AI response failed:", err);
        }
      }, 1500 + Math.random() * 2000);
      
      return;
    }

    // 2. Real user? Send to Supabase
    try {
      console.log("[MSG] Sending to", to, "text:", text.substring(0, 30));
      const { data, error } = await supabase
        .from("messages")
        .insert({ from_user: currentUser.id, to_user: to, text })
        .select()
        .single();

      if (error) {
        console.error("[MSG] Failed to send message:", error.message, error.details, error.hint);
        // If it's a foreign key violation, the recipient may have been deleted
        // Still show the message locally so the sender sees it
        const localMsg: Message = {
          id: `local-${Date.now()}`,
          from_user: currentUser.id,
          to_user: to,
          text,
          created_at: new Date().toISOString(),
          from: currentUser.id,
          to: to,
          timestamp: Date.now()
        };
        set((state) => ({ messages: [...state.messages, localMsg] }));
        return;
      }

      if (data) {
        const msg = mapMessage(data);
        const { messages } = get();
        if (!messages.find((m) => m.id === msg.id)) {
          set({ messages: [...messages, msg] });
        }
      }
    } catch (err) {
      console.error("Send message error:", err);
    }
  },

  cleanup: () => {
    const { channel, currentUser } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (currentUser) {
      // Mark offline, don't delete — stale cleanup will handle it
      supabase.from("users").update({ is_online: false }).eq("id", currentUser.id).then();
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
    }
    if (cleanupHandler) {
      window.removeEventListener("beforeunload", cleanupHandler);
      cleanupHandler = null;
    }
    set({ currentUser: null, users: [], messages: [], channel: null, fakeUsers: [], demoMode: false });
  },
}));
