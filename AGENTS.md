# Wuwa Resource Snapshot AI 开发规范

本文件适用于本仓库中的所有 AI 开发任务。开始工作前先阅读本文件、`README.md`、当前工作树、构建脚本、本地验证脚本和更新工作流；以当前上游数据和消费端契约为准，不用旧快照推断最新资源状态。

## 1. 仓库职责

本仓库是独立资源快照生产端，负责：

- 从受信任的 nanoka 数据源读取鸣潮角色、武器目录及素材路径；
- 生成 `resource-pack/catalog.json`、`icons/` 和 `portraits/`；
- 构建资源压缩包、SHA-256 和 `resource-manifest.json`；
- 定时检查内容变化，仅在资源真实变化时创建独立 GitHub Release。

React/Tauri 界面、资源安装、缓存迁移和 nanoka 回退属于同级 `wuwa-gacha-tool` 主程序仓库；OCR 图像匹配属于同级 `wuwa-gacha-tool-ocr-runtime` 仓库。本仓库不实现消费端逻辑，也不与主程序或 OCR 组件共用 Release。

主程序和 OCR runtime 都消费本仓库产物。修改目录、字段、素材覆盖范围或 manifest 时，必须检查两个消费端的向后兼容性、失败回退和发布顺序。

## 2. 开始工作与改动范围

1. 先执行只读检查：查看 `git status --short`、相关提交历史、当前脚本、最新本地输出和远端 Release 状态，再判断问题所在。
2. 工作区可能已有用户或其他任务的修改。不得覆盖、还原、格式化、删除或顺带提交无关文件。
3. `resource-pack/`、`resource-pack-*.zip`、`resource-pack-local.zip`、`verify-unpacked/`、`resource-manifest.json` 和校验文件是可再生成产物，默认不得提交；也不得因为体积大而删除未确认归属的其他文件。
4. 构建脚本只可清理明确的生成目录和本次产物。新增递归删除或移动操作前必须核对解析后的绝对路径位于本仓库预期目录内。
5. 用户只要求诊断或评审时，默认读取本地与远端证据并报告，不直接修改脚本或触发 Release。

## 3. 快照完整性

资源构建必须 fail closed：只有完整、结构有效且可验证的快照才能进入压缩和发布阶段。

- `catalog.json` 的 `resources` 包含约定范围内的全部角色和武器；`icons` 和 `portraits` 声明成功下载的素材，beta 目录中尚未提供的图片写入 `missing_assets`。
- 上游条目缺少素材路径或素材明确返回 HTTP 404 时可以发布部分素材，并在 `missing_assets` 中记录资源 ID、目录和原因。其他 HTTP 错误、网络异常、响应不是 WebP、文件大小异常或写入失败必须让整个构建失败。
- 文件名和 catalog 映射使用资源 ID 加 `.webp`，不得接受绝对路径、父目录、额外层级或来自上游的原始文件名。
- 不能只依赖“数量大于某个阈值”判断完整。还要逐项核对 catalog 映射、实际文件、资源 ID、类型、星级、格式和重复项。
- 生成顺序必须确定：同一份上游内容多次构建应得到相同的 catalog 内容和内容哈希。不要用对象遍历偶然顺序、下载完成顺序或压缩时间戳表达资源身份。
- `assets_sha256` 应覆盖规范化的素材相对路径和文件字节；`catalog_sha256` 覆盖最终 `catalog.json`。ZIP 哈希用于验证下载完整性，不用于判断资源内容是否变化，因为压缩元数据可能变化。

增加新素材类别时，要同时补齐下载、路径白名单、格式/大小限制、catalog 映射、组合内容哈希、本地解包验证以及两个消费端支持，不能只把文件塞进 ZIP。

## 4. 数据契约

当前资源包契约包括：

- `resource-pack/catalog.json`：上游版本、`assets_sha256`、`resources`、`icons`、`portraits`、`missing_assets`；
- `resource-pack/icons/<resource_id>.webp`：角色和武器图标；
- `resource-pack/portraits/<resource_id>.webp`：角色立绘；
- `resource-manifest.json`：`schema`、`archive_url`、`archive_sha256`、`archive_size`、`catalog_sha256`。

字段含义和目录名属于跨仓库协议：

- 新字段优先采用向后兼容的增量方式；删除、重命名或改义前，先升级主程序和 OCR runtime，并设计旧客户端的回退。
- `sourceVersion`、快照版本、Release tag 和 schema 版本含义不同，不得互相替代。
- manifest 的 URL、大小和 SHA-256 必须对应同一次 Release 的实际 asset；不允许指向临时文件或另一次构建。
- catalog 中的素材声明必须与压缩包内容完全一致，不允许存在未声明文件、悬空映射或同一 ID 的冲突定义。

