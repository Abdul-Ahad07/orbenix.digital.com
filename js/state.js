import { db } from "./db.js";

const listeners = new Set();

export const state = {
  candidates: [],
  services: ["Client Hunting", "Website Development", "WordPress Development", "App Development (iOS/Android)", "AI Agent Development", "Business Automation", "Graphic Design", "UI/UX Design", "Video Editing", "Digital Marketing", "SEO (Search Engine Optimization)", "Social Media Management", "Content Writing", "Copywriting", "Virtual Assistant", "Data Entry", "Lead Generation"],
  activeTab: "Pending",
  search: "",
  serviceFilter: "",
  editingId: null,
  theme: "dark"
};

const SETTINGS_KEY = "cwaa_settings_v1";

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function notify() { listeners.forEach(fn => fn(state)); }

export async function loadAll() {
  const [candidates, metaServices] = await Promise.all([
    db.getAll("candidates"),
    db.get("meta", "services")
  ]);
  
  state.candidates = candidates || []; // Agar khali hai to khali hi rahega (No sample data)
  
  if (metaServices && Array.isArray(metaServices.value) && metaServices.value.length) {
    state.services = metaServices.value;
  }

  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (s.theme) state.theme = s.theme;
    if (Array.isArray(s.services) && s.services.length) state.services = s.services;
  } catch {}
  notify();
}

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    theme: state.theme, services: state.services
  }));
}

export async function upsertCandidate(c) {
  await db.put("candidates", c);
  const idx = state.candidates.findIndex(x => x.id === c.id);
  if (idx >= 0) state.candidates[idx] = c;
  else state.candidates.unshift(c);
  notify();
}

export async function removeCandidate(id) {
  await db.delete("candidates", id);
  state.candidates = state.candidates.filter(c => c.id !== id);
  notify();
}

export async function addService(name) {
  const clean = name.trim();
  if (!clean || state.services.includes(clean)) return false;
  state.services.push(clean);
  saveSettings();
  await db.put("meta", { key: "services", value: state.services });
  notify();
  return true;
}

export async function removeService(name) {
  state.services = state.services.filter(s => s !== name);
  saveSettings();
  await db.put("meta", { key: "services", value: state.services });
  notify();
}

export async function restoreAll(candidates, services) {
  await db.clear("candidates");
  await db.bulkPut("candidates", candidates);
  state.candidates = candidates;
  
  if (services && services.length) {
    state.services = services;
    await db.put("meta", { key: "services", value: state.services });
  }
  saveSettings();
  notify();
}
