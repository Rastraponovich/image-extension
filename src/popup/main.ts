import Cropper from "cropperjs";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

const FORMAT_EXT: Record<OutputFormat, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function formatFromMime(mime: string): OutputFormat {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg";
  if (mime === "image/webp") return "image/webp";
  return "image/png";
}

function formatFromUrl(url: string): OutputFormat {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.(jpe?g|jfif)$/.test(pathname)) return "image/jpeg";
    if (/\.webp$/.test(pathname)) return "image/webp";
    if (/\.png$/.test(pathname)) return "image/png";
  } catch {
    // ignore invalid URL
  }
  return "image/png";
}

let cropper: Cropper | null = null;
let flip = 1;
let currentObjectUrl: string | null = null;
let sourceFormat: OutputFormat = "image/png";

const container = document.querySelector(".container") as HTMLElement;
const sizeInfo = document.getElementById("sizeDisplay")!;
const aspectRatioSelect = document.getElementById("aspectRatio") as HTMLSelectElement;
const rotateLeftBtn = document.getElementById("rotateLeft")!;
const rotateRightBtn = document.getElementById("rotateRight")!;
const flipXBtn = document.getElementById("flipX")!;
const clearBtn = document.getElementById("clearBtn")!;
const saveBtn = document.getElementById("saveBtn")!;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const customFormatCheckbox = document.getElementById("customFormat") as HTMLInputElement;
const formatBox = document.getElementById("formatBox")!;
const formatSelect = document.getElementById("format") as HTMLSelectElement;
const qualityBox = document.getElementById("qualityBox")!;
const qualityInput = document.getElementById("quality") as HTMLInputElement;
const btnFile = document.getElementById("btnFile")!;

function setToolbarState(hasImage: boolean): void {
  const disabled = !hasImage;
  aspectRatioSelect.disabled = disabled;
  (rotateLeftBtn as HTMLButtonElement).disabled = disabled;
  (rotateRightBtn as HTMLButtonElement).disabled = disabled;
  (flipXBtn as HTMLButtonElement).disabled = disabled;
  (clearBtn as HTMLButtonElement).disabled = disabled;
  (saveBtn as HTMLButtonElement).disabled = disabled;
}

function getImageEl(): HTMLImageElement | null {
  return document.getElementById("image") as HTMLImageElement | null;
}

function initCropper(): void {
  const img = getImageEl();
  if (!img || !img.src) {
    return;
  }
  if (cropper) {
    cropper.destroy();
  }
  cropper = new Cropper(img, { container });

  const selection = cropper.getCropperSelection();

  if (selection) {
    selection.initialCoverage = 1;
    selection.$reset();

    selection.addEventListener("change", (e: Event) => {
      const d = (e as CustomEvent).detail as { width?: number; height?: number };
      if (d && typeof d.width === "number" && typeof d.height === "number") {
        sizeInfo.innerText = `Размер: ${Math.round(d.width)} x ${Math.round(d.height)} px`;
      }
    });
    const w = selection.width;
    const h = selection.height;
    if (w && h) sizeInfo.innerText = `Размер: ${Math.round(w)} x ${Math.round(h)} px`;
  }

  setToolbarState(true);
}

function startCropper(url: string, file?: File): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  sourceFormat = file ? formatFromMime(file.type) : formatFromUrl(url);
  flip = 1;

  container.innerHTML = '<img id="image" alt="" />';

  const img = getImageEl()!;

  img.onload = () => initCropper();
  img.src = url;

  if (url.startsWith("blob:")) {
    currentObjectUrl = url;
  }

  sizeInfo.innerText = "Размер: 0 x 0 px";
  setToolbarState(false);
}

chrome.storage.local.get(["targetImage"], (res: { targetImage?: string }) => {
  if (res.targetImage) {
    startCropper(res.targetImage);
    chrome.storage.local.remove("targetImage");
  } else {
    setToolbarState(false);
  }
});

btnFile.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  startCropper(url, file);
  input.value = "";
});

clearBtn.addEventListener("click", () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  container.innerHTML = '<img id="image" alt="" />';
  flip = 1;
  sizeInfo.innerText = "Размер: 0 x 0 px";
  setToolbarState(false);
});

aspectRatioSelect.addEventListener("change", (e: Event) => {
  const value = (e.target as HTMLSelectElement).value;
  const selection = cropper?.getCropperSelection();
  if (selection) selection.aspectRatio = parseFloat(value);
});

rotateLeftBtn.addEventListener("click", () => {
  const image = cropper?.getCropperImage();

  if (image) {
    image.$rotate("-90deg");
  }
});

rotateRightBtn.addEventListener("click", () => {
  const image = cropper?.getCropperImage();
  if (image) {
    image.$rotate("90deg");
  }
});

flipXBtn.addEventListener("click", () => {
  const image = cropper?.getCropperImage();
  if (!image) {
    return;
  }

  flip = flip === 1 ? -1 : 1;

  image.$scale(flip, 1);
});

customFormatCheckbox.addEventListener("change", () => {
  const show = customFormatCheckbox.checked;
  formatBox.style.display = show ? "inline" : "none";

  if (show) {
    updateQualityVisibility();
  }
});

formatSelect.addEventListener("change", () => updateQualityVisibility());

function updateQualityVisibility(): void {
  const fmt = formatSelect.value as OutputFormat;
  qualityBox.style.display = fmt === "image/jpeg" || fmt === "image/webp" ? "inline" : "none";
}

saveBtn.addEventListener("click", async () => {
  const selection = cropper?.getCropperSelection();
  if (!selection) {
    return;
  }

  const format: OutputFormat = customFormatCheckbox.checked
    ? (formatSelect.value as OutputFormat)
    : sourceFormat;

  const quality = parseFloat(qualityInput.value);
  const extension = FORMAT_EXT[format];

  try {
    const canvas = await selection.$toCanvas();
    const dataUrl = canvas.toDataURL(format, quality);
    chrome.downloads.download({
      url: dataUrl,
      filename: `cropped_${Date.now()}.${extension}`,
      saveAs: true,
    });
  } catch {
    // ignore export errors
  }
});
