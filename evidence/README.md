# 证据与复现说明

本目录留存构建/测试与桥接实跑的日志，供交付核对。

## 文件

- `test-run.log` — `vitest run --reporter=verbose` 全量输出（**历史快照，R2 时点**：8 个测试文件、57 个用例全部通过，含 `config.spec.ts` 7 例配置校验；该日志未随后续轮次重跑）。
- **当前真实测试结果以 `tests/test-output.txt` 为准**（最近实跑：12 个测试文件、**119 个用例全部通过**）；历史计数演进见仓库根 `CHANGELOG.md`，不再在此手写数字以免漂移。

## 本轮（R2）修复清单

- P2-1：client 半补 `export const inject = ['slots']`，对齐 dsh-visualize 注册链路。
- P2-2：新增可移植自校验 `config-schema.ts`（默认值/类型/非法值回退+记录），`apply()` 使用；`config.spec.ts` 覆盖缺字段默认、非法值回退、未知字段忽略。
- P3-1：移除恒为 null 的 `--version`/`ttVersion` 探测；核验失败/缺 CLI 时响应带 `installHint`（`pip install transit-truth` 引导），前端展示。
- P3-2：表单加 `--allow-local` 勾选框，默认关闭，仅环来自测用。
- P3-3：删除中英 README 中未实现的「本地 serve HTTP API」传输描述。
- P3-4：package.json 补 `keywords`；`repository/homepage/bugs/icon` 待真实仓库 URL 发布前补。
- P3-5：node 半接 `settings.configure({ auto: false })`（松散查找、缺失降级），拒绝宿主自动生成重复设置页。
- `bridge-demo.log` — 通过本插件桥接层（`runVerify` → `parseVerifyReport` → `normalizeVerifyReport` → `resolveFinalVerdict`）真实驱动三个桩的可读转录：
  - PASS（exit 0）→ `pass`，posterior 0.87，CI [0.71, 0.95]，tokenizer match 5/5；
  - SUSPICIOUS（exit 3）→ `suspicious`，posterior 0.12，tokenizer mismatch 1/5；
  - ERROR（exit 2）→ `insufficient_evidence`（fail-closed），errorCode `transport_error`。

## 桩说明（无 Python / 无密钥 / 无网络）

- `stubs/tt-pass.js`：输出 canned pass 报告，exit 0。
- `stubs/tt-suspicious.js`：输出 canned suspicious 报告，exit 3。
- `stubs/tt-error.js`：输出 fail-closed 错误报告，exit 2。

驱动方式（开发自用，不随 npm 发布）：

```sh
node --experimental-strip-types stubs/drive-demo.ts
```

## 真实内核自测（可选，未在本轮执行）

本机 `transit-truth` 仓库的 `.venv-win`（Python 3.11）可 `import app.verify`。如需真实端到端：

```sh
transit-truth reference-server --model qwen2.5-0.5b-instruct --port 8765
transit-truth verify --base-url http://127.0.0.1:8765/v1 \
  --model qwen2.5-0.5b-instruct --allow-local
```

该路径为 tokenizer-only，预期落到 `insufficient_evidence`；需要真实行为证据时对带行为分布的基线跑带密钥的 `verify`。

## DSH 控制台冒烟（本轮未执行）

未在本机启动 `npx @deepseek-ai/dsh web` 做真实控制台冒烟：本环境禁止遗留长驻 node/npx 进程，且不登录；本仓库未安装/启动宿主。可复现步骤（发布后）：

```sh
# 1. 安装插件到 web profile（用改名后的新名；dsh-model-probe 是被第三方
#    抢注且已 deprecated 的包，切勿 add 旧名）
dsh plugin --profile web add dsh-transit-truth-probe
# 2. 启动控制台
npx @deepseek-ai/dsh web 127.0.0.1:3080
# 3. 设置 → 模型核验，填 Base URL/模型，点一键核验，核对徽章/证据/历史
```
