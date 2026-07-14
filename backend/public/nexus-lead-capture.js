(function() {
  // Nexus Lead Capture Embeddable Snippet
  console.log("Nexus Lead Capture SDK initialized.");

  // Configuration
  const CONFIG = {
    endpoint: window.NEXUS_CONFIG?.endpoint || "http://localhost:5506/api/v1/public/leads",
    campaign: window.NEXUS_CONFIG?.campaign || "Default Website Campaign",
    source: window.NEXUS_CONFIG?.source || "Website"
  };

  let partialLeadId = null;

  // Track partial inputs
  function getFormData(form) {
    const data = {};
    const inputs = form.querySelectorAll("input, select, textarea");
    inputs.forEach(input => {
      if (input.name) {
        if (input.type === "checkbox") {
          data[input.name] = input.checked;
        } else {
          data[input.name] = input.value;
        }
      }
    });
    return data;
  }

  function sendLeadData(data, isPartial = false) {
    const payload = {
      firstName: data.firstName || data.first_name || "",
      lastName: data.lastName || data.last_name || "",
      email: data.email || "",
      phone: data.phone || "",
      company: data.company || "",
      message: data.message || "",
      source: CONFIG.source,
      sourceDetail: isPartial ? "Partial Capture" : "Form Submission",
      campaign: CONFIG.campaign,
      rawPayload: { ...data, isPartial }
    };

    // Require at least email or phone for partial capture
    if (isPartial && !payload.email && !payload.phone) return;

    fetch(CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resData => {
      if (resData.success && resData.leadId) {
        partialLeadId = resData.leadId;
      }
    })
    .catch(err => console.error("Nexus Lead Capture Error:", err));
  }

  // Intercept all forms marked with 'nexus-capture' class or ID
  document.addEventListener("DOMContentLoaded", () => {
    const forms = document.querySelectorAll("form.nexus-capture, form#nexus-capture");
    
    forms.forEach(form => {
      // 1. Partial Capture on blur of key fields (email, phone)
      const inputs = form.querySelectorAll("input[name*='email'], input[name*='phone']");
      inputs.forEach(input => {
        input.addEventListener("blur", () => {
          const data = getFormData(form);
          sendLeadData(data, true);
        });
      });

      // 2. Full submission intercept
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = getFormData(form);
        sendLeadData(data, false);
        
        // Custom success visual
        const successMessage = document.createElement("div");
        successMessage.className = "nexus-success-message";
        successMessage.innerText = "Thank you! Your request has been received.";
        successMessage.style.color = "#00875A";
        successMessage.style.marginTop = "10px";
        successMessage.style.fontWeight = "bold";
        
        form.appendChild(successMessage);
        form.reset();
      });
    });
  });
})();
