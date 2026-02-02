import Sortable from "sortablejs";
import { jsPDF } from "jspdf";

interface ImageEntry {
  id: string;
  file: File;
  dataUrl: string;
}

const images: ImageEntry[] = [];

const dropZone = document.getElementById("drop-zone")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const imageList = document.getElementById("image-list")!;
const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;

// Sortable setup
Sortable.create(imageList, {
  animation: 150,
  ghostClass: "sortable-ghost",
  onEnd(evt) {
    if (evt.oldIndex == null || evt.newIndex == null) return;
    const [moved] = images.splice(evt.oldIndex, 1);
    images.splice(evt.newIndex, 0, moved);
    updateOrderBadges();
  },
});

// Drop zone events
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer?.files) {
    addFiles(e.dataTransfer.files);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files) {
    addFiles(fileInput.files);
    fileInput.value = "";
  }
});

// Generate PDF
generateBtn.addEventListener("click", async () => {
  if (images.length === 0) return;

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    await generatePDF();
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate PDF";
    updateButtonState();
  }
});

function addFiles(fileList: FileList) {
  const allowedTypes = new Set(["image/jpeg", "image/png"]);
  const imageFiles = Array.from(fileList).filter((f) =>
    allowedTypes.has(f.type)
  );

  let loaded = 0;
  for (const file of imageFiles) {
    const reader = new FileReader();
    reader.onload = () => {
      const entry: ImageEntry = {
        id: crypto.randomUUID(),
        file,
        dataUrl: reader.result as string,
      };
      images.push(entry);
      appendImageElement(entry);
      loaded++;
      if (loaded === imageFiles.length) {
        updateButtonState();
      }
    };
    reader.readAsDataURL(file);
  }
}

function appendImageElement(entry: ImageEntry) {
  const div = document.createElement("div");
  div.classList.add("image-item");
  div.dataset.id = entry.id;

  const badge = document.createElement("span");
  badge.classList.add("order-badge");
  badge.textContent = String(images.length);

  const img = document.createElement("img");
  img.src = entry.dataUrl;
  img.alt = entry.file.name;

  const removeBtn = document.createElement("button");
  removeBtn.classList.add("remove-btn");
  removeBtn.textContent = "\u00d7";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeImage(entry.id);
  });

  const fileName = document.createElement("div");
  fileName.classList.add("file-name");
  fileName.textContent = entry.file.name;

  div.append(badge, img, removeBtn, fileName);
  imageList.appendChild(div);
}

function removeImage(id: string) {
  const idx = images.findIndex((e) => e.id === id);
  if (idx === -1) return;
  images.splice(idx, 1);

  const el = imageList.querySelector(`[data-id="${id}"]`);
  el?.remove();

  updateOrderBadges();
  updateButtonState();
}

function updateOrderBadges() {
  const items = imageList.querySelectorAll(".image-item");
  items.forEach((item, i) => {
    const badge = item.querySelector(".order-badge");
    if (badge) badge.textContent = String(i + 1);
  });
}

function updateButtonState() {
  generateBtn.disabled = images.length === 0;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function generatePDF() {
  // Use first image to determine initial orientation
  const firstImg = await loadImage(images[0].dataUrl);
  const landscape = firstImg.width > firstImg.height;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  for (let i = 0; i < images.length; i++) {
    const img = await loadImage(images[i].dataUrl);
    const imgLandscape = img.width > img.height;

    if (i > 0) {
      doc.addPage("a4", imgLandscape ? "landscape" : "portrait");
    } else if (landscape !== imgLandscape) {
      // Adjust first page if orientation assumption was wrong after reload
      // This case is handled by initial setup above, but keep for safety
    }

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Scale image to fill the page while maintaining aspect ratio
    const imgRatio = img.width / img.height;
    const pageRatio = pageW / pageH;

    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (imgRatio > pageRatio) {
      // Image is wider relative to page — fit to width
      drawW = pageW;
      drawH = pageW / imgRatio;
      drawX = 0;
      drawY = (pageH - drawH) / 2;
    } else {
      // Image is taller relative to page — fit to height
      drawH = pageH;
      drawW = pageH * imgRatio;
      drawX = (pageW - drawW) / 2;
      drawY = 0;
    }

    doc.addImage(images[i].dataUrl, drawX, drawY, drawW, drawH);
  }

  doc.save("images.pdf");
}
