/* SupportDesk frontend — vanilla SPA, EN/AR, real API calls. */
"use strict";

const I18N = {
  en: {
    tagline: "Customer Support Portal",
    nav_dashboard: "Dashboard",
    nav_tickets: "Tickets",
    nav_invoices: "Invoices",
    logout: "Log out",
    footer_note: "Secure portal · support@acme.support · +966 11 234 5678",
    hero_title: "Support that speaks your language.",
    hero_sub: "Open tickets, track progress, and download VAT invoices — in English or Arabic. Built for Acme Support customers across Riyadh, Dubai, and Cairo.",
    hero_bullets: ["Response within 1 business day", "Transparent per-ticket pricing", "PDF invoices for accounting"],
    login_title: "Welcome back",
    login_sub: "Log in to manage your tickets and invoices.",
    register_title: "Create your account",
    register_sub: "One account for tickets, invoices, and support history.",
    name: "Full name",
    email: "Email",
    password: "Password",
    login_btn: "Log in",
    register_btn: "Create account",
    have_account: "Have an account? Log in",
    no_account: "New here? Create an account",
    dash_title: "Dashboard",
    dash_sub: "Your support overview.",
    stat_tickets: "Tickets",
    stat_open: "Open tickets",
    stat_invoices: "Invoices",
    stat_total: "Total billed",
    recent_tickets: "Recent tickets",
    recent_invoices: "Recent invoices",
    view_all: "View all",
    new_ticket: "New ticket",
    tickets_title: "Support tickets",
    subject: "Subject",
    category: "Category",
    priority: "Priority",
    message: "Message",
    status: "Status",
    created: "Created",
    actions: "Actions",
    open_btn: "Open",
    submit_ticket: "Submit ticket",
    ticket_detail: "Ticket",
    back: "Back",
    generate_invoice: "Generate invoice",
    download_pdf: "Download PDF",
    invoices_title: "Invoices",
    invoice_no: "Invoice",
    ticket: "Ticket",
    amount: "Amount",
    due: "Due",
    empty_tickets: "No tickets yet. Create your first ticket to get help.",
    empty_invoices: "No invoices yet. Open a ticket, then generate its invoice.",
    loading: "Loading…",
    need_login: "Please log in or create an account to continue.",
    new_ticket_title: "New support ticket",
    new_ticket_sub: "Describe the issue. Our team replies within one business day.",
    submit_note: "Invoices are generated per ticket from the ticket detail or invoices page.",
    lang_btn: "عربي",
  },
  ar: {
    tagline: "بوابة دعم العملاء",
    nav_dashboard: "لوحة التحكم",
    nav_tickets: "التذاكر",
    nav_invoices: "الفواتير",
    logout: "تسجيل الخروج",
    footer_note: "بوابة آمنة · support@acme.support · ‎+966 11 234 5678",
    hero_title: "دعم يتحدث لغتك.",
    hero_sub: "افتح التذاكر وتابع التقدم وحمّل فواتير ضريبية — بالعربية أو الإنجليزية. مصمم لعملاء أكمي للدعم في الرياض ودبي والقاهرة.",
    hero_bullets: ["رد خلال يوم عمل واحد", "أسعار شفافة لكل تذكرة", "فواتير PDF للمحاسبة"],
    login_title: "مرحباً بعودتك",
    login_sub: "سجّل الدخول لإدارة التذاكر والفواتير.",
    register_title: "أنشئ حسابك",
    register_sub: "حساب واحد للتذاكر والفواتير وسجل الدعم.",
    name: "الاسم الكامل",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    login_btn: "تسجيل الدخول",
    register_btn: "إنشاء الحساب",
    have_account: "لديك حساب؟ سجّل الدخول",
    no_account: "جديد هنا؟ أنشئ حساباً",
    dash_title: "لوحة التحكم",
    dash_sub: "نظرة عامة على الدعم الخاص بك.",
    stat_tickets: "التذاكر",
    stat_open: "تذاكر مفتوحة",
    stat_invoices: "الفواتير",
    stat_total: "إجمالي الفوترة",
    recent_tickets: "أحدث التذاكر",
    recent_invoices: "أحدث الفواتير",
    view_all: "عرض الكل",
    new_ticket: "تذكرة جديدة",
    tickets_title: "تذاكر الدعم",
    subject: "الموضوع",
    category: "الفئة",
    priority: "الأولوية",
    message: "الرسالة",
    status: "الحالة",
    created: "أُنشئت",
    actions: "إجراءات",
    open_btn: "فتح",
    submit_ticket: "إرسال التذكرة",
    ticket_detail: "التذكرة",
    back: "رجوع",
    generate_invoice: "إصدار فاتورة",
    download_pdf: "تحميل PDF",
    invoices_title: "الفواتير",
    invoice_no: "الفاتورة",
    ticket: "التذكرة",
    amount: "المبلغ",
    due: "الاستحقاق",
    empty_tickets: "لا توجد تذاكر بعد. أنشئ أول تذكرة للحصول على المساعدة.",
    empty_invoices: "لا توجد فواتير بعد. افتح تذكرة ثم أصدر فاتورتها.",
    loading: "جارٍ التحميل…",
    need_login: "يرجى تسجيل الدخول أو إنشاء حساب للمتابعة.",
    new_ticket_title: "تذكرة دعم جديدة",
    new_ticket_sub: "صف المشكلة. يرد فريقنا خلال يوم عمل واحد.",
    submit_note: "تُصدر الفواتير لكل تذكرة من صفحة التذكرة أو الفواتير.",
    lang_btn: "EN",
  },
};

