import Cropper from "cropperjs";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

const FORMAT_EXT: Record<OutputFormat, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function formatFromMime(mime: string): OutputFormat {
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return "image/jpeg";
  }
  if (mime === "image/webp") {
    return "image/webp";
  }
  return "image/png";
}

function formatFromUrl(url: string): OutputFormat {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.(jpe?g|jfif)$/.test(pathname)) {
      return "image/jpeg";
    }

    if (/\.webp$/.test(pathname)) {
      return "image/webp";
    }

    if (/\.png$/.test(pathname)) {
      return "image/png";
    }
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

// Resize tab
const tabCrop = document.getElementById("tabCrop")!;
const tabResize = document.getElementById("tabResize")!;
const tabButtons = document.querySelectorAll(".tab");
const resizeModeSize = document.querySelector('input[name="resizeMode"][value="size"]') as HTMLInputElement;
const resizeModePercent = document.querySelector('input[name="resizeMode"][value="percent"]') as HTMLInputElement;
const resizeSizeFields = document.getElementById("resizeSizeFields")!;
const resizePercentField = document.getElementById("resizePercentField")!;
const resizeWidthInput = document.getElementById("resizeWidth") as HTMLInputElement;
const resizeHeightInput = document.getElementById("resizeHeight") as HTMLInputElement;
const resizePercentInput = document.getElementById("resizePercent") as HTMLInputElement;
const resizeOutputPreview = document.getElementById("resizeOutputPreview")!;
const resizeApplyBtn = document.getElementById("resizeApplyBtn")!;
const resizeFileInput = document.getElementById("resizeFileInput") as HTMLInputElement;
const resizeBtnFile = document.getElementById("resizeBtnFile")!;
const resizeImage = document.getElementById("resizeImage") as HTMLImageElement;
const resizeFileInfo = document.getElementById("resizeFileInfo")!;
const resizeQualityInput = document.getElementById("resizeQuality") as HTMLInputElement;
const resizeQualityVal = document.getElementById("resizeQualityVal")!;

let sourceWidth = 0;
let sourceHeight = 0;
let resizeAspectRatio = 1;
let resizeObjectUrl: string | null = null;
let resizeSourceFormat: OutputFormat = "image/png";

// Batch tab
const tabBatch = document.getElementById("tabBatch")!;
const batchFileInput = document.getElementById("batchFileInput") as HTMLInputElement;
const batchBtnAdd = document.getElementById("batchBtnAdd")!;
const batchList = document.getElementById("batchList")!;
const batchCount = document.getElementById("batchCount")!;
const batchProcessBtn = document.getElementById("batchProcessBtn")!;
const batchItemTemplate = document.getElementById("batchItemTemplate") as HTMLTemplateElement;
const batchQualityInput = document.getElementById("batchQuality") as HTMLInputElement;
const batchQualityVal = document.getElementById("batchQualityVal")!;

interface BatchItem {
  id: string;
  file: File;
  url: string;
  name: string;
  naturalWidth: number;
  naturalHeight: number;
  aspectRatio: number;
  mode: "size" | "percent";
  width: number;
  height: number;
  percent: number;
}

let batchItems: BatchItem[] = [];

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

function updateResizeSource(w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  sourceWidth = w;
  sourceHeight = h;
  resizeAspectRatio = w / h;
  resizeWidthInput.value = String(w);
  resizeHeightInput.value = String(h);
  resizePercentInput.value = "100";
  updateResizeOutputPreview();
}

function updateResizeOutputPreview(): void {
  const mode = resizeModePercent.checked ? "percent" : "size";
  let outW: number;
  let outH: number;
  if (mode === "percent") {
    const pct = parseFloat(resizePercentInput.value) || 100;
    outW = Math.round((sourceWidth * pct) / 100);
    outH = Math.round((sourceHeight * pct) / 100);
  } else {
    outW = parseInt(resizeWidthInput.value, 10) || 0;
    outH = parseInt(resizeHeightInput.value, 10) || 0;
  }
  if (outW && outH) {
    resizeOutputPreview.innerHTML = `На выходе: <strong>${outW} × ${outH}</strong> px`;
  } else {
    resizeOutputPreview.textContent = "На выходе: — × — px";
  }
}

