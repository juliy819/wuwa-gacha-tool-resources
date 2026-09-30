# Wuwa Resource Snapshot

独立资源快照仓库。Action 从 nanoka 拉取角色、武器目录、图标及角色立绘，分别存入 `icons/` 与 `portraits/`，并生成带 SHA-256 的压缩包和 `resource-manifest.json`。`catalog.json` 的角色资源可选包含 `signature_weapon_id` 和 `release_order`，分别记录已经核对过的角色与专武关系，以及资源包维护的角色首次上线顺序；未登记的角色保持无映射，由主程序回退到单资源记录。beta 目录中暂未提供的图片会记录在 `missing_assets`，不会阻止已有目录和素材发布；其他下载或文件异常仍会终止构建。`catalog.json` 记录全部图片内容的组合 SHA-256，因此目录或任意图片变化都会触发更新。它与主程序 Release、OCR 组件 Release 完全分离；没有变化时定时任务只完成检查，不创建新的 Release。

资源 Release tag 使用 `resources-YYYY.MM.DD-<catalog_sha256 前 8 位>`。日期按 UTC 生成，内容哈希确保同一天的多次真实资源更新仍有唯一、可追溯的发布地址；无变化的定时检查不会影响发布编号。

## 角色与专武

首次上线顺序维护在 `data/role-release-order.json`，按新到旧排列，`release_order` 从 0 开始，数值越小展示越靠前。复刻不改变首次上线顺序。构建校验 ID、中文名及重复项；未登记的新角色不写入排序字段，由客户端置于末尾。nanoka 目录按资源 ID 排列，不能用目录位置或资源 ID 推断上线顺序。

维护入口为 `data/signature-weapons.json`，同时保存角色和专武的 ID 与中文名称。构建脚本核对上游 ID、中文名称、五星品质、武器类型和重复关系，再将 `signature_weapon_id` 写入角色资源；映射变更会改变 catalog 哈希并触发资源更新。

当前 39 组手动关系以 nanoka `3.7` 的角色详情 `recommend.weapon[0]` 为核对依据。手动映射优先；未配置的五星角色在构建时读取同版本角色详情，使用推荐首项兜底。排除五位常驻角色、漂泊者、两套常驻五星武器与投影外观，并校验角色身份、武器品质、类型及重复关系。推荐列表本身不是专武契约，出现例外时应添加手动映射覆盖。详情读取限时 15 秒，读取失败或候选不合格时输出警告，保留无映射状态；不会阻止已有资源构建。上游 beta 数据的名称和内容可能调整，手动映射校验不通过时应重新核对。

运行映射逻辑测试：`node --test scripts/signature-weapons.test.mjs`。

例如：[心的角色详情](https://static.nanoka.cc/ww/3.7/zh/character/1311.json) 首选武器为 `21050116`，[对应武器详情](https://static.nanoka.cc/ww/3.7/zh/weapon/21050116.json) 的中文名为“玉阙玄华”；锁暝对应“沉冥”，露帕对应“焰痕”。
