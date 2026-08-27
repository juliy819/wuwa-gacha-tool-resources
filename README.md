# Wuwa Resource Snapshot

独立资源快照仓库。Action 从 nanoka 拉取角色、武器目录、图标及角色立绘，分别存入 `icons/` 与 `portraits/`，并生成带 SHA-256 的压缩包和 `resource-manifest.json`。`catalog.json` 记录全部图片内容的组合 SHA-256，因此目录或任意图片变化都会触发更新。它与主程序 Release、OCR 组件 Release 完全分离；没有变化时定时任务只完成检查，不创建新的 Release。
