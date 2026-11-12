# Fork 更新与安装

本 Fork 基于 supermomonga/paseo-plugin-zcode-provider 的 0.5.2，保留上游 MIT
许可和署名。它是社区维护版本，不是 ZCode 或 Z.ai 官方插件。插件 ID 仍为
`zcode-provider`，Provider ID 仍为 `zcode`。

## 本次修复

- ZCode Desktop 3.18 使用新版 `enc:v2` 凭据。3.17 运行时无法读取，恢复账号时可能
  清除当前账号标记。因此托管运行时升级到 3.18，旧运行时会在启动前被拒绝。
- 识别新版中国区 OAuth 身份 `zai_cn`。账号身份与 BigModel/Z.ai 模型套餐区域
  分开处理，账号页和额度发现使用相同规则；不改写登录令牌。
- 打包新版凭据存储的原生 keyring 依赖，以及由公开源码构建的 Windows x64
  进程辅助程序。依赖按 ZCode 源码锁文件校验，运行时下载按固定 SHA-256 校验。
- 保留旧会话恢复修复：已保存模型或思考等级失效时，恢复会话允许回退至可用选择，
  让历史记录和模型选择界面能够加载。用户主动选择模型时仍严格校验，不吞掉错误。

运行时使用 ZCode 公开源码提交 `b95ebaffeab641907b38652f45c1502bd762972d`，
版本 3.18.0。只应用隐藏不支持能力的已有构建补丁，不修改认证、凭据格式或模型
请求。兼容的 RPC/V4 源码仍固定在上游 3.17.2 基线，另用真实 3.18 运行时验证。

## 在另一台电脑安装

操作在 Paseo daemon 所在电脑执行。先确认 Paseo 版本至少 0.15.0，并启用插件。
插件后端具有该电脑当前用户的文件、进程及网络权限。

若已经配置其他来源的 `zcode-provider`，先移除该插件注册：

```powershell
paseo plugin remove zcode-provider
```

然后安装本 Fork：

```powershell
paseo plugin add github:zlfuu531/paseo-plugin-zcode-provider --ref main
paseo plugin ls zcode-provider --json
```

先核对 [README 中的版本兼容表](../README.md#requirements)：Paseo 最低 0.15.0，
本次实测 0.15.4；ZCode Server 最低 3.18.0，Agent 最低 0.17.1；执行 ZCode 的
普通 Node.js 最低 24.14.0，托管版本为 24.21.0。

**已有兼容运行时且插件能够找到时，直接复用，不需要重复安装。** 插件可以发现已安装的
托管运行时；自备完整运行时通过 `PASEO_ZCODE_RUNTIME` 和 `PASEO_ZCODE_NODE`
指定路径，配置需在 daemon 的运行环境中生效。仅在终端设置变量，不会改变已运行的
Paseo Desktop 或 daemon 的环境。

只有缺少兼容运行时或现有版本不满足要求时，才进入 Settings → Plugins →
zcode-provider → Settings → Runtime，选择 Download and install。这里安装的是
独立的 Node.js 24.21.0 和 ZCode 3.18.0 运行时，不替换本机 ZCode Desktop 或全局
CLI，不修改系统 PATH。

账号由 ZCode 官方服务管理。若同一电脑已在 ZCode Desktop 登录，插件可共享该
登录态；先刷新 Account 页，无需分别反复登录。中国区身份可显示为 `zai_cn`，
模型套餐区域仍可以是 BigModel。

```powershell
paseo provider diagnostic zcode --json
paseo provider models zcode --json
```

诊断应显示 Server 3.18.0、Node.js 24.21.0 和 Ready。免费 Start Plan 是否有
模型取决于服务端实时权益；`pending` 表示权益尚未生效，不能当成登录失败，
也不能靠插件强制启用。没有套餐模型时，仍可使用自己配置的 API 模型供应商。

已经安装本 Fork 的电脑可以执行 `paseo plugin update zcode-provider`。已有运行时
满足要求时无需再安装；不满足时才在 Runtime 页补充安装或升级。若原插件来自 npm
或另一分支，先按上述步骤重新注册来源。不要删除 `.zcode`，其中保存的是共享账号、
设置与会话数据。

## 验证与限制

Windows x64 已验证：Desktop 登录后插件可读取同一账号；插件重载后两边保持
登录；账号/额度识别、旧会话恢复、历史回放、停止与错误恢复、MCP、Goal 和
压缩等行为由测试覆盖。实际模型调用及套餐权益不能由本地模拟测试保证。

本次只发布已实测的 Windows x64 托管运行时，其他平台不提供自动安装。
发布包携带源码提交、构建补丁、许可声明和构建来源记录。

本 Fork 不自动向上游 npm 包发布，也不向上游仓库合并。历史实验分支保留用于
追溯，安装本次维护版本请使用本 Fork 的 `main`。
