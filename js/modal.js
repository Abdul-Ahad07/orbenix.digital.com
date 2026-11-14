const root = document.getElementById("modalRoot");

export function openModal({ title, message, input, confirmText = "OK", cancelText = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        ${message ? `<p>${message}</p>` : ""}
        ${input ? `<input id="modalInput" placeholder="${input.placeholder || ""}" value="${input.value || ""}">` : ""}
        <div class="modal-actions">
          <button class="outline-btn" data-act="cancel">${cancelText}</button>
          <button class="${danger ? 'reject-btn' : 'primary-btn'}" data-act="ok">${confirmText}</button>
        </div>
      </div>`;
    root.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("show"));

    const inputEl = backdrop.querySelector("#modalInput");
    if (inputEl) setTimeout(() => inputEl.focus(), 100);

    const close = (val) => {
      backdrop.classList.remove("show");
      setTimeout(() => backdrop.remove(), 220);
      resolve(val);
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) return close(null);
      const act = e.target.dataset.act;
      if (act === "cancel") close(null);
      if (act === "ok") close(input ? (inputEl?.value || "") : true);
    });

    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") close(inputEl.value || "");
      });
    }
  });
}

export function confirmDialog(title, message, danger = false) {
  return openModal({ title, message, confirmText: "Confirm", danger });
}

export function promptDialog(title, placeholder, value = "") {
  return openModal({ title, input: { placeholder, value }, confirmText: "Save" });
}
