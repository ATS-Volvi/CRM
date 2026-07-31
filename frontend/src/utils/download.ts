/**
 * Helper to download authenticated endpoints like PDFs or CSVs as files/tabs
 */
export async function downloadAuthenticatedFile(url: string, filename?: string, token?: string | null) {
  const authToken = token || localStorage.getItem("token") || localStorage.getItem("crm_token");
  
  try {
    const res = await fetch(url, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = "Failed to download file";
      try {
        const json = JSON.parse(errText);
        msg = json.error || json.message || msg;
      } catch (e) {
        msg = errText || msg;
      }
      alert(`Download Error: ${msg}`);
      return;
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Open in new window/tab if requested or default download
    const link = document.createElement("a");
    link.href = blobUrl;
    if (filename) {
      link.download = filename;
    } else {
      link.target = "_blank";
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  } catch (err: any) {
    alert(`Download Error: ${err.message || "Network error"}`);
  }
}
