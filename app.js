// Printly uses one localStorage array as its tiny browser database.
const STORAGE_KEY = "printlyRequests";
const STATUSES = ["Pending", "Approved", "Printing", "Ready", "Collected"];

function getRequests() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (error) { return []; }
}

function saveRequests(requests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function makeRequestId() {
  const existingIds = getRequests().map(request => request.id);
  let id;
  do {
    const random = Math.floor(100000 + Math.random() * 900000);
    id = `PR-${random}`;
  } while (existingIds.includes(id));
  return id;
}

function showToast(message, type = "success") {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function statusClass(status) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function statusBadge(status) {
  return `<span class="status-badge ${statusClass(status)}">${escapeHTML(status)}</span>`;
}

function updateStats() {
  const requests = getRequests();
  const counts = {
    total: requests.length,
    pending: requests.filter(item => item.status === "Pending").length,
    printing: requests.filter(item => item.status === "Printing").length,
    ready: requests.filter(item => item.status === "Ready").length,
    active: requests.filter(item => ["Pending", "Approved", "Printing"].includes(item.status)).length
  };
  document.querySelectorAll("[data-stat]").forEach(element => {
    element.textContent = counts[element.dataset.stat] || 0;
  });
}

function initNavigation() {
  const button = document.querySelector(".menu-button");
  const nav = document.querySelector(".site-nav");
  if (button && nav) button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", open);
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  const page = document.body.dataset.page;
  const map = { home: "index.html", request: "new-request.html", requests: "requests.html", status: "status.html", admin: "admin.html" };
  document.querySelectorAll(".site-nav a").forEach(link => {
    if (link.getAttribute("href") === map[page]) link.classList.add("active");
  });
}

function initRequestForm() {
  const form = document.querySelector("#requestForm");
  if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      showToast("Please check the highlighted details.", "error");
      return;
    }
    const values = new FormData(form);
    const request = {
      id: makeRequestId(),
      studentName: values.get("studentName").trim(),
      registrationNumber: values.get("registrationNumber").trim(),
      email: values.get("email").trim(),
      documentName: values.get("documentName").trim(),
      copies: Number(values.get("copies")),
      paperSize: values.get("paperSize"),
      printType: values.get("printType"),
      printingSide: values.get("printingSide"),
      binding: values.get("binding") === "on",
      instructions: values.get("instructions").trim(),
      status: "Pending",
      createdAt: new Date().toISOString()
    };
    const requests = getRequests();
    requests.unshift(request);
    saveRequests(requests);
    showToast(`Request ${request.id} submitted!`);
    setTimeout(() => location.href = `status.html?id=${encodeURIComponent(request.id)}`, 700);
  });
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function matchesRequest(request, search, filter) {
  const haystack = `${request.id} ${request.documentName} ${request.studentName} ${request.registrationNumber}`.toLowerCase();
  return haystack.includes(search.toLowerCase()) && (filter === "All" || request.status === filter);
}

function emptyState(isSearch = false) {
  return `<div class="empty-state"><div class="empty-icon">${isSearch ? "⌕" : "▤"}</div><h3>${isSearch ? "No matching requests" : "Your queue is clear"}</h3><p>${isSearch ? "Try a different word or status filter." : "Create your first request and it will appear right here."}</p>${isSearch ? "" : '<a class="button button-dark" href="new-request.html">Create a request ↗</a>'}</div>`;
}

function requestRow(request) {
  return `<article class="request-row">
    <div class="request-primary"><strong>${escapeHTML(request.documentName)}</strong><small>${escapeHTML(request.studentName)} · ${formatDate(request.createdAt)}</small></div>
    <div class="request-cell"><span class="request-id">${escapeHTML(request.id)}</span><small>Request ID</small></div>
    <div class="request-cell"><b>${request.copies} × ${escapeHTML(request.paperSize)}</b><small>${escapeHTML(request.printType)}</small></div>
    <div>${statusBadge(request.status)}</div>
    <a class="view-link" href="status.html?id=${encodeURIComponent(request.id)}">View →</a>
  </article>`;
}

