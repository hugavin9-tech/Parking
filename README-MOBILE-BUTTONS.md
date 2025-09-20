# 移动端按钮组件规范与用法

## 概述

本文档描述了停车游戏项目中移动端按钮组件的设计规范、实现方案和使用方法。该组件旨在为PC端和移动端提供统一的按钮交互体验，特别针对iOS/Android设备的触摸优化。

## 设计原则

### 1. 交互与可用性
- **点击热区**: 所有按钮最小触摸区域 ≥ 44x44 逻辑像素
- **触摸优化**: 去除移动端300ms点击延迟，提供明显的点按态反馈
- **统一交互**: 使用Pointer Events统一处理鼠标和触摸交互
- **状态管理**: 支持正常、激活、禁用、加载四种状态

### 2. 视觉与响应式
- **自适应设计**: 使用CSS变量和clamp()函数实现流式布局
- **断点设计**: 主断点768px，小屏375px精调
- **字体缩放**: 支持系统字体缩放，最小14px
- **安全区域**: 底部CTA按钮适配safe-area-inset

### 3. 无障碍与可达性
- **语义化**: 所有按钮包含role="button"和可见label
- **键盘导航**: 支持Tab键导航和Enter/Space键激活
- **屏幕阅读器**: 使用aria-pressed、aria-disabled、aria-busy
- **焦点管理**: 保留focus-visible样式，确保键盘用户可见

## 技术实现

### 组件结构

```
components/
├── Button.js          # 核心组件逻辑
├── Button.css         # 样式定义
└── Button-test.html   # 测试页面
```

### 核心特性

#### 1. 事件处理
```javascript
// 使用Pointer Events统一处理
element.addEventListener('pointerdown', handler, { passive: false });
element.addEventListener('pointerup', handler, { passive: true });
element.addEventListener('pointercancel', handler, { passive: true });
```

#### 2. 防抖机制
```javascript
// 表单提交按钮默认1.2s防抖
const button = new MobileButton(element, {
  debounce: 1200  // 防抖时间(ms)
});
```

#### 3. 状态管理
```javascript
// 动态状态更新
button.setDisabled(true);
button.setLoading(true);
button.setVariant('danger');
button.setSize('lg');
```

### CSS变量系统

```css
:root {
  --btn-h-sm: 36px;           /* 小按钮高度 */
  --btn-h-md: 44px;           /* 中按钮高度 */
  --btn-h-lg: 52px;           /* 大按钮高度 */
  --btn-tap-area: 44px;       /* 最小触摸区域 */
  --btn-font-size-sm: 14px;   /* 小字体 */
  --btn-font-size-md: 16px;   /* 中字体 */
  --btn-font-size-lg: 18px;   /* 大字体 */
}
```

## 使用方法

### 1. 基础用法

```html
<!-- 自动初始化 -->
<button class="mobile-btn primary" data-mobile-btn onclick="handleClick()">
  点击我
</button>
```

### 2. 高级配置

```html
<!-- 自定义配置 -->
<button 
  class="mobile-btn primary" 
  data-mobile-btn 
  data-size="lg"
  data-variant="danger"
  data-debounce="1200"
  onclick="handleSubmit()">
  提交
</button>
```

### 3. 程序化创建

```javascript
// 创建按钮实例
const button = new MobileButton(element, {
  size: 'md',           // sm, md, lg
  variant: 'primary',   // primary, secondary, danger, ghost
  disabled: false,      // 禁用状态
  loading: false,       // 加载状态
  debounce: 0          // 防抖时间(ms)
});

// 动态更新
button.setDisabled(true);
button.setLoading(true);
```

## 样式变体

### 尺寸变体
- `mobile-btn--sm`: 小按钮 (36px高度)
- `mobile-btn--md`: 中按钮 (44px高度) 
- `mobile-btn--lg`: 大按钮 (52px高度)

