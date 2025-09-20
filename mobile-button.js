/**
 * 移动端按钮组件 - JavaScript 功能
 * 提供触控优化、无障碍支持和状态管理
 */

class MobileButton {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      preventDoubleClick: true,
      loadingTimeout: 0,
      clickThrottle: 300,
      ...options
    };
    
    this.isLoading = false;
    this.lastClickTime = 0;
    this.clickCount = 0;
    this.clickTimer = null;
    
    this.init();
  }
  
  init() {
    this.setupAccessibility();
    this.setupTouchEvents();
    this.setupKeyboardEvents();
    this.setupLoadingState();
  }
  
  setupAccessibility() {
    // 确保有正确的 role
    if (!this.element.getAttribute('role')) {
      this.element.setAttribute('role', 'button');
    }
    
    // 添加 tabindex 如果不存在
    if (!this.element.hasAttribute('tabindex')) {
      this.element.setAttribute('tabindex', '0');
    }
    
    // 支持 aria-pressed 状态
    if (this.element.hasAttribute('data-toggle')) {
      this.element.setAttribute('aria-pressed', 'false');
    }
  }
  
  setupTouchEvents() {
    // 防止双击缩放
    this.element.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: true });
    
    // 触控反馈
    this.element.addEventListener('touchstart', (e) => {
      if (!this.isDisabled()) {
        this.element.classList.add('touching');
      }
    }, { passive: true });
    
    this.element.addEventListener('touchend', () => {
      this.element.classList.remove('touching');
    }, { passive: true });
    
    this.element.addEventListener('touchcancel', () => {
      this.element.classList.remove('touching');
    }, { passive: true });
  }
  
  setupKeyboardEvents() {
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleClick(e);
      }
    });
  }
  
  setupLoadingState() {
    // 监听加载状态变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          this.updateLoadingState();
        }
      });
    });
    
    observer.observe(this.element, { attributes: true });
  }
  
  handleClick(event) {
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;
    
    // 防止重复点击
    if (this.options.preventDoubleClick && timeSinceLastClick < this.options.clickThrottle) {
      event.preventDefault();
      return;
    }
    
    // 检查是否禁用
    if (this.isDisabled() || this.isLoading) {
      event.preventDefault();
      return;
    }
    
    this.lastClickTime = now;
    this.clickCount++;
    
    // 处理切换状态
    if (this.element.hasAttribute('data-toggle')) {
      this.togglePressed();
    }
    
    // 触发自定义事件
    this.element.dispatchEvent(new CustomEvent('mobileButtonClick', {
      detail: {
        clickCount: this.clickCount,
        timestamp: now
      }
    }));
  }
  
  togglePressed() {
    const isPressed = this.element.getAttribute('aria-pressed') === 'true';
    this.element.setAttribute('aria-pressed', (!isPressed).toString());
    this.element.classList.toggle('pressed', !isPressed);
  }
  
  setLoading(loading) {
    this.isLoading = loading;
    
    if (loading) {
      this.element.classList.add('loading');
      this.element.setAttribute('aria-busy', 'true');
      
      if (this.options.loadingTimeout > 0) {
        setTimeout(() => {
          this.setLoading(false);
        }, this.options.loadingTimeout);
      }
    } else {
      this.element.classList.remove('loading');
      this.element.removeAttribute('aria-busy');
    }
  }
  
  setDisabled(disabled) {
    this.element.disabled = disabled;
    this.element.setAttribute('aria-disabled', disabled.toString());
    
    if (disabled) {
      this.element.classList.add('disabled');
    } else {
      this.element.classList.remove('disabled');
    }
  }
  
  isDisabled() {
    return this.element.disabled || this.element.classList.contains('disabled');
  }
  
  updateLoadingState() {
    this.isLoading = this.element.classList.contains('loading');
  }
  
  // 公共方法
  click() {
    if (!this.isDisabled() && !this.isLoading) {
      this.element.click();
    }
  }
  
  focus() {
    this.element.focus();
  }
  
  blur() {
    this.element.blur();
  }
}

// 自动初始化所有移动端按钮
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.mobile-btn');
  buttons.forEach(button => {
    new MobileButton(button);
  });
});

// 导出类供外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileButton;
} else if (typeof window !== 'undefined') {
  window.MobileButton = MobileButton;
}
