import { db } from "./db.js";
import {
  state, loadAll, subscribe, upsertCandidate, removeCandidate,
  addService, restoreAll, saveSettings, removeService
} from "./state.js";
import {
  renderAll, renderServices, renderAdminLists, applyTheme, toggleClientHunterFields
} from "./ui.js";
import { createId, debounce, showToast, downloadBlob, toCsv } from "./utils.js";
import { confirmDialog } from "./modal.js";

const $ = (id) => document.getElementById(id);
const ADMIN_PASSWORD = "JA@1";

// UNLOCK LOGIC
document.getElementById("unlockBtn").addEventListener("click", () => {
  const pwd = document.getElementById("adminPassword").value;
  if (pwd === ADMIN_PASSWORD) {
    sessionStorage.setItem("cwaa_logged", "true");
    document.getElementById("lockScreen").classList.add("hidden");
    document.getElementById("mainApp").classList.remove("hidden");
    initApp();
  } else {
    alert("Wrong Password!");
  }
});

document.getElementById("adminPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("unlockBtn").click();
});

if (sessionStorage.getItem("cwaa_logged") === "true") {
  document.getElementById("lockScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  initApp();
}

async function initApp() {
  if (window._appInited) return;
  window._appInited = true;

  applyTheme();
  await loadAll();
  renderServices();
  renderAdminLists();
  renderAll();
  bindEvents();
  
  subscribe(() => {
    renderAll();
    renderAdminLists();
    renderOverviewSkills(); // Overview update
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

// NAYA FUNCTION: Team Skills Overview Renderer
function renderOverviewSkills() {
  const approvedDiv = $("approvedSkillsList");
  const pendingDiv = $("pendingSkillsList");
  if (!approvedDiv || !pendingDiv) return;

  const getUniqueServices = (status) => {
    const filtered = state.candidates.filter(c => c.status === status);
    const skillsSet = new Set();
    
    filtered.forEach(c => {
      if (c.service) {
        c.service.split(',').forEach(s => {
          if (s.trim()) skillsSet.add(s.trim());
        });
      }
    });
    
    if (skillsSet.size === 0) return `<span style="color:var(--muted); font-size:12px;">Koi skills nahi.</span>`;
    return Array.from(skillsSet).map(s => `<span class="skill-tag">${escapeHTML(s)}</span>`).join("");
  };

  approvedDiv.innerHTML = getUniqueServices("Approved");
  pendingDiv.innerHTML = getUniqueServices("Pending");
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
}

function bindEvents() {
  $("adminBtn").addEventListener("click", () => $("adminPanel").classList.toggle("hidden"));

  $("addServiceAdminBtn").addEventListener("click", async () => {
    const val = $("newServiceAdmin").value;
    if (!val.trim()) return;
    if (await addService(val)) {
      $("newServiceAdmin").value = "";
      renderServices();
      showToast("Service added");
    } else showToast("Already exists");
  });

  $("adminServiceList").addEventListener("click", async (e) => {
    const btn = e.target.closest('button[data-remove="svc"]');
    if (!btn) return;
    if (await confirmDialog("Remove?", `Delete "${btn.dataset.name}"?`, true)) {
      await removeService(btn.dataset.name);
      renderServices();
      showToast("Removed");
    }
  });

  // Auto-Fill Parser
  $("parseBtn").addEventListener("click", () => {
    const raw = $("pasteData").value.trim();
    if (!raw) return showToast("Paste data first");
    const lines = raw.split('\n');
    const getVal = (key) => {
      const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'));
      return line ? line.split(':').slice(1).join(':').trim() : "";
    };

    const name = getVal("Name");
    const whatsapp = getVal("WhatsApp");
    const services = getVal("Service"); // Comma separated
    const skills = getVal("Skills");
    const portfolio = getVal("Portfolio") === "None" ? "" : getVal("Portfolio");
    const notes = getVal("Notes") === "None" ? "" : getVal("Notes");

    if (!name) return showToast("Could not parse Name");
    
    $("name").value = name;
    $("whatsapp").value = whatsapp;
    
    // Set multiple services
    const servicesArr = services.split(',').map(s => s.trim());
    const selectEl = $("service");
    Array.from(selectEl.options).forEach(opt => {
      opt.selected = servicesArr.includes(opt.value);
    });
    
    toggleClientHunterFields();
    $("skills").value = skills;
    $("portfolio").value = portfolio;
    $("notes").value = notes;
    
    $("pasteData").value = "";
    showToast("Auto-filled! Check and Save.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Form Submit
  $("candidateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = $("editId").value;
    const name = $("name").value.trim();
    if (!name) return showToast("Name required");

    let status = "Pending";
    if (editId) {
      const old = state.candidates.find(c => c.id === editId);
      if (old) status = old.status;
    }

    const selectEl = $("service");
    const selectedServices = Array.from(selectEl.selectedOptions).map(o => o.value);
    
    if (selectedServices.length === 0) return showToast("Select at least one service");

    const isClientHunter = selectedServices.includes("Client Hunting");

    const candidate = {
      id: editId || createId(),
      name: name,
      whatsapp: $("whatsapp").value.replace(/\D/g, ''),
      service: selectedServices.join(", "),
      projectSize: isClientHunter ? $("projectSize").value : "Project Base",
      skills: $("skills").value.split(",").map(s => s.trim()).filter(Boolean),
      portfolio: $("portfolio").value.trim(),
      availability: "Project Base",
      status: status,
      notes: $("notes").value.trim()
    };

    await upsertCandidate(candidate);
    $("candidateForm").reset();
    $("editId").value = "";
    $("saveBtn").textContent = "Save Candidate";
    $("cancelEdit").classList.add("hidden");
    toggleClientHunterFields();
    showToast(editId ? "Updated!" : "Saved!");
    if (!editId) { state.activeTab = "Pending"; renderAll(); }
    renderOverviewSkills();
  });

  $("cancelEdit").addEventListener("click", () => {
    $("candidateForm").reset();
    $("editId").value = "";
    $("saveBtn").textContent = "Save Candidate";
    $("cancelEdit").classList.add("hidden");
    toggleClientHunterFields();
  });

  $("service").addEventListener("change", toggleClientHunterFields);

  $("searchInput").addEventListener("input", debounce((e) => { state.search = e.target.value; renderAll(); }, 200));
  $("serviceFilter").addEventListener("change", (e) => { state.serviceFilter = e.target.value; renderAll(); });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => { state.activeTab = btn.dataset.tab; renderAll(); });
  });

  // Card Actions
  $("candidateList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".candidate-card");
    const id = card.dataset.id;
    const action = btn.dataset.action;
    const c = state.candidates.find(x => x.id === id);
    if (!c) return;

    if (["approve", "reject", "pending"].includes(action)) {
      const map = { approve: ["Approved", "Approve"], reject: ["Rejected", "Reject"], pending: ["Pending", "Pending"] };
      const [newStatus, label] = map[action];
      if (!(await confirmDialog(label + "?", `Move ${c.name} to ${newStatus}?`, action === "reject"))) return;
      c.status = newStatus;
      await upsertCandidate(c);
      showToast("Moved to " + newStatus);
      renderOverviewSkills();
      return;
    }

    if (action === "edit") {
      $("editId").value = c.id;
      $("name").value = c.name;
      $("whatsapp").value = c.whatsapp || "";
      
      const servicesArr = c.service ? c.service.split(',').map(s => s.trim()) : [];
      Array.from($("service").options).forEach(opt => {
        opt.selected = servicesArr.includes(opt.value);
      });
      
      toggleClientHunterFields();
      if (servicesArr.includes("Client Hunting")) $("projectSize").value = c.projectSize;
      
      $("skills").value = (c.skills || []).join(", ");
      $("portfolio").value = c.portfolio || "";
      $("notes").value = c.notes || "";
      $("saveBtn").textContent = "Update Candidate";
      $("cancelEdit").classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "delete") {
      if (!(await confirmDialog("Delete?", `Delete ${c.name}?`, true))) return;
      await removeCandidate(id);
      showToast("Deleted");
      renderOverviewSkills();
    }
  });

  // Backup
  $("backupBtn").addEventListener("click", exportBackup);
  $("exportBtn").addEventListener("click", exportBackup);
  $("exportCsvBtn").addEventListener("click", exportCsv);
  $("importInput").addEventListener("change", importBackup);

  // Theme
  $("themeBtn").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveSettings();
    applyTheme();
  });
}