## 5. 变化检测与 Release

- 工作流按计划任务或人工触发检查，但无变化不是错误，也不得创建空更新 Release。
- 先完整构建并计算本次 `catalog_sha256`，再通过 GitHub Releases API 读取最新 Release 的 `resource-manifest.json` 进行比较。
- 远端不存在任何 Release 的明确 `404` 是唯一的首次发布路径。已有 Release 时，API 非 `200`、asset 缺失、下载失败、JSON 无效或 `catalog_sha256` 格式错误都必须终止，不能按“发生变化”继续发布。
- 只有新旧有效 `catalog_sha256` 明确不同时才允许压缩、生成 manifest 和创建 Release。相同时结束检查，不产生新 tag 或 asset。
- 保持工作流 `concurrency` 串行，避免两个定时/手动任务同时基于同一个 latest Release 发布重复快照。
- 不在没有证据时把异常归因于缓存或 CDN。诊断重复 Release 时先检查远端最新 manifest、工作流实际 commit、API 返回和比较条件。
- 本地脚本成功不代表远端无变化分支或 Release 发布已验证；只有看到对应 Actions 运行后才能确认远端行为。

## 6. 上游与安全边界

- 保持固定 HTTPS 上游及明确的数据路径转换，不接受 catalog 中任意域名或任意本地输出路径。
- 新增或修改网络下载逻辑时，必须检查状态、设置合理超时，并限制单文件和总快照规模。新增重试时要有次数上限，且最终失败仍阻止发布；触及现有下载路径时应补齐缺失的保护。
- 素材至少校验 RIFF/WEBP 文件头与大小；若引入其他格式，为其单独定义白名单和验证，不得放宽为任意二进制。
- 日志可以记录资源 ID、素材类别、HTTP 状态和计数，不应输出授权头、token 或完整 GitHub API 响应中的敏感字段。
- 不因单个上游异常删除或覆盖已发布 Release。消费端继续使用最后一个有效快照，生产端等待下次可靠构建。

## 7. 提交消息

沿用主项目的提交格式：

```text
type: 中文 summary

中文 detail，说明资源覆盖、失败边界、契约或发布行为。

验证：实际执行的构建、数量、哈希或工作流检查。
```

允许的类型为 `feat`、`fix`、`perf`、`refactor`、`docs`、`ci`、`chore`：

- `feat`：新增可供客户端使用的素材类别或资源能力；
- `fix`：修复缺失、错误素材、校验漏洞或误发布行为；
- `perf`：输出语义不变且有证据的下载、构建或校验性能优化；
- `refactor`：只调整内部结构，不改变产物和发布行为；
- `docs`：仅文档或契约说明；
- `ci`：定时检查、变化判断和 Release 工作流；
- `chore`：依赖、工具和仓库配置等非资源能力。

`summary` 应从使用资源包的用户或客户端视角说明实际变化，避免只写脚本名、变量名或“更新规则”。人工提交必须有独立正文，清楚说明哪些异常现在会阻止发布以及验证了多少资源；测试随所属功能提交，不使用 `test`、`build`、`style`、`ui`、`doc` 等额外前缀。

提交前检查 `git diff --cached --stat`、`git diff --cached` 和 `git status --short`，只暂存当前任务文件。除非用户明确要求，不主动提交、改写历史、打 tag、推送、手动运行工作流或创建 Release。

## 8. 验证与交付

按改动风险选择验证，并报告真实结果：

- Node 语法：`node --check scripts/build.mjs`
- 完整本地构建及解包验证：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local.ps1`
- 构建结果至少报告上游版本、资源数、图标数、立绘数、`assets_sha256`、`catalog_sha256` 和压缩包大小
- 逐项检查 catalog 映射与解包文件一致，确认没有未知文件、缺失素材、不安全路径和非 WebP 内容
- 工作流改动检查 YAML、shell 的失败传播、步骤条件和首次发布/无变化/有变化/远端读取失败四条分支
- 跨仓库契约变化在主程序和 OCR runtime 中分别完成解析或安装验证
- 提交内容：`git diff --check` 或暂存后 `git diff --cached --check`

完整构建会访问网络并重建生成目录，运行前先确认当前目录和未提交产物。未实际运行 GitHub Actions 或消费端集成测试时，要明确标注为未验证，不能用本地 ZIP 校验替代。