function getResizeTargetDimensions(): { w: number; h: number } | null {
  if (resizeModePercent.checked) {
    const pct = parseFloat(resizePercentInput.value) || 100;
    return {
      w: Math.max(1, Math.round((sourceWidth * pct) / 100)),
      h: Math.max(1, Math.round((sourceHeight * pct) / 100)),
    };
  }
  const w = parseInt(resizeWidthInput.value, 10) || 0;
  const h = parseInt(resizeHeightInput.value, 10) || 0;
  if (w < 1 || h < 1) return null;
  return { w, h };
}

function getBatchItemTargetDimensions(item: BatchItem): { w: number; h: number } {
  if (item.mode === "percent") {
    return {
      w: Math.max(1, Math.round((item.naturalWidth * item.percent) / 100)),
      h: Math.max(1, Math.round((item.naturalHeight * item.percent) / 100)),
    };
  }
  return { w: item.width, h: item.height };
}

function renderBatchList(): void {
  batchList.innerHTML = "";
  batchCount.textContent = `${batchItems.length} файлов`;
  (batchProcessBtn as HTMLButtonElement).disabled = batchItems.length === 0;

  for (const item of batchItems) {
    const el = batchItemTemplate.content.cloneNode(true) as DocumentFragment;
    const row = el.querySelector(".batch-item")!;
    row.setAttribute("data-id", item.id);

    const thumb = row.querySelector(".batch-item-thumb") as HTMLImageElement;
    const nameEl = row.querySelector(".batch-item-name")!;
    const modeSelect = row.querySelector(".batch-item-mode") as HTMLSelectElement;
    const widthInput = row.querySelector(".batch-item-width") as HTMLInputElement;
    const heightInput = row.querySelector(".batch-item-height") as HTMLInputElement;
    const percentField = row.querySelector(".batch-item-percent-field") as HTMLElement;
    const percentInput = row.querySelector(".batch-item-percent") as HTMLInputElement;
    const sizeFields = row.querySelector(".batch-item-size-fields") as HTMLElement;
    const outEl = row.querySelector(".batch-item-out")!;
    const removeBtn = row.querySelector(".batch-item-remove")!;

    thumb.src = item.url;
    nameEl.textContent = item.name;
    modeSelect.value = item.mode;
    widthInput.value = String(item.width);
    heightInput.value = String(item.height);
    percentInput.value = String(item.percent);

    const updateItemOut = () => {
      const dim = getBatchItemTargetDimensions(item);
      outEl.textContent = `→ ${dim.w}×${dim.h}`;
    };

    const syncFromItem = () => {
      widthInput.value = String(item.width);
      heightInput.value = String(item.height);
      percentInput.value = String(item.percent);
      updateItemOut();
    };

    if (item.mode === "percent") {
      sizeFields.style.display = "none";
      percentField.style.display = "";
    } else {
      sizeFields.style.display = "";
      percentField.style.display = "none";
    }
    updateItemOut();

    modeSelect.addEventListener("change", () => {
      item.mode = modeSelect.value as "size" | "percent";
      if (item.mode === "percent") {
        item.percent = 100;
        item.width = item.naturalWidth;
        item.height = item.naturalHeight;
      } else {
        item.width = Math.round((item.naturalWidth * item.percent) / 100);
        item.height = Math.round((item.naturalHeight * item.percent) / 100);
      }
      sizeFields.style.display = item.mode === "size" ? "" : "none";
      percentField.style.display = item.mode === "percent" ? "" : "none";
      syncFromItem();
    });

    widthInput.addEventListener("input", () => {
      const w = parseInt(widthInput.value, 10);
      if (!Number.isNaN(w) && w > 0 && item.aspectRatio > 0) {
        item.width = w;
        item.height = Math.round(w / item.aspectRatio);
        heightInput.value = String(item.height);
      }
      updateItemOut();
    });
    heightInput.addEventListener("input", () => {
      const h = parseInt(heightInput.value, 10);
      if (!Number.isNaN(h) && h > 0 && item.aspectRatio > 0) {
        item.height = h;
        item.width = Math.round(h * item.aspectRatio);
        widthInput.value = String(item.width);
      }
      updateItemOut();
    });
    percentInput.addEventListener("input", () => {
      const pct = parseFloat(percentInput.value) || 100;
      item.percent = pct;
      item.width = Math.round((item.naturalWidth * pct) / 100);
      item.height = Math.round((item.naturalHeight * pct) / 100);
      widthInput.value = String(item.width);
      heightInput.value = String(item.height);
      updateItemOut();
    });

    removeBtn.addEventListener("click", () => {
      URL.revokeObjectURL(item.url);
      batchItems = batchItems.filter((i) => i.id !== item.id);
      renderBatchList();
    });

    batchList.appendChild(el);
  }
}