function exportBackup() {
  downloadBlob(JSON.stringify({
    app: "Team Manager", version: 6, exportedAt: new Date().toISOString(),
    services: state.services, candidates: state.candidates
  }, null, 2), `team-backup-${new Date().toISOString().slice(0,10)}.json`);
  showToast("Backup downloaded");
}

function exportCsv() {
  const rows = state.candidates.map(c => ({
    Name: c.name, WhatsApp: c.whatsapp || "", Service: c.service,
    ProjectSize: c.projectSize || "", Skills: (c.skills || []).join(", "),
    Portfolio: c.portfolio || "", Availability: c.availability || "",
    Status: c.status, Notes: c.notes || ""
  }));
  if (!rows.length) return showToast("No data");
  downloadBlob(toCsv(rows), `team-${new Date().toISOString().slice(0,10)}.csv`, "text/csv;charset=utf-8;");
  showToast("CSV exported");
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!Array.isArray(backup.candidates) || !Array.isArray(backup.services)) throw new Error();
      if (!(await confirmDialog("Restore?", "Current data replace ho jayega?", true))) return;
      await restoreAll(backup.candidates, backup.services);
      renderServices(); renderAll();
      showToast("Backup restored");
      renderOverviewSkills();
    } catch { showToast("Invalid file"); }
    e.target.value = "";
  };
  reader.readAsText(file);
  }
