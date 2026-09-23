# Jev Hold'em

单挑无限德州。你对阵 TypeSafe **Jev**：本地引擎负责发牌、成牌、底池赔率和合法动作；Jev 只回答一组 typed 问题（Choice / Score / Noul），再由代码组合成注。

## 部署

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?from=github&template=jev-holdem)

更多模板：[EdgeOne Pages](https://edgeone.ai/pages/templates)

## 概述

打开页面即开局。你是 Hero，对面是 Jev。轮到 Jev 时，前端把当前牌桌状态打成一次 SystemOne 请求，由 EdgeOne Makers Models 的 `@makers/jev` 模型给出这一手的判断。

接口不可用时，本地启发式仍会选出合法动作，牌局不会卡住。

## 功能特性

- **单挑无限德州** — 盲注、街道、加注尺度、全下、摊牌，以及两人桌的筹码结算
- **Typed Jev 判断** — 每次行动一次 `@makers/jev` 调用；不走聊天，不装 SDK
- **策略层** — 线路 Choice 的 confidence 够高就直接用；否则用 Score / Noul 组合成弃牌 / 让牌 / 跟注 / 下注 / 加注 / 全下
- **模型自动注入** — EdgeOne Makers Models 自动提供 `@makers/jev`，`edge-functions/typesafe/[[default]].js` 用它完成本局判断
- **移动优先牌桌** — 竖屏操作条吸底；横屏和桌面时判断面板在右侧
- **后备出牌** — 接口失败时按成牌类别走启发式，而不是停手

## 判断怎么来

问题和阈值都在 `src/jev/questions.js`。同一份 state 一次打完：

| 问题 | 类型 | 作用 |
|------|------|------|
| `made_hand_strength` | Score | 成牌强度（忽略听牌） |
| `draw_equity` | Score | 听牌额外胜率 |
| `board_danger` | Score | 牌面协调 / 危险程度 |
| `fold_to_price` | Noul | 价格是否高到该弃 |
| `value_bet` | Noul | 是否该为价值下注 / 加注 |
| `bluff` | Noul | 是否适合诈唬 |
| `trap` | Noul | 强牌是否该慢打 |
| `line` | Choice | fold / check / call / bet / raise / all-in |
| `bet_size` | Choice | small / medium / large / all_in |

`src/jev/policy.js` 把答案映射到 `getLegal()` 给出的合法动作。`@makers/jev` 由 EdgeOne Makers Models 自动注入。唯一的 HTTP 调用是 `POST /typesafe/v1/systemone`。

## 项目结构

```
jev-holdem/
├── index.html
├── edgeone.json                         # EdgeOne Pages 构建输出目录：dist/
├── edge-functions/
│   └── typesafe/
│       └── [[default]].js               # 本局 Jev 决策
└── src/
    ├── main.js                          # 对局循环、玩家输入、Jev 回合
    ├── ui.js                            # 牌桌、操作区、判断面板
    ├── style.css
    ├── poker/
    │   ├── cards.js                     # 牌组、花色、点数
    │   ├── hand.js                      # 五张成牌评估
    │   ├── facts.js                     # 成牌、听牌、底池赔率
    │   └── engine.js                    # 牌桌、街道、合法动作
    └── jev/
        ├── questions.js                 # SystemOne 问题与阈值
        ├── policy.js                    # 答案 → 合法动作
        └── client.js                    # fetch + 重试
```

## 环境变量

| 变量 | 是否必填 | 说明 |
|----------|----------|-------------|
| `AI_GATEWAY_BASE_URL` | 是 | 网关地址 |
| `AI_GATEWAY_API_KEY` | 是 | 网关 API Key |

## 了解更多

- [EdgeOne Pages](https://pages.edgeone.ai/zh)
- [EdgeOne Pages 函数](https://pages.edgeone.ai/zh/document/pages-functions-overview)
- [Vite](https://cn.vite.dev)
- [TypeSafe](https://typesafe.ai)
- [TypeSafe 文档](https://docs.typesafe.ai)