function addBatchFiles(files: FileList | null): void {
  if (!files?.length) return;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const id = `batch-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      batchItems.push({
        id,
        file,
        url,
        name: file.name,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio,
        mode: "size",
        width: img.naturalWidth,
        height: img.naturalHeight,
        percent: 100,
      });
      renderBatchList();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }
}

function processAllBatch(): void {
  if (batchItems.length === 0) return;
  const quality = parseFloat(batchQualityInput.value) || 0.82;
  let index = 0;

  const processNext = () => {
    if (index >= batchItems.length) return;
    const item = batchItems[index];
    const dim = getBatchItemTargetDimensions(item);
    const fmt = formatFromMime(item.file.type);
    const mime = fmt;
    const ext = FORMAT_EXT[fmt];
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = dim.w;
        canvas.height = dim.h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, item.naturalWidth, item.naturalHeight, 0, 0, dim.w, dim.h);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              index++;
              processNext();
              return;
            }
            const url = URL.createObjectURL(blob);
            const base = item.name.replace(/\.[^.]+$/, "") || "image";
            chrome.downloads.download({
              url,
              filename: `${base}_resized_${Date.now()}.${ext}`,
              saveAs: false,
            });
            index++;
            processNext();
          },
          mime,
          quality
        );
      } catch {
        index++;
        processNext();
      }
    };
    img.onerror = () => {
      index++;
      processNext();
    };
    img.src = item.url;
  };

  processNext();
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
  img.onerror = () => {
    sizeInfo.innerText = "Не удалось загрузить изображение";
    setToolbarState(false);
  };
  img.src = url;

  if (url.startsWith("blob:")) {
    currentObjectUrl = url;
  }

  sizeInfo.innerText = "Размер: 0 x 0 px";
  setToolbarState(false);
}

/** Загружает изображение по URL через fetch (обходит CORS/tainted canvas в расширении) и запускает редактор. */
function loadImageFromUrlAndStart(url: string): void {
  const isExternal = /^https?:\/\//i.test(url);
  if (!isExternal) {
    startCropper(url);
    return;
  }
  sizeInfo.innerText = "Загрузка…";
  setToolbarState(false);
  fetch(url, { mode: "cors" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      startCropper(blobUrl);
    })
    .catch(() => {
      sizeInfo.innerText = "Ошибка загрузки изображения";
      setToolbarState(false);
    });
}

chrome.storage.local.get(["targetImage"], (res: { targetImage?: string }) => {
  if (res.targetImage) {
    loadImageFromUrlAndStart(res.targetImage);
    chrome.storage.local.remove("targetImage");
  } else {
    setToolbarState(false);
  }
});

btnFile.addEventListener("click", () => fileInput.click());

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = (btn as HTMLElement).dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    (btn as HTMLElement).classList.add("active");
    tabCrop.classList.toggle("active", tab === "crop");
    tabResize.classList.toggle("active", tab === "resize");
    tabBatch.classList.toggle("active", tab === "batch");
    if (tab === "resize" && sourceWidth > 0) {
      updateResizeOutputPreview();
    }
  });
});

resizeModeSize.addEventListener("change", () => {
  resizeSizeFields.style.display = "";
  resizePercentField.style.display = "none";
  updateResizeOutputPreview();
});
resizeModePercent.addEventListener("change", () => {
  resizeSizeFields.style.display = "none";
  resizePercentField.style.display = "";
  const pct = parseFloat(resizePercentInput.value) || 100;
  resizeWidthInput.value = String(Math.round((sourceWidth * pct) / 100));
  resizeHeightInput.value = String(Math.round((sourceHeight * pct) / 100));
  updateResizeOutputPreview();
});

resizeWidthInput.addEventListener("input", () => {
  const w = parseInt(resizeWidthInput.value, 10);
  if (!Number.isNaN(w) && w > 0 && resizeAspectRatio > 0) {
    resizeHeightInput.value = String(Math.round(w / resizeAspectRatio));
  }
  updateResizeOutputPreview();
});
resizeHeightInput.addEventListener("input", () => {
  const h = parseInt(resizeHeightInput.value, 10);
  if (!Number.isNaN(h) && h > 0 && resizeAspectRatio > 0) {
    resizeWidthInput.value = String(Math.round(h * resizeAspectRatio));
  }
  updateResizeOutputPreview();
});
resizePercentInput.addEventListener("input", () => {
  const pct = parseFloat(resizePercentInput.value) || 100;
  const w = Math.round((sourceWidth * pct) / 100);
  const h = Math.round((sourceHeight * pct) / 100);
  resizeWidthInput.value = String(w);
  resizeHeightInput.value = String(h);
  updateResizeOutputPreview();
});

function setResizeState(hasImage: boolean): void {
  (resizeApplyBtn as HTMLButtonElement).disabled = !hasImage;
  if (!hasImage) {
    sourceWidth = 0;
    sourceHeight = 0;
    resizeWidthInput.value = "";
    resizeHeightInput.value = "";
    resizePercentInput.value = "100";
    resizeOutputPreview.textContent = "На выходе: — × — px";
    resizeFileInfo.textContent = "Файл не выбран";
  }
}

resizeBtnFile.addEventListener("click", () => resizeFileInput.click());

resizeFileInput.addEventListener("change", (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (resizeObjectUrl) {
    URL.revokeObjectURL(resizeObjectUrl);
    resizeObjectUrl = null;
  }
  resizeSourceFormat = formatFromMime(file.type);
  const url = URL.createObjectURL(file);
  resizeObjectUrl = url;
  resizeImage.onload = () => {
    updateResizeSource(resizeImage.naturalWidth, resizeImage.naturalHeight);
    (resizeApplyBtn as HTMLButtonElement).disabled = false;
    resizeFileInfo.textContent = `${file.name} (${resizeImage.naturalWidth} × ${resizeImage.naturalHeight} px)`;
  };
  resizeImage.src = url;
  resizeFileInfo.textContent = "Загрузка…";
  input.value = "";
});

setResizeState(false);

resizeQualityInput.addEventListener("input", () => {
  const v = Math.round((parseFloat(resizeQualityInput.value) || 0.82) * 100);
  resizeQualityVal.textContent = `${v}%`;
});
batchQualityInput.addEventListener("input", () => {
  const v = Math.round((parseFloat(batchQualityInput.value) || 0.82) * 100);
  batchQualityVal.textContent = `${v}%`;
});

resizeApplyBtn.addEventListener("click", () => {
  if (!resizeImage.src || sourceWidth <= 0 || sourceHeight <= 0) return;
  const dim = getResizeTargetDimensions();
  if (!dim) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = dim.w;
    canvas.height = dim.h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(
      resizeImage,
      0,
      0,
      resizeImage.naturalWidth,
      resizeImage.naturalHeight,
      0,
      0,
      dim.w,
      dim.h
    );
    const mime = resizeSourceFormat;
    const ext = FORMAT_EXT[mime];
    const quality = parseFloat(resizeQualityInput.value) || 0.82;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url,
          filename: `resized_${Date.now()}.${ext}`,
          saveAs: true,
        });
      },
      mime,
      quality
    );
  } catch {
    // ignore
  }
});

batchBtnAdd.addEventListener("click", () => batchFileInput.click());

batchFileInput.addEventListener("change", (e: Event) => {
  const input = e.target as HTMLInputElement;
  addBatchFiles(input.files);
  input.value = "";
});

batchProcessBtn.addEventListener("click", () => processAllBatch());

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
