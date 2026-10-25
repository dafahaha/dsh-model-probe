# dsh-model-probe

<p align="center"><strong>简体中文</strong> · <a href="README.en.md">English</a></p>

在 DeepSeek Harness（DSH）Web 控制台里，对**当前配置的模型端点**一键发起一次 TransitTruth 真实性核验，展示三态徽章（pass / suspicious / insufficient_evidence）、关键证据摘要，并保留一份 append-only 的本地历史。

本插件是**薄壳桥接**：它不自研任何核验逻辑，只把 DSH 的操作动作桥接到本机的 `transit-truth verify` CLI。API 密钥**不落盘、不进日志、不进入报告**。

> 概率性核验、不构成真伪裁判；tokenizer 为弱信号。本插件不对任何商业服务商做点名评级。

## 前置依赖

1. **Python 3.10+**，且 PATH 上有可执行的 `transit-truth`。

   > 诚实状态（2026-10-22）：内核**尚未发布到 PyPI**，目前 `pip install transit-truth` 不可用。
   > 可通过配置项 `command` 指向内核本地检出路径；内核缺失时插件降级为
   > `insufficient_evidence` 的"未安装 CLI"提示，而不是崩溃。本插件是配套
   > companion，**不自研核验逻辑、不能独立提供核验能力**。

2. 一个 OpenAI 兼容端点的 Base URL、声称的模型名，以及（可选）API 密钥。

> 没有密钥时，内核只能返回 `missing_api_key` 错误报告（`insufficient_evidence`），不会发起探测。tokenizer-only 目录即便命中也只会落到 `insufficient_evidence`，不构成认证。

## 诚实披露（发布状态）

- **npm 名 `dsh-model-probe` 被无关第三方占用**：该名称由 npm 维护者 weiwie（GitHub xiaomao49/dsh-model-probe）注册，曾是功能相同的 DSH 端点探针；**其全部 19 个版本（含 latest 0.1.20）已于 2026-10-09 被维护者标记 deprecated/unmaintained**（直连官方 registry 实测："Deprecated and unmaintained (2026-10-09). 本包已废弃并停止维护。"）。名字仍被占用、无法在该名下发布，故本项目以新名 `dsh-transit-truth-probe` 发布（保留 `dsh-` 前缀以进入 `dsh-plugin` 生态发现，并内嵌 `transit-truth` 品牌）；请勿安装 npm 上的 `dsh-model-probe`。
- **内核未上 PyPI，本插件是配套 companion**：核验能力全部来自本地 `transit-truth` 内核 CLI；内核尚未发布到 PyPI，本插件不能独立提供核验能力，必须配合本地检出的内核源码使用。
- **真实宿主 live 测试待做**：尚未在真实 dsh-tui 0.16.x 宿主界面做过端到端 live 测试；Host/Origin/loopback 强制由宿主通道负责，本插件不自行实现。

## 安全边界（诚实声明）

- **SSRF 守卫是字面量主机检查，不是 DNS 解析防护**：`isNonPublicHost` 拦截环回/私有/link-local 的 IP 字面量与 `localhost` 名称（含尾点、`.localhost`、IPv4-mapped），但不解析 DNS。一个公网域名若解析到内网地址（或 DNS 重绑定）不在本插件防护范围内；威胁模型是宿主已认证的本地单用户工具。
- **响应只回传结构化解析报告，不回显原始 stdout**：即便 CLI 输出了非标准前缀的密钥形态，也不会经自由文本回传到客户端；`redactText` 是额外的纵深防御。
- **超时 SIGKILL 是兜底，针对直接子进程**：子进程同时收到 `--total-timeout` 约束其自身工作；Windows 下不做进程树/Job Object 回收。

## 安装

**当前唯一可用方式：本地从源码安装**（配套本地内核检出）。在本仓库目录执行：

```sh
dsh plugin --profile web add .
# dsh web 运行中则重启并刷新页面
```

可用 `dsh --profile web --dump-config` 确认插件已进入最终配置。

> npm 安装（未来时，暂不可用）：待拍板新名（推荐 `dsh-transit-truth-probe`）并完成改名与 `npm publish` 后，才能 `dsh plugin add dsh-transit-truth-probe`；**当前该名在 npm 上是 404，此命令现在执行会失败**。

## 使用

