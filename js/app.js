const currentPath = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll("[data-nav]").forEach((link) => {
  const linkPath = new URL(link.getAttribute("href"), window.location.href).pathname.split("/").pop();
  if (linkPath === currentPath || (currentPath === "" && linkPath === "index.html")) {
    link.classList.add("active");
  }
});

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
  const statusNode = contactForm.querySelector("[data-form-status]");
  const submitButton = contactForm.querySelector("button[type='submit']");

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    setFormStatus(statusNode, "sending", "문의 내용을 전송하는 중입니다.");
    submitButton.disabled = true;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "메일 발송에 실패했습니다.");
      }

      contactForm.reset();
      setFormStatus(statusNode, "success", result.message);
    } catch (error) {
      setFormStatus(statusNode, "error", error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

function setFormStatus(node, type, message) {
  if (!node) {
    return;
  }

  node.className = `form-status ${type}`;
  node.textContent = message;
}
