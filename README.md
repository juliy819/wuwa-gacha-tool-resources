# Wuwa Resource Snapshot

独立资源快照仓库。Action 从 nanoka 拉取角色、武器目录、图标及角色立绘，分别存入 `icons/` 与 `portraits/`，并生成带 SHA-256 的压缩包和 `resource-manifest.json`。beta 目录中暂未提供的图片会记录在 `missing_assets`，不会阻止已有目录和素材发布；其他下载或文件异常仍会终止构建。`catalog.json` 记录全部图片内容的组合 SHA-256，因此目录或任意图片变化都会触发更新。它与主程序 Release、OCR 组件 Release 完全分离；没有变化时定时任务只完成检查，不创建新的 Release。

资源 Release tag 使用 `resources-YYYY.MM.DD-<catalog_sha256 前 8 位>`。日期按 UTC 生成，内容哈希确保同一天的多次真实资源更新仍有唯一、可追溯的发布地址；无变化的定时检查不会影响发布编号。
