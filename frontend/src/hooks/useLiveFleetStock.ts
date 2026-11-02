
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { fetchFleetStock, FleetVehicleStockDto } from "../utils/api";
import { isEffectivelyOffline } from "../store/useNetworkStore";
import useAuthStore from "../store/useAuthStore";
import { useNetworkStatus } from "./useNetworkStatus";

export function useLiveFleetStock({
  vehicleId,
  search,
  onUpdate,
  interval = 15000,
  fetchFleet = true,
}: {
  vehicleId?: string;
  search?: string;
  onUpdate: (data: FleetVehicleStockDto[]) => void;
  interval?: number;
  // false: only trigger onUpdate (with an empty list) instead of loading the whole fleet.
  // Technicians reload their own vehicle in onUpdate; the fleet overview would be wasted traffic.
  fetchFleet?: boolean;
}) {
  // Aktuelle Werte per Ref speichern
  const vehicleIdRef = useRef(vehicleId);
  const searchRef = useRef(search);
  const onUpdateRef = useRef(onUpdate);
  const fetchFleetRef = useRef(fetchFleet);
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);
  const token = useAuthStore((state: any) => state.token);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    vehicleIdRef.current = vehicleId;
    searchRef.current = search;
    onUpdateRef.current = onUpdate;
    fetchFleetRef.current = fetchFleet;
  }, [vehicleId, search, onUpdate, fetchFleet]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    async function loadData() {
      // Ohne diesen Check versucht der Hook alle `interval`ms (Default 15s)
      // Live-Daten zu laden, auch wenn der Server bekanntermassen nicht
      // erreichbar ist (z.B. Techniker im Aussendienst) - jeder Versuch
      // haengt dann bis zum Netzwerk-Timeout statt sofort abzubrechen.
      if (isEffectivelyOffline()) return;
      if (!fetchFleetRef.current) {
        if (active) onUpdateRef.current([]);
        return;
      }
      try {
        const result = await fetchFleetStock({ vehicleId: vehicleIdRef.current, search: searchRef.current });
        if (active) onUpdateRef.current(result);
      } catch (error) {
        console.error("[useLiveFleetStock] Fehler beim Laden:", error);
        // Bei Fehlern nicht das UI zerstören
      }
    }
    loadDataRef.current = loadData;

    // Initiales Laden nur wenn interval > 0
    if (interval > 0) {
      loadData();
      timer = window.setInterval(loadData, interval);
    }

    return () => {
      active = false;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [interval]); // Nur bei Intervall-Änderung neu starten

  // Push-Update: sobald sich Bestand/Fehlmengen aendern (z.B. ein
  // Aussendiensttechniker bucht Teile aus und es entsteht eine neue
  // Fehlmenge), sendet der Server "restock:updated". Ohne diesen Listener
  // sah das Teilelager eine neue Fehlmenge erst nach bis zu `interval`ms
  // Polling-Verzoegerung - jetzt erscheint sie quasi sofort, das Intervall
  // bleibt nur als Fallback falls der Socket kurz getrennt ist.
  useEffect(() => {
    if (!token || !isOnline || isEffectivelyOffline()) return;

    const socket: Socket = io("/stock", {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    socket.on("restock:updated", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadDataRef.current?.();
      }, 400);
    });

    // A phone freezes timers and sockets while the app is in the background, so push events are
    // missed. Reload as soon as the app is visible again and after every reconnect.
    const refreshOnResume = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) socket.connect();
      void loadDataRef.current?.();
    };
    const refreshAfterReconnect = () => void loadDataRef.current?.();
    document.addEventListener("visibilitychange", refreshOnResume);
    window.addEventListener("online", refreshOnResume);
    socket.io.on("reconnect", refreshAfterReconnect);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", refreshOnResume);
      window.removeEventListener("online", refreshOnResume);
      socket.io.off("reconnect", refreshAfterReconnect);
      socket.disconnect();
    };
  }, [token, isOnline]);
}