### 颜色变体
- `mobile-btn--primary`: 主要按钮 (蓝色渐变)
- `mobile-btn--secondary`: 次要按钮 (灰色背景)
- `mobile-btn--danger`: 危险按钮 (红色渐变)
- `mobile-btn--ghost`: 幽灵按钮 (透明背景)

### 状态变体
- `mobile-btn--active`: 激活状态
- `mobile-btn--disabled`: 禁用状态
- `mobile-btn--loading`: 加载状态

## 响应式设计

### 断点策略
```css
/* 移动端优化 */
@media (max-width: 768px) {
  .mobile-btn {
    min-height: 44px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
}

/* 小屏优化 */
@media (max-width: 375px) {
  :root {
    --btn-font-size-sm: 13px;
    --btn-font-size-md: 14px;
    --btn-font-size-lg: 16px;
  }
}
```

### 安全区域适配
```css
.mobile-btn--cta {
  position: fixed;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 16px;
  right: 16px;
}
```

## 无障碍支持

### ARIA属性
```html
<button 
  role="button"
  aria-label="描述性标签"
  aria-pressed="false"
  aria-disabled="false"
  aria-busy="false">
  按钮文本
</button>
```

### 键盘导航
- `Tab`: 焦点切换
- `Enter`: 激活按钮
- `Space`: 激活按钮
- `Escape`: 取消操作

### 屏幕阅读器
- 自动读取按钮文本和状态
- 支持aria-label自定义描述
- 状态变化时自动播报

## 性能优化

### 1. 事件优化
```javascript
// 使用passive监听器提升性能
element.addEventListener('touchstart', handler, { passive: true });
element.addEventListener('pointerdown', handler, { passive: false });
```

### 2. 防抖节流
```javascript
// 防止快速连击
const debouncedClick = debounce(handleClick, 300);
```

### 3. 内存管理
```javascript
// 组件销毁时清理
button.destroy();
```

## 兼容性

### 浏览器支持
- iOS Safari 12+
- Android Chrome 70+
- 现代桌面浏览器

### 降级策略
- Pointer Events不支持时降级到Touch Events
- CSS变量不支持时使用固定值
- 现代特性不支持时提供基础功能

## 测试验证

### 自动化测试
```javascript
// 基础功能测试
test('按钮点击', () => {
  const button = new MobileButton(element);
  button.element.click();
  expect(button.element).toHaveClass('mobile-btn--active');
});

// 无障碍测试
test('键盘导航', () => {
  const button = new MobileButton(element);
  button.element.focus();
  expect(button.element).toHaveFocus();
});
```

### 手动测试清单
- [ ] 点击热区 ≥ 44x44px
- [ ] 触摸反馈明显
- [ ] 长按不触发选择
- [ ] 键盘导航正常
- [ ] 屏幕阅读器可读
- [ ] 快速连击防抖
- [ ] 加载状态显示
- [ ] 禁用状态不可点击

## 迁移指南

### 从旧按钮迁移
1. 添加`data-mobile-btn`属性
2. 添加`role="button"`和`aria-label`
3. 更新CSS类名为`mobile-btn`
4. 测试交互功能

### 破坏性变更
- 移除了部分hover-only交互
- 更新了事件监听器参数
- 修改了CSS类名结构

## 最佳实践

### 1. 按钮设计
- 优先使用主要按钮进行重要操作
- 危险操作使用危险按钮样式
- 次要操作使用次要或幽灵按钮

### 2. 布局建议
- 按钮组使用flex布局
- 保持8px最小间距
- 底部CTA固定位置

### 3. 性能考虑
- 避免在按钮上使用复杂动画
- 合理使用防抖机制
- 及时清理事件监听器

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 支持基础按钮功能
- 移动端触摸优化
- 无障碍支持
- 响应式设计

## 贡献指南

### 开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

### 代码规范
- 使用ES6+语法
- 遵循Airbnb代码规范
- 添加JSDoc注释
- 编写单元测试

## 许可证

MIT License - 详见LICENSE文件
