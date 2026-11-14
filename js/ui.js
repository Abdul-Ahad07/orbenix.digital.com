import { state } from "./state.js";
import { escapeHTML, safeUrl, getWaLink } from "./utils.js";

const $ = (id) => document.getElementById(id);

export function renderServices() {
  const trigger = $("serviceTrigger");
  const optionsContainer = $("serviceOptions");
  const filter = $("serviceFilter");
  
  if (optionsContainer) {
    optionsContainer.innerHTML = state.services.map(s => `
      <label class="custom-option">
        <input type="checkbox" value="${escapeHTML(s)}"> 
        ${escapeHTML(s)}
      </label>
    `).join("");
    
    // Bind changes
    const checkboxes = document.querySelectorAll('#serviceOptions input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.onchange = () => {
        const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
        if (selected.length === 0) trigger.textContent = "Select Services...";
        else if (selected.length === 1) trigger.textContent = selected[0];
        else trigger.textContent = `${selected.length} Services Selected`;
        
        toggleClientHunterFields();
      };
    });
    
    if (trigger) {
      trigger.onclick = () => $("serviceDropdown").classList.toggle("open");
      // Close on outside click
      document.addEventListener('click', (e) => {
        const drop = $("serviceDropdown");
        if (drop && !drop.contains(e.target)) drop.classList.remove("open");
      });
    }
  }
  
  if (filter) {
    filter.innerHTML = `<option value="">All Services</option>` + 
      state.services.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
  }
}

export function renderAdminLists() {
  const svcList = $("adminServiceList");
  if (!svcList) return;

  svcList.innerHTML = state.services.map(s => `
    <div class="skill" data-id="${escapeHTML(s)}">
      <span>${escapeHTML(s)}</span>
      <button type="button" data-remove="svc" data-name="${escapeHTML(s)}" style="color:var(--red); background:none; border:none; font-size:18px; min-height:auto; cursor:pointer;">&times;</button>
    </div>
  `).join("");
}

export function toggleClientHunterFields() {
  const fields = $("clientHunterFields");
  const checkboxes = document.querySelectorAll('#serviceOptions input[type="checkbox"]');
  if (!fields || !checkboxes.length) return;

  const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
  if (selected.includes("Client Hunting")) fields.classList.remove("hidden");
  else fields.classList.add("hidden");
}

export function renderStats() {
  const pending = state.candidates.filter(c => !["Approved","Rejected"].includes(c.status));
  const approved = state.candidates.filter(c => c.status === "Approved");
  const rejected = state.candidates.filter(c => c.status === "Rejected");

  $("pendingCount").textContent = pending.length;
  $("approvedCount").textContent = approved.length;
  $("rejectedCount").textContent = rejected.length;

  $("tabPending").textContent = pending.length;
  $("tabApproved").textContent = approved.length;
  $("tabRejected").textContent = rejected.length;
}

export function renderTabs() {
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === state.activeTab));
}

export function renderList() {
  const list = $("candidateList");
  if (!list) return;

  const search = state.search.toLowerCase().trim();

  const filtered = state.candidates.filter(c => {
    const hay = [c.name, c.service, ...(c.skills||[]), c.experience, c.notes].join(" ").toLowerCase();
    const statusOk = state.activeTab === "Pending" ? !["Approved","Rejected"].includes(c.status) : c.status === state.activeTab;
    return statusOk && hay.includes(search);
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">No candidates found.</div>`;
    return;
  }

  const groups = {};
  filtered.forEach(c => { 
    const svc = c.service ? c.service.split(',')[0].trim() : "Other";
    (groups[svc] ||= []).push(c); 
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Client Hunting") return -1;
    if (b === "Client Hunting") return 1;
    return a.localeCompare(b);
  });

  list.innerHTML = sortedKeys.map(svc => `
    <div class="service-group">
      <h3 class="service-title">${escapeHTML(svc)} (${groups[svc].length})</h3>
      ${groups[svc].map(renderCard).join("")}
    </div>
  `).join("");
}

function renderCard(c) {
  const skills = (c.skills || []).map(s => `<span class="skill">${escapeHTML(s)}</span>`).join("");
  const url = safeUrl(c.portfolio);
  const waLink = getWaLink(c.whatsapp, `Hi ${c.name}, I am the Admin from Team Manager.`);

  return `
    <article class="candidate-card" data-id="${escapeHTML(c.id)}">
      <div class="candidate-top">
        <div>
          <h3>${escapeHTML(c.name)}</h3>
          <div class="candidate-meta">
            ${c.whatsapp ? `<span style="color:var(--green);">📞 +${escapeHTML(c.whatsapp)}</span>` : ""}
          </div>
        </div>
        <span class="status ${escapeHTML(c.status)}">${escapeHTML(c.status)}</span>
      </div>

      <div style="margin: 8px 0; font-size: 12px;">
        <strong style="color:var(--yellow);">${escapeHTML(c.service)}</strong>
        ${c.projectSize ? `<span style="background:var(--panel2); padding:2px 6px; border-radius:4px; margin-left:5px; font-size:10px;">${escapeHTML(c.projectSize)}</span>` : ""}
      </div>

      <div class="skill-list">${skills}</div>

      ${url ? `<div class="detail-line">Portfolio: <a href="${escapeHTML(url)}" target="_blank" rel="noopener">Open Link</a></div>` : ""}
      ${c.notes ? `<div class="detail-line">Notes: ${escapeHTML(c.notes)}</div>` : ""}

      <div class="card-actions">
        ${waLink ? `<a href="${waLink}" target="_blank" class="approve-btn" style="flex:1; text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center; border:1px solid var(--green); background:rgba(165,255,63,.1); font-size:12px; font-weight:bold; border-radius:8px;">WhatsApp</a>` : ""}
        ${c.status !== "Approved" ? `<button class="approve-btn" data-action="approve">Approve</button>` : ""}
        ${c.status !== "Rejected" ? `<button class="reject-btn" data-action="reject">Reject</button>` : ""}
        ${c.status !== "Pending" ? `<button class="edit-btn" data-action="pending">Pending</button>` : ""}
        <button class="edit-btn" data-action="edit">Edit</button>
        <button class="delete-btn" data-action="delete">Delete</button>
      </div>
    </article>`;
}

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
}

export function renderAll() {
  renderStats();
  renderTabs();
  renderList();
}
