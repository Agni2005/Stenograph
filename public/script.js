const encodeForm = document.getElementById("encode-form");
const decodeForm = document.getElementById("decode-form");
const encodeStatus = document.getElementById("encode-status");
const decodeStatus = document.getElementById("decode-status");
const decodedMessage = document.getElementById("decoded-message");

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

async function postForm(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed." }));
    throw new Error(error.error || "Request failed.");
  }

  return response;
}

encodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(encodeForm);
  const button = encodeForm.querySelector("button");

  try {
    button.disabled = true;
    setStatus(encodeStatus, "Encoding your message into the image...");
    const response = await postForm("/api/encode", formData);
    const imageBlob = await response.blob();
    const downloadUrl = URL.createObjectURL(imageBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "encoded-image.png";
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setStatus(encodeStatus, "Encoded image downloaded successfully.", "success");
    encodeForm.reset();
  } catch (error) {
    setStatus(encodeStatus, error.message, "error");
  } finally {
    button.disabled = false;
  }
});

decodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(decodeForm);
  const button = decodeForm.querySelector("button");

  try {
    button.disabled = true;
    setStatus(decodeStatus, "Reading the hidden message...");
    const response = await postForm("/api/decode", formData);
    const data = await response.json();
    decodedMessage.textContent = data.message;
    setStatus(decodeStatus, "Message decoded successfully.", "success");
  } catch (error) {
    decodedMessage.textContent = "Your decoded message will appear here.";
    setStatus(decodeStatus, error.message, "error");
  } finally {
    button.disabled = false;
  }
});
