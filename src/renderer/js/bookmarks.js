const { ipcRenderer } = require("electron");

const bookmarkList = document.getElementById("bookmark-list");

ipcRenderer.on("bookmarks-data", (e, bookmarks) => {
    bookmarkList.innerHTML = "";
    bookmarks.forEach((b, index) => {
        const div = document.createElement("div");
        div.className = "bookmark-item";
        div.innerHTML = `<div class="title">${b.title}</div><div class="time">进度: ${Math.floor(b.time)}秒</div>`;
        div.onclick = () => {
            ipcRenderer.send("open-bookmark", b);
            window.close();
        };
        bookmarkList.appendChild(div);
    });
});

ipcRenderer.send("get-bookmarks");
