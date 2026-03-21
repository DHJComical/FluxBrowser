const { ipcRenderer } = require("electron");

const bookmarkList = document.getElementById("bookmark-list");
const bookmarksCount = document.getElementById("bookmarks-count");

// 格式化时间显示
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
        return `${mins}分${secs}秒`;
    }
    return `${secs}秒`;
}

ipcRenderer.on("bookmarks-data", (e, bookmarks) => {
    bookmarkList.innerHTML = "";
    
    // 更新书签数量
    bookmarksCount.textContent = `${bookmarks.length} 个书签`;
    
    if (bookmarks.length === 0) {
        // 空状态
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
            <i class="material-icons">bookmark_border</i>
            <p>暂无书签记录</p>
        `;
        bookmarkList.appendChild(emptyState);
        return;
    }
    
    bookmarks.forEach((b, index) => {
        const div = document.createElement("div");
        div.className = "bookmark-item";
        div.innerHTML = `
            <div class="bookmark-icon">
                <i class="material-icons">play_circle_filled</i>
            </div>
            <div class="bookmark-content">
                <div class="bookmark-title">${b.title}</div>
                <div class="bookmark-meta">
                    <div class="bookmark-time">
                        <i class="material-icons">schedule</i>
                        <span>进度: ${formatTime(b.time)}</span>
                    </div>
                    ${b.url ? `<div class="bookmark-url">${b.url}</div>` : ""}
                </div>
            </div>
            <div class="bookmark-actions">
                <button class="bookmark-btn delete" data-index="${index}" title="删除书签">
                    <i class="material-icons">delete</i>
                </button>
            </div>
        `;
        
        // 点击整个卡片打开书签
        div.onclick = () => {
            ipcRenderer.send("open-bookmark", b);
            window.close();
        };

        // 删除按钮事件
        div.querySelector(".delete-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
        });
        
        const deleteBtn = div.querySelector(".bookmark-btn.delete");
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                ipcRenderer.send("delete-bookmark", index);
            };
        }
        
        bookmarkList.appendChild(div);
    });
});

ipcRenderer.send("get-bookmarks");
