chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "crop-image",
    title: "Обрезать это изображение",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info: chrome.contextMenus.OnClickData) => {
  if (info.menuItemId === "crop-image" && info.srcUrl) {
    chrome.storage.local.set({ targetImage: info.srcUrl });
  }
});
