import "./toast.css";

// Small "flash" notifications: they appear, then fade away on their own.
// Usage anywhere in the app:  toast.success("Request submitted.")  /  toast.error("Something failed.")
// No provider or extra wiring needed: the container is created the first time a toast is shown.

const DURATION = { success: 3500, error: 6000 }; // milliseconds on screen
const MAX_VISIBLE = 3;
const FADE_OUT_MS = 180;

let stack = null;

function getStack() {
  if (stack && document.body.contains(stack)) return stack;
  stack = document.createElement("div");
  stack.className = "mi-toast-stack";
  document.body.appendChild(stack);
  return stack;
}

function removeToast(element) {
  if (!element || element.dataset.leaving) return;
  element.dataset.leaving = "true";
  clearTimeout(element.timerId);
  element.classList.add("mi-toast-leaving");
  window.setTimeout(() => element.remove(), FADE_OUT_MS);
}

function startTimer(element, delay) {
  clearTimeout(element.timerId);
  element.timerId = window.setTimeout(() => removeToast(element), delay);
}

function show(type, text) {
  const message = String(text || "").trim();
  if (!message) return;

  const container = getStack();

  const duplicate = [...container.children].some(
    (item) => item.dataset.type === type && item.dataset.text === message && !item.dataset.leaving
  );
  if (duplicate) return;

  while (container.children.length >= MAX_VISIBLE) removeToast(container.firstElementChild);

  const element = document.createElement("div");
  element.className = `mi-toast mi-toast-${type}`;
  element.dataset.type = type;
  element.dataset.text = message;
  element.setAttribute("role", type === "error" ? "alert" : "status");

  const icon = document.createElement("span");
  icon.className = "mi-toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "error" ? "!" : "✓";

  const label = document.createElement("span");
  label.className = "mi-toast-text";
  label.textContent = message; // textContent (not innerHTML) keeps this safe

  const close = document.createElement("button");
  close.type = "button";
  close.className = "mi-toast-close";
  close.setAttribute("aria-label", "Close notification");
  close.textContent = "×";
  close.addEventListener("click", () => removeToast(element));

  element.append(icon, label, close);

  element.addEventListener("mouseenter", () => clearTimeout(element.timerId));
  element.addEventListener("mouseleave", () => startTimer(element, 2000));

  container.appendChild(element);
  startTimer(element, DURATION[type]);
}

export const toast = {
  success: (text) => show("success", text),
  error: (text) => show("error", text),
};

export default toast;