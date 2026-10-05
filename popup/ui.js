/* Shared dialog focus management for the request and settings pages. */
(function () {
  "use strict";
  const returnFocus = new WeakMap();
  const activeModal = () => document.querySelector(".modal.show");

  function openModal(modal, initialFocus) {
    if (activeModal()) return;
    returnFocus.set(modal, document.activeElement);
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
    document.querySelector("main").inert = true;
    (initialFocus || modal.querySelector("button, input, select, textarea"))?.focus();
  }

  function closeModal(modal) {
    if (!modal.classList.contains("show")) return;
    modal.classList.remove("show");
    document.body.style.overflow = "";
    document.querySelector("main").inert = false;
    const previous = returnFocus.get(modal);
    if (previous?.isConnected && !previous.disabled) previous.focus();
    returnFocus.delete(modal);
  }

  document.addEventListener("keydown", event => {
    const modal = activeModal();
    if (!modal || event.key !== "Tab") return;
    const controls = Array.from(modal.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]'))
      .filter(element => !element.disabled && element.getClientRects().length);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!modal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.QuickUI = { openModal, closeModal };
})();
