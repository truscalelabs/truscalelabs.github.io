// Before and after: the problem bottle, checked against the Amazon profile.
import { BOTTLE } from "./demo-data.js";

const list = document.querySelector("#compare-checks");
const sameList = document.querySelector("#compare-same");
const sameSummary = document.querySelector("#same-summary");
const verdict = document.querySelector("#compare-verdict");
const imgs = { before: document.querySelector("#img-before"), after: document.querySelector("#img-after") };
const buttons = document.querySelectorAll("[data-state]");

const ICON = {
  pass: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fail: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.3 3.3l5.4 5.4M8.7 3.3l-5.4 5.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.6v4.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="6" cy="9.2" r="1" fill="#fff"/></svg>',
};
const WORD = { pass: "passes", fail: "fails", warn: "needs a look" };

export function mark(status) {
  return `<span class="mark ${status}" role="img" aria-label="${WORD[status]}">${ICON[status]}</span>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function render(state, animate) {
  const fails = BOTTLE.rows.filter((r) => r[state][0] === "fail").length;
  const warns = BOTTLE.rows.filter((r) => r[state][0] === "warn").length;
  const total = BOTTLE.rows.length;
  const row = (r, animate) => {
    const [status, value, message] = r[state];
    return `<li${animate ? ' class="flash"' : ""}>${mark(status)}<span>${esc(r.label)}</span>` +
      `<span class="val">${esc(value)}</span>${message ? `<span class="msg">${esc(message)}</span>` : ""}</li>`;
  };
  const changed = BOTTLE.rows.filter((r) => r.before[0] !== r.after[0]);
  const same = BOTTLE.rows.filter((r) => r.before[0] === r.after[0]);
  list.innerHTML = changed.map((r) => row(r, animate)).join("");
  sameList.innerHTML = same.map((r) => row(r, false)).join("");
  sameSummary.textContent = `${same.length} more checks pass in both versions`;
  if (state === "before") {
    verdict.className = "verdict fail";
    verdict.textContent = `Not ready: ${fails} fail${warns ? `, ${warns} to check` : ""}`;
  } else {
    verdict.className = "verdict pass";
    verdict.textContent = `Ready: ${total - fails - warns} of ${total} pass`;
  }
  imgs.before.classList.toggle("off", state !== "before");
  imgs.after.classList.toggle("off", state !== "after");
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === state)));
}

if (list) {
  render("before", false);
  buttons.forEach((b) => b.addEventListener("click", () => render(b.dataset.state, true)));
}