function initRequestsPage() {
  const list = document.querySelector("#requestsList");
  if (!list) return;
  const search = document.querySelector("#requestSearch");
  const filter = document.querySelector("#requestFilter");
  const render = () => {
    const all = getRequests();
    const filtered = all.filter(item => matchesRequest(item, search.value.trim(), filter.value));
    list.innerHTML = filtered.length ? filtered.map(requestRow).join("") : emptyState(Boolean(all.length));
    updateStats();
  };
  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  render();
}

function adminRow(request) {
  const options = STATUSES.map(status => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("");
  return `<article class="request-row">
    <div class="request-primary"><strong>${escapeHTML(request.documentName)}</strong><small>${escapeHTML(request.studentName)} · ${escapeHTML(request.registrationNumber)}</small></div>
    <div class="request-cell"><span class="request-id">${escapeHTML(request.id)}</span><small>${formatDate(request.createdAt)}</small></div>
    <div class="request-cell"><b>${request.copies} × ${escapeHTML(request.paperSize)}</b><small>${escapeHTML(request.printType)} · ${escapeHTML(request.printingSide)}</small></div>
    <div>${statusBadge(request.status)}</div>
    <select class="status-select" data-id="${escapeHTML(request.id)}" aria-label="Update status for ${escapeHTML(request.id)}">${options}</select>
  </article>`;
}

function initAdminPage() {
  const list = document.querySelector("#adminList");
  if (!list) return;
  const search = document.querySelector("#adminSearch");
  const filter = document.querySelector("#adminFilter");
  const render = () => {
    const all = getRequests();
    const filtered = all.filter(item => matchesRequest(item, search.value.trim(), filter.value));
    list.innerHTML = filtered.length ? filtered.map(adminRow).join("") : emptyState(Boolean(all.length));
    updateStats();
  };
  list.addEventListener("change", event => {
    if (!event.target.matches(".status-select")) return;
    const requests = getRequests();
    const item = requests.find(request => request.id === event.target.dataset.id);
    if (!item || !STATUSES.includes(event.target.value)) return;
    item.status = event.target.value;
    item.updatedAt = new Date().toISOString();
    saveRequests(requests);
    showToast(`${item.id} is now ${item.status}.`);
    render();
  });
  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  render();
}

function renderStatus(request) {
  const result = document.querySelector("#statusResult");
  if (!request) {
    result.innerHTML = '<div class="not-found"><b>That request could not be found.</b><br><small>Check the ID and try again. IDs look like PR-123456.</small></div>';
    return;
  }
  const currentIndex = request.status === "Collected" ? 4 : STATUSES.indexOf(request.status);
  const stages = ["Pending", "Approved", "Printing", "Ready"];
  result.innerHTML = `<section class="status-result">
    <div class="status-result-top"><div><span class="request-id">${escapeHTML(request.id)}</span><h2>${escapeHTML(request.documentName)}</h2><p>Submitted by ${escapeHTML(request.studentName)} on ${formatDate(request.createdAt)}</p></div>${statusBadge(request.status)}</div>
    <div class="status-details"><div><small>COPIES & PAPER</small><b>${request.copies} × ${escapeHTML(request.paperSize)}</b></div><div><small>PRINT STYLE</small><b>${escapeHTML(request.printType)}</b></div><div><small>LAYOUT</small><b>${escapeHTML(request.printingSide)}</b></div></div>
    <div class="progress-track">${stages.map((stage, index) => `<span class="progress-step ${index <= currentIndex ? "done" : ""}">${stage}</span>`).join("")}</div>
  </section>`;
}

function initStatusPage() {
  const form = document.querySelector("#statusForm");
  if (!form) return;
  const input = document.querySelector("#statusId");
  const track = () => {
    const id = input.value.trim().toUpperCase();
    if (!id) { showToast("Enter a request ID first.", "error"); return; }
    const request = getRequests().find(item => item.id.toUpperCase() === id);
    renderStatus(request);
  };
  form.addEventListener("submit", event => { event.preventDefault(); track(); });
  input.addEventListener("input", () => input.value = input.value.toUpperCase());
  const queryId = new URLSearchParams(location.search).get("id");
  if (queryId) { input.value = queryId.toUpperCase(); track(); }
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  updateStats();
  initRequestForm();
  initRequestsPage();
  initStatusPage();
  initAdminPage();
});

window.addEventListener("storage", () => {
  updateStats();
  if (document.querySelector("#requestsList")) location.reload();
});
