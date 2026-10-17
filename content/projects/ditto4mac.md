---
title: "Ditto4Mac"
description: "macOS 菜单栏剪贴板管理器，轻量、零依赖的剪贴板历史工具。"
technologies:
  - Swift
  - SwiftUI
  - AppKit
featured: true
weight: 1
link: "https://github.com/cnefan31/ditto4mac"
---

一个常驻菜单栏的剪贴板历史工具。纯 Swift 实现，不引入任何第三方依赖，打包后仅 576KB。

## 解决的问题

系统自带的剪贴板只保留最后一次复制的内容。写代码、整理资料时经常需要在几条内容之间来回搬运，一旦覆盖就找不回来了。Ditto4Mac 常驻后台记录纯文本历史，随时呼出检索。

## 核心特性

- **自动捕获**：后台轮询剪贴板，记录纯文本历史
- **全局快捷键**：默认 `Cmd+Shift+V` 呼出面板
- **实时搜索**：输入即过滤，不用翻列表
- **单击复用**：点击记录即复制到剪贴板并置顶
- **固定与删除**：右键可固定常用条目，或清理不需要的
- **本地持久化**：数据存在 `~/.ditto4mac/`，重启不丢
- **可配置**：最大记录数、存储路径、字符上限都能调

## 技术实现

采用 MVVM 分层：

| 模块 | 职责 |
|------|------|
| `ClipboardMonitor` | `NSPasteboard` 轮询，0.5 秒间隔 |
| `HotkeyManager` | Carbon 全局热键注册 |
| `StorageService` | JSON 索引 + 文本文件双写 |
| `ClipboardViewModel` | `@MainActor` 状态管理 |
| `ClipboardListView` | 搜索框 + 历史列表 + 斑马纹 |

面板用 `NSPanel` 实现，配合 `NSStatusBar` 做菜单栏图标，点击面板外自动隐藏（需要辅助功能授权）。

## 开发中踩的坑

项目里有一份完整的 [开发经验总结](https://github.com/cnefan31/ditto4mac/blob/main/docs/lessons-learned.md)，记录了 Swift 工具链、API 版本兼容和打包公证过程中遇到的问题。几个典型例子：

- 只装 CommandLineTools 时 `libPackageDescription.dylib` 不完整，导致 `swift build` 链接失败
- 内层目录里的 `Package.swift` 会被 SPM 递归当作源码编译，必须显式 `exclude`
- Swift 6 严格并发下，Carbon C 回调不能捕获上下文，常量需改成 `static let`
- `.foregroundStyle()` 等 SwiftUI API 要求 macOS 14，需要为 macOS 13 提供降级写法

## 构建与发布

```bash
swift build                    # 调试构建
bash scripts/build_app.sh      # 打包 .app
bash scripts/build_app.sh release
```

发布流程支持本地签名公证和 GitHub Actions 自动构建，打了 tag 就会产出 DMG 与 ZIP 并上传到 Release。
