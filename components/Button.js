/**
 * 移动端优化的Button组件
 * 支持PC端和移动端交互，提供完整的无障碍支持
 */

class MobileButton {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      size: 'md', // sm, md, lg
      variant: 'primary', // primary, secondary, danger, ghost
      disabled: false,
      loading: false,
      debounce: 0, // 防抖时间(ms)
      ...options
    };
    
    this.isPressed = false;
    this.lastClickTime = 0;
    this.debounceTimer = null;
    
    this.init();
  }
  
  init() {
    this.setupElement();
    this.addEventListeners();
    this.updateState();
  }
  
  setupElement() {
    // 确保元素有正确的属性
    if (!this.element.hasAttribute('role')) {
      this.element.setAttribute('role', 'button');
    }
    
    // 添加基础类名
    this.element.classList.add('mobile-btn');
    this.element.classList.add(`mobile-btn--${this.options.size}`);
    this.element.classList.add(`mobile-btn--${this.options.variant}`);
    
    // 设置无障碍属性
    this.element.setAttribute('tabindex', '0');
    this.element.setAttribute('aria-disabled', this.options.disabled.toString());
    
    // 确保最小触摸区域
    this.ensureTouchTarget();
  }
  
  ensureTouchTarget() {
    const rect = this.element.getBoundingClientRect();
    const minSize = 44; // 44px 最小触摸区域
    
    if (rect.width < minSize || rect.height < minSize) {
      const padding = Math.max(0, (minSize - Math.min(rect.width, rect.height)) / 2);
      this.element.style.padding = `${padding}px`;
    }
  }
  
  addEventListeners() {
    // 使用Pointer Events统一处理鼠标和触摸
    this.element.addEventListener('pointerdown', this.handlePointerDown.bind(this), { passive: false });
    this.element.addEventListener('pointerup', this.handlePointerUp.bind(this), { passive: true });
    this.element.addEventListener('pointercancel', this.handlePointerCancel.bind(this), { passive: true });
    
    // 键盘支持
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // 防止iOS双击缩放
    this.element.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // 防止长按选择文字
    this.element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  handlePointerDown(e) {
    if (this.options.disabled || this.options.loading) {
      e.preventDefault();
      return;
    }
    
    this.isPressed = true;
    this.element.classList.add('mobile-btn--active');
    this.element.setAttribute('aria-pressed', 'true');
    
    // 防止默认行为
    e.preventDefault();
  }
  
  handlePointerUp(e) {
    if (!this.isPressed) return;
    
    this.isPressed = false;
    this.element.classList.remove('mobile-btn--active');
    this.element.setAttribute('aria-pressed', 'false');
    
    // 防抖处理
    if (this.options.debounce > 0) {
      this.handleDebouncedClick();
    } else {
      this.handleClick();
    }
  }
  
  handlePointerCancel(e) {
    this.isPressed = false;
    this.element.classList.remove('mobile-btn--active');
    this.element.setAttribute('aria-pressed', 'false');
  }
  
  handleKeyDown(e) {
    if (this.options.disabled || this.options.loading) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleClick();
    }
  }
  
  handleDebouncedClick() {
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;
    
    if (timeSinceLastClick < this.options.debounce) {
      return; // 忽略过快的点击
    }
    
    this.lastClickTime = now;
    
    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // 设置新的防抖定时器
    this.debounceTimer = setTimeout(() => {
      this.handleClick();
    }, this.options.debounce);
  }
  
  handleClick() {
    if (this.options.disabled || this.options.loading) return;
    
    // 触发自定义事件
    const clickEvent = new CustomEvent('mobile-btn:click', {
      detail: { button: this }
    });
    this.element.dispatchEvent(clickEvent);
    
    // 触发原始点击事件
    this.element.click();
  }
  
  updateState() {
    // 更新禁用状态
    if (this.options.disabled) {
      this.element.classList.add('mobile-btn--disabled');
      this.element.setAttribute('aria-disabled', 'true');
      this.element.setAttribute('tabindex', '-1');
    } else {
      this.element.classList.remove('mobile-btn--disabled');
      this.element.setAttribute('aria-disabled', 'false');
      this.element.setAttribute('tabindex', '0');
    }
    
    // 更新加载状态
    if (this.options.loading) {
      this.element.classList.add('mobile-btn--loading');
      this.element.setAttribute('aria-busy', 'true');
    } else {
      this.element.classList.remove('mobile-btn--loading');
      this.element.setAttribute('aria-busy', 'false');
    }
  }
  
  // 公共方法
  setDisabled(disabled) {
    this.options.disabled = disabled;
    this.updateState();
  }
  
  setLoading(loading) {
    this.options.loading = loading;
    this.updateState();
  }
  
  setVariant(variant) {
    this.element.classList.remove(`mobile-btn--${this.options.variant}`);
    this.options.variant = variant;
    this.element.classList.add(`mobile-btn--${variant}`);
  }
  
  setSize(size) {
    this.element.classList.remove(`mobile-btn--${this.options.size}`);
    this.options.size = size;
    this.element.classList.add(`mobile-btn--${size}`);
  }
  
  destroy() {
    // 清理事件监听器
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointercancel', this.handlePointerCancel);
    this.element.removeEventListener('keydown', this.handleKeyDown);
    
    // 清理定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// 自动初始化函数
function initMobileButtons() {
  const buttons = document.querySelectorAll('[data-mobile-btn]');
  buttons.forEach(button => {
    const options = {
      size: button.dataset.size || 'md',
      variant: button.dataset.variant || 'primary',
      disabled: button.hasAttribute('disabled'),
      loading: button.hasAttribute('loading'),
      debounce: parseInt(button.dataset.debounce) || 0
    };
    
    new MobileButton(button, options);
  });
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MobileButton, initMobileButtons };
} else {
  window.MobileButton = MobileButton;
  window.initMobileButtons = initMobileButtons;
}