1. 打开 **设置 → 模型核验 · Model Probe**。
2. 表单会**尽力预填**已配置的自定义提供商（只读 `$DSH_HOME/profiles/web/cordis.patch.yml` 里的 `llm-pi-ai` providers，只取 Base URL、模型 id、`apiKeyEnv` 名；读不到就手填）。
3. 选择或填写端点后点 **一键核验当前端点**：
   - 直接填写的密钥只停留在本次内存，随子进程环境变量传给 CLI，不落盘、不进日志；
   - 也可以填一个已存在的环境变量名（如 `GATEWAY_API_KEY`），由 CLI 自行读取，本插件不读取其值。
   - 仅本机环来自测时勾选「允许本机/环来自测（--allow-local）」，默认关闭；该开关只对 127.0.0.1/私有地址放开，公网端点无需勾选。
4. 结果区显示三态徽章、后验概率与 95% CI、参考模型、tokenizer 信号、行为样本/请求数与说明；下方是历史记录（仅主机名，append-only）。核验失败或找不到 CLI 时，结果区给出诚实的配置提示（通过 `command` 指向内核本地检出；内核尚未上 PyPI），不会静默失败。

## 三态

| verdict | 含义 | 徽章 |
| --- | --- | --- |
| `pass` | 观测指纹与参考在统计上一致 | 绿色 |
| `suspicious` | 观测指纹显著不符（如错误模型族） | 红色 |
| `insufficient_evidence` | 无参考、样本不足或出错——不猜测 | 灰色 |

> 以下为 transit-truth **内核 CLI** 的退出码；插件 HTTP 响应恒为 200，结果以 JSON 的
> `verdict` 字段为准，不要按 HTTP 状态码判断。

退出码（内核 CLI）：`0` = pass；`1` = 其它命令的运行时错误（或裸跑不带子命令）；`2` = verify 非 pass（执行错误或证据不足 insufficient_evidence，含 argparse usage 错误）；`3` = suspicious。

## 隐私与安全

- 密钥只经子进程临时环境变量传递，**不写盘、不记录、不出现在报告里**；错误与 stderr 在离开桥接层前先做密钥脱敏。
- 历史只保存**主机名**（含非常默认端口），不保存密钥、完整 URL、路径或查询串。
- 本插件只在本机调用本地 CLI，不转发用户流量，不做云端报告。

## 诚实边界与限制

- 黑盒结果是**概率性辅助证据，不是密码学证明，也不是真伪裁判**；公开探针可被硬编码回放，temperature=0 的行为基线可被确定性复现。
- tokenizer 计数由端点在 `usage.prompt_tokens` 自报，是**弱信号**；行为指纹才是主要判据。
- v0.1 的 DSH 接口仍可能破坏性变更；本插件把易变层隔离在适配壳内。
- 不提供闭源模型签名指纹库，不自动阻断请求，不点名任何站点。

## 开发

```sh
npm install --legacy-peer-deps   # 本机 npm arborist 在此环境误解析 peer 依赖（本机环境问题，非包问题）；正常环境直接 npm install 即可
npm run typecheck
npm run test                     # vitest
npm run build                   # tsdown -> lib/index.js + lib/client.js
npm run check                   # typecheck + test + build
```

纯逻辑单测覆盖：verify JSON 解析、三态映射、append-only 历史、密钥脱敏、端点预填解析、spawn 参数构建。`stubs/` 下的三个桩（pass / suspicious / error）用于在无 Python、无密钥、无网络的条件下验证桥接层。

## 发布状态（npm 包名：dsh-transit-truth-probe）

1. **npm 名 `dsh-model-probe` 已被第三方抢注**：维护者 weiwie（GitHub xiaomao49/dsh-model-probe），曾是功能相同的 DSH 端点探针；其全部 19 个版本已于 2026-10-09 被维护者标记 deprecated/unmaintained（直连官方 registry 实测）。名字仍被占用，本项目以 `dsh-transit-truth-probe` 为新包名发布。
2. 内核 `transit-truth` 尚未上 PyPI，本插件只是配套 companion，随内核本地源码一起安装使用，不独立分发。
3. 真实 dsh-tui 0.16.x 宿主 live 测试待做；在此之前不做任何目录收录声明。
4. 本地门禁已跑通：`npm run typecheck`、`npm run test`、`npm run build`、`npm run verify`（官方 verify-plugin 静态门禁，0 FAIL）、`npm run pack`（dry-run）。

## License

MIT（TransitTruth 内核同为 MIT，封装未修改其核验逻辑）。
