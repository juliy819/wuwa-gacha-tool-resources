# Wuwa Resource Snapshot

独立资源快照仓库。Action 从 nanoka 拉取角色、武器目录及头像，生成带 SHA-256 的压缩包和 `resource-manifest.json`。它与主程序
Release、OCR 组件 Release 完全分离。定时任务会比较目录内容 SHA-256；没有角色、武器或头像变化时只完成检查，不创建新的 Release。
