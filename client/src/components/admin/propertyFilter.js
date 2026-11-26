import { useEffect, useMemo, useSyncExternalStore } from "react";
import apiRequest from "../../services/api";

// The admin's chosen property, shared by every admin page.
// Flow: load the properties (and their room ids) once per page visit -> the
// choice is saved in localStorage so it survives moving between pages and
// refreshing -> pages call matches(request) to keep only that property's rows.
// An empty id means "all properties", which is the default.

const KEY = "adminProperty";

function readSaved() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

function save(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the choice just lasts until refresh */
  }
}

let state = { properties: [], propertyId: readSaved(), loaded: false };
const listeners = new Set();

function emit(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let inflight = null;

// Refreshes the property list. Two components asking at once share one request.
export function loadProperties() {
  if (inflight) return inflight;

  inflight = apiRequest("/properties")
    .then((data) => {
      const list = Array.isArray(data.properties) ? data.properties : [];
      // A property that was deleted since last time falls back to "all".
      const stillThere = list.some((property) => property.id === state.propertyId);
      if (!stillThere) save("");
      emit({ properties: list, propertyId: stillThere ? state.propertyId : "", loaded: true });
    })
    .catch(() => emit({ loaded: true }))
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function selectProperty(id) {
  save(id);
  emit({ propertyId: id });
}

export function usePropertyFilter() {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    loadProperties();
  }, []);

  return useMemo(() => {
    const selected = snapshot.properties.find((property) => property.id === snapshot.propertyId) || null;
    const roomIds = new Set((selected?.rooms || []).map((room) => room.id));

    // Keep a row when no property is chosen, or when its room belongs to the
    // chosen property. Rows without a room id fall back to the property name.
    function matches(row) {
      if (!selected) return true;
      if (row.room_id) return roomIds.has(row.room_id);
      return row.property_name === selected.name;
    }

    return {
      properties: snapshot.properties,
      propertyId: selected ? selected.id : "",
      selected,
      loaded: snapshot.loaded,
      matches,
    };
  }, [snapshot]);
}