let LANG = localStorage.getItem("sd_lang") || "en";
if (LANG !== "en" && LANG !== "ar") LANG = "en";
function t(k) { return (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k; }

function applyI18n() {
  document.documentElement.lang = LANG === "ar" ? "ar" : "en";
  document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (k) el.textContent = t(k);
  });
  const btn = document.getElementById("lang-toggle");
  if (btn) btn.textContent = t("lang_btn");
}

let ME = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._h);
  el._h = setTimeout(() => { el.hidden = true; }, 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const ct = res.headers.get("Content-Type") || "";
  let data = null;
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text();
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function refreshMe() {
  try {
    const d = await api("/api/me");
    ME = d.user;
  } catch { ME = null; }
  const nav = document.getElementById("main-nav");
  const chip = document.getElementById("user-chip");
  const lo = document.getElementById("logout-btn");
  if (ME) {
    nav.hidden = false;
    chip.hidden = false;
    lo.hidden = false;
    chip.textContent = ME.name + " · " + ME.email;
  } else {
    nav.hidden = true;
    chip.hidden = true;
    lo.hidden = true;
  }
}

function moneyFmt(cents) { return "$" + (cents / 100).toFixed(2); }
function d10(iso) { return String(iso || "").slice(0, 10); }

function layout(inner) {
  return inner;
}

function viewLanding() {
  return layout(`
    <div class="hero">
      <div class="card">
        <h1>${esc(t("hero_title"))}</h1>
        <p class="muted">${esc(t("hero_sub"))}</p>
        <ul>${I18N[LANG].hero_bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        <div class="notice">${esc(t("submit_note"))}</div>
      </div>
      <div class="card">
        <div class="auth-tabs">
          <button class="btn" id="tab-login" type="button">${esc(t("login_btn"))}</button>
          <button class="btn" id="tab-register" type="button">${esc(t("register_btn"))}</button>
        </div>
        <div id="auth-forms"></div>
      </div>
    </div>`);
}

function loginForm() {
  return `
    <h2 style="margin:6px 0">${esc(t("login_title"))}</h2>
    <p class="muted">${esc(t("login_sub"))}</p>
    <div id="auth-err"></div>
    <form id="f-login">
      <label>${esc(t("email"))}<input name="email" type="email" required autocomplete="email" /></label>
      <label>${esc(t("password"))}<input name="password" type="password" required autocomplete="current-password" /></label>
      <button class="btn primary" style="margin-top:12px;width:100%" type="submit">${esc(t("login_btn"))}</button>
    </form>`;
}

function registerForm() {
  return `
    <h2 style="margin:6px 0">${esc(t("register_title"))}</h2>
    <p class="muted">${esc(t("register_sub"))}</p>
    <div id="auth-err"></div>
    <form id="f-register">
      <label>${esc(t("name"))}<input name="name" required minlength="2" maxlength="80" autocomplete="name" /></label>
      <label>${esc(t("email"))}<input name="email" type="email" required autocomplete="email" /></label>
      <label>${esc(t("password"))}<input name="password" type="password" required minlength="8" autocomplete="new-password" /></label>
      <button class="btn primary" style="margin-top:12px;width:100%" type="submit">${esc(t("register_btn"))}</button>
      <p class="hint">Min 8 characters. Stored with PBKDF2-SHA256 + per-user salt.</p>
    </form>`;
}

async function viewDashboard() {
  if (!ME) return `<div class="card"><p>${esc(t("need_login"))}</p><p><a href="#/">${esc(t("login_btn"))}</a></p></div>`;
  let tickets = [], invoices = [];
  try {
    const a = await api("/api/tickets");
    const b = await api("/api/invoices");
    tickets = a.tickets || []; invoices = b.invoices || [];
  } catch (e) { return `<div class="alert">${esc(e.message)}</div>`; }
  const open = tickets.filter((x) => x.status === "open").length;
  const total = invoices.reduce((s, x) => s + (x.amount_cents || 0), 0);
  const recentT = tickets.slice(0, 5);
  const recentI = invoices.slice(0, 5);
  return `
    <h1>${esc(t("dash_title"))}</h1><p class="muted">${esc(t("dash_sub"))}</p>
    <div class="kpis">
      <div class="kpi"><span class="muted">${esc(t("stat_tickets"))}</span><b>${tickets.length}</b></div>
      <div class="kpi"><span class="muted">${esc(t("stat_open"))}</span><b>${open}</b></div>
      <div class="kpi"><span class="muted">${esc(t("stat_invoices"))}</span><b>${invoices.length}</b></div>
      <div class="kpi"><span class="muted">${esc(t("stat_total"))}</span><b>${moneyFmt(total)}</b></div>
    </div>
    <div class="grid two">
      <div class="card"><div class="toolbar"><strong>${esc(t("recent_tickets"))}</strong><a href="#/tickets">${esc(t("view_all"))}</a></div>
        ${recentT.length ? `<table><thead><tr><th>#</th><th>${esc(t("subject"))}</th><th>${esc(t("status"))}</th></tr></thead><tbody>` +
          recentT.map((x) => `<tr><td>${x.id}</td><td><a href="#/tickets/${x.id}">${esc(x.subject)}</a></td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td></tr>`).join("") + `</tbody></table>` : `<p class="muted">${esc(t("empty_tickets"))}</p>`}
      </div>
      <div class="card"><div class="toolbar"><strong>${esc(t("recent_invoices"))}</strong><a href="#/invoices">${esc(t("view_all"))}</a></div>
        ${recentI.length ? `<table><thead><tr><th>${esc(t("invoice_no"))}</th><th>${esc(t("amount"))}</th><th></th></tr></thead><tbody>` +
          recentI.map((x) => `<tr><td>${esc(x.invoice_number)}</td><td>${moneyFmt(x.amount_cents)}</td><td><button class="btn small" data-dl="${x.id}">${esc(t("download_pdf"))}</button></td></tr>`).join("") + `</tbody></table>` : `<p class="muted">${esc(t("empty_invoices"))}</p>`}
      </div>
    </div>`;
}

async function viewTickets() {
  if (!ME) return `<div class="card"><p>${esc(t("need_login"))}</p></div>`;
  let tickets = [];
  try { tickets = (await api("/api/tickets")).tickets || []; }
  catch (e) { return `<div class="alert">${esc(e.message)}</div>`; }
  return `
    <div class="toolbar"><h1 style="margin:0">${esc(t("tickets_title"))}</h1><a class="btn primary" href="#/tickets/new">${esc(t("new_ticket"))}</a></div>
    <div class="card" style="padding:0;overflow:auto">
    ${tickets.length ? `<table><thead><tr><th>#</th><th>${esc(t("subject"))}</th><th>${esc(t("category"))}</th><th>${esc(t("priority"))}</th><th>${esc(t("status"))}</th><th>${esc(t("created"))}</th><th>${esc(t("actions"))}</th></tr></thead><tbody>` +
      tickets.map((x) => `<tr><td>${x.id}</td><td><a href="#/tickets/${x.id}">${esc(x.subject)}</a></td><td>${esc(x.category)}</td><td><span class="badge ${esc(x.priority)}">${esc(x.priority)}</span></td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(d10(x.created_at))}</td><td><a class="btn small" href="#/tickets/${x.id}">${esc(t("open_btn"))}</a></td></tr>`).join("") + `</tbody></table>`
      : `<p style="padding:16px" class="muted">${esc(t("empty_tickets"))}</p>`}
    </div>`;
}

function viewNewTicket() {
  if (!ME) return `<div class="card"><p>${esc(t("need_login"))}</p></div>`;
  return `
    <h1>${esc(t("new_ticket_title"))}</h1><p class="muted">${esc(t("new_ticket_sub"))}</p>
    <div class="card"><div id="nt-err"></div>
      <form id="f-ticket">
        <label>${esc(t("subject"))}<input name="subject" required minlength="5" maxlength="120" placeholder="VPN drops every 30 minutes" /></label>
        <div class="form-row">
          <label>${esc(t("category"))}<select name="category"><option>Technical</option><option>Billing</option><option>Account</option><option>Feature</option><option>General</option></select></label>
          <label>${esc(t("priority"))}<select name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Urgent</option></select></label>
        </div>
        <label>${esc(t("message"))}<textarea name="message" required minlength="10" maxlength="5000" placeholder="Steps to reproduce, users affected, error messages…"></textarea></label>
        <button class="btn primary" type="submit">${esc(t("submit_ticket"))}</button>
      </form>
    </div>`;
}

async function viewTicketDetail(id) {
  if (!ME) return `<div class="card"><p>${esc(t("need_login"))}</p></div>`;
  let ticket;
  try { ticket = (await api("/api/tickets/" + id)).ticket; }
  catch (e) { return `<div class="alert">${esc(e.message)}</div><p><a href="#/tickets">${esc(t("back"))}</a></p>`; }
  return `
    <p><a href="#/tickets">← ${esc(t("back"))}</a></p>
    <div class="card">
      <h1 style="margin-top:0">#${ticket.id} — ${esc(ticket.subject)}</h1>
      <p><span class="badge ${esc(ticket.status)}">${esc(ticket.status)}</span> <span class="badge ${esc(ticket.priority)}">${esc(ticket.priority)}</span> <span class="muted">${esc(ticket.category)} · ${esc(d10(ticket.created_at))}</span></p>
      <p style="white-space:pre-wrap">${esc(ticket.message)}</p>
      <div class="toolbar"><span class="muted">${esc(t("submit_note"))}</span><span><button class="btn primary" id="gen-inv" data-ticket="${ticket.id}">${esc(t("generate_invoice"))}</button></span></div>
      <div id="inv-result"></div>
    </div>`;
}

async function viewInvoices() {
  if (!ME) return `<div class="card"><p>${esc(t("need_login"))}</p></div>`;
  let invoices = [];
  try { invoices = (await api("/api/invoices")).invoices || []; }
  catch (e) { return `<div class="alert">${esc(e.message)}</div>`; }
  return `
    <h1>${esc(t("invoices_title"))}</h1>
    <div class="card" style="padding:0;overflow:auto">
    ${invoices.length ? `<table><thead><tr><th>${esc(t("invoice_no"))}</th><th>${esc(t("ticket"))}</th><th>${esc(t("amount"))}</th><th>${esc(t("status"))}</th><th>${esc(t("due"))}</th><th>${esc(t("actions"))}</th></tr></thead><tbody>` +
      invoices.map((x) => `<tr><td>${esc(x.invoice_number)}</td><td>${x.ticket_id} · ${esc(x.ticket_subject || "")}</td><td>${moneyFmt(x.amount_cents)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(d10(x.due_date))}</td><td><button class="btn small" data-dl="${x.id}">${esc(t("download_pdf"))}</button></td></tr>`).join("") + `</tbody></table>`
      : `<p style="padding:16px" class="muted">${esc(t("empty_invoices"))}</p>`}
    </div>`;
}

async function downloadInvoice(id) {
  const res = await fetch("/api/invoices/" + id + "/download", { credentials: "same-origin" });
  if (!res.ok) {
    let msg = "Download failed (" + res.status + ")";
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^";]+)"?/);
  const name = m ? m[1] : ("invoice-" + id + ".pdf");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

async function render() {
  applyI18n();
  await refreshMe();
  applyI18n();
  const app = document.getElementById("app");
  const hash = location.hash || "#/";
  const [, path] = hash.split("#");
  const route = path || "/";

  try {
    if (!ME && (route === "/" )) {
      app.innerHTML = viewLanding();
      bindAuthTabs("login");
    } else if (route === "/" && ME) {
      location.hash = "#/dashboard";
      return;
    } else if (route === "/dashboard") {
      app.innerHTML = `<p class="muted">${esc(t("loading"))}</p>`;
      app.innerHTML = await viewDashboard();
    } else if (route === "/tickets") {
      app.innerHTML = `<p class="muted">${esc(t("loading"))}</p>`;
      app.innerHTML = await viewTickets();
    } else if (route === "/tickets/new") {
      app.innerHTML = viewNewTicket();
      const f = document.getElementById("f-ticket");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        try {
          const d = await api("/api/tickets", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)) });
          location.hash = "#/tickets/" + d.ticket.id;
        } catch (err) {
          document.getElementById("nt-err").innerHTML = `<div class="alert">${esc(err.message)}</div>`;
        }
      });
    } else if (route.startsWith("/tickets/")) {
      const id = route.split("/")[2];
      app.innerHTML = `<p class="muted">${esc(t("loading"))}</p>`;
      app.innerHTML = await viewTicketDetail(id);
      const g = document.getElementById("gen-inv");
      if (g) g.addEventListener("click", async () => {
        g.disabled = true;
        try {
          const d = await api("/api/invoices", { method: "POST", body: JSON.stringify({ ticket_id: Number(g.dataset.ticket) }) });
          document.getElementById("inv-result").innerHTML = `<div class="notice">Invoice <b>${esc(d.invoice.invoice_number)}</b> ready — ${moneyFmt(d.invoice.amount_cents)}. <button class="btn small" data-dl="${d.invoice.id}">${esc(t("download_pdf"))}</button></div>`;
        } catch (err) { toast(err.message); }
        finally { g.disabled = false; }
      });
    } else if (route === "/invoices") {
      app.innerHTML = `<p class="muted">${esc(t("loading"))}</p>`;
      app.innerHTML = await viewInvoices();
    } else {
      app.innerHTML = `<div class="card"><h2>404</h2><p><a href="#/">${esc(t("back"))}</a></p></div>`;
    }
  } catch (e) {
    app.innerHTML = `<div class="alert">${esc(e.message)}</div>`;
  }

  // landing auth bindings
  const fl = document.getElementById("f-login");
  if (fl) fl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(fl);
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)) });
      location.hash = "#/dashboard"; await render();
    } catch (err) { document.getElementById("auth-err").innerHTML = `<div class="alert">${esc(err.message)}</div>`; }
  });
  const fr = document.getElementById("f-register");
  if (fr) fr.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(fr);
    try {
      await api("/api/register", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)) });
      location.hash = "#/dashboard"; await render();
    } catch (err) { document.getElementById("auth-err").innerHTML = `<div class="alert">${esc(err.message)}</div>`; }
  });

  document.querySelectorAll("[data-dl]").forEach((b) => {
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await downloadInvoice(b.getAttribute("data-dl")); }
      catch (e) { toast(e.message); }
      finally { b.disabled = false; }
    });
  });

  document.querySelectorAll("#main-nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === "#" + route.split("/").slice(0, 2).join("/"));
  });
}

function bindAuthTabs(which) {
  const host = document.getElementById("auth-forms");
  const tl = document.getElementById("tab-login");
  const tr = document.getElementById("tab-register");
  const show = (w) => {
    host.innerHTML = w === "login" ? loginForm() : registerForm();
    tl.classList.toggle("on", w === "login");
    tr.classList.toggle("on", w === "register");
    const fl = document.getElementById("f-login");
    if (fl) fl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(fl);
      try { await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)) }); location.hash = "#/dashboard"; await render(); }
      catch (err) { document.getElementById("auth-err").innerHTML = `<div class="alert">${esc(err.message)}</div>`; }
    });
    const fr = document.getElementById("f-register");
    if (fr) fr.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(fr);
      try { await api("/api/register", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)) }); location.hash = "#/dashboard"; await render(); }
      catch (err) { document.getElementById("auth-err").innerHTML = `<div class="alert">${esc(err.message)}</div>`; }
    });
  };
  tl.onclick = () => show("login");
  tr.onclick = () => show("register");
  show(which);
}

document.getElementById("lang-toggle").addEventListener("click", async () => {
  LANG = LANG === "en" ? "ar" : "en";
  localStorage.setItem("sd_lang", LANG);
  await render();
});
document.getElementById("logout-btn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  ME = null;
  location.hash = "#/";
  await render();
});
document.getElementById("brand-link").addEventListener("click", () => {});
window.addEventListener("hashchange", render);
applyI18n();
render();
