# 材质系统文档

## 概述

为了防止硬编码的样式值导致维护困难，本项目实现了严格的材质系统。**所有背景、边框、阴影、模糊效果都必须通过三种材质类型来定义，禁止在 CSS 中硬编码颜色值。**

## 三种材质

### 1. Panel（面板）
- **用途**：主要面板容器、信息展示区域
- **特性**：轻微模糊，背景透明度低，突出内容可读性
- **配置位置**：`materials.json` → `materials.panel`
- **CSS 变量**：
  - `--panel-bg`：背景色
  - `--panel-blur`：背景模糊度
  - `--panel-shadow`：阴影效果
  - `--panel-border`：边框样式

### 2. Control（控件）
- **用途**：交互元素（按钮、输入框、滑块、复选框等）
- **特性**：与面板保持视觉一致，提供适当的交互反馈
- **配置位置**：`materials.json` → `materials.control`
- **CSS 变量**：
  - `--control-bg`：默认背景色
  - `--control-blur`：背景模糊度
  - `--control-border`：边框样式
  - `--control-radius`：圆角半径
  - `--control-hover-bg`：悬停状态背景
  - `--control-active-bg`：激活/按下状态背景

### 3. Dropdown（下拉）
- **用途**：下拉菜单、弹出窗口、浮层元素
- **特性**：强模糊背景，较深的色调，确保内容清晰可读
- **配置位置**：`materials.json` → `materials.dropdown`
- **CSS 变量**：
  - `--dropdown-bg`：背景色
  - `--dropdown-blur`：背景模糊度
  - `--dropdown-border`：边框样式
  - `--dropdown-shadow`：阴影效果

## 如何修改样式

### ✅ 正确做法
编辑 `materials.json` 文件，修改对应材质的属性：

```json
{
  "materials": {
    "panel": {
      "background": "rgba(255, 255, 255, 0.03)",
      "blur": "blur(1px)",
      "shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
      "border": "1px solid rgba(255, 255, 255, 0.08)"
    },
    "control": {
      "background": "rgba(255, 255, 255, 0.03)",
      "hoverBackground": "rgba(255, 255, 255, 0.08)",
      "activeBackground": "rgba(255, 255, 255, 0.12)"
    }
  }
}
```

修改后刷新浏览器，样式会自动更新。

### ❌ 错误做法
- 在 `style.css` 中硬编码 RGBA 颜色值
- 使用 `background: rgba(30, 30, 35, 0.5)` 而不是 `background: var(--control-bg)`
- 绕过材质系统直接指定颜色

## 工作原理

1. **加载**：`material-loader.js` 在页面加载时从 `materials.json` 读取配置
2. **映射**：将 JSON 中的值映射到 CSS 自定义属性（CSS Variables）
3. **应用**：所有样式使用这些 CSS 变量，动态应用材质

```
materials.json
     ↓
material-loader.js (从 JSON 读取)
     ↓
CSS 自定义属性 (--panel-bg, --control-bg, 等)
     ↓
style.css (使用 var(--panel-bg) 等)
     ↓
最终渲染效果
```

## 文件说明

| 文件 | 作用 | 修改频率 |
|------|------|--------|
| `materials.json` | 材质配置文件 | 经常（每次调整样式） |
| `material-loader.js` | 材质加载器 | 极少（架构变更时） |
| `style.css` | 样式表 | 仅添加新样式类，不修改颜色值 |

## 添加新样式的规则

如需添加新的样式类，遵循以下规则：

### ❌ 错误示例
```css
.my-button {
    background: rgba(30, 30, 35, 0.5);  /* ⚠️  硬编码！禁止！ */
    border: 1px solid rgba(255, 255, 255, 0.1);  /* ⚠️  硬编码！禁止！ */
}
```

### ✅ 正确示例
```css
.my-button {
    background: var(--control-bg);      /* ✅ 使用材质变量 */
    border: var(--control-border);      /* ✅ 使用材质变量 */
    -webkit-backdrop-filter: var(--control-blur);
    backdrop-filter: var(--control-blur);
}

.my-button:hover {
    background: var(--control-hover-bg);  /* ✅ 悬停状态 */
}

.my-button:active {
    background: var(--control-active-bg);  /* ✅ 激活状态 */
}
```

## 分类指南

| 元素类型 | 使用材质 | 示例 |
|---------|--------|------|
| 面板容器、卡片、信息框 | `--panel-*` | `.panel`, `.info-card` |
| 按钮、输入框、滑块、复选框 | `--control-*` | `button`, `input`, `.slider` |
| 下拉菜单、弹出框、悬浮层 | `--dropdown-*` | `.dropdown-menu`, `.popup` |

## 颜色一致性

所有三种材质都使用**完全一致的设计语言**：
- 都是**白色透明系**，透明度不同但色调一致
- 都通过**模糊（backdrop-filter）** 实现玻璃质感
- 都有**适当的阴影**增强层次感

## 常见问题

### Q: 为什么要禁止硬编码？
**A:** 硬编码导致：
- 样式分散在多个地方，难以统一修改
- 主题切换时需要改动多个文件
- 容易出现不一致的颜色值
- 难以维护和升级

### Q: 如果我想用完全不同的配色方案怎么办？
**A:** 修改 `materials.json`中的三种材质配置，所有样式会自动更新。你可以创建多个配置文件版本，需要时直接替换。

### Q: CSS 中可以写硬编码的文字颜色吗？
**A:** 可以。**硬编码禁止仅限于材质相关的属性**（背景、边框、阴影、模糊等）。文字颜色、z-index、间距、圆角等非材质属性仍然可以直接设置。

### Q: 添加新的特殊颜色（如强调色、危险色）怎么办？
**A:** 这些是**功能性颜色**，不属于材质系统，可以在 CSS 中硬编码。材质系统只负责UI框架的统一性。

## 检查清单

添加新样式时的检查清单：

- [ ] 是否使用了 `rgba()` 硬编码的颜色值？（背景、边框、阴影）
- [ ] 是否应该改用 `var(--panel-bg)`、`var(--control-bg)` 或 `var(--dropdown-bg)`？
- [ ] 是否需要在悬停/激活状态时提供不同的背景？
- [ ] 是否添加了 `backdrop-filter` 来保证玻璃质感？
- [ ] 是否使用了材质对应的边框和阴影变量？
