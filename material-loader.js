// 材质配置加载器
class MaterialLoader {
    constructor() {
        this.materials = null;
        this.cssVariables = {};
    }

    // 加载材质配置文件
    async loadMaterials() {
        try {
            const response = await fetch('./materials.json');
            if (!response.ok) {
                throw new Error('Failed to load materials.json');
            }
            this.materials = await response.json();
            this.generateCSSVariables();
            this.applyCSSVariables();
            console.log('Materials loaded successfully');
        } catch (error) {
            console.error('Error loading materials:', error);
            // 使用默认材质
            this.loadDefaultMaterials();
        }
    }

    // 生成CSS变量
    generateCSSVariables() {
        if (!this.materials) return;

        // 面板材质变量
        this.cssVariables['--panel-bg'] = this.materials.materials.panel.background;
        this.cssVariables['--panel-blur'] = this.materials.materials.panel.blur;
        this.cssVariables['--panel-shadow'] = this.materials.materials.panel.shadow;
        this.cssVariables['--panel-border'] = this.materials.materials.panel.border;

        // 控件材质变量
        this.cssVariables['--control-bg'] = this.materials.materials.control.background;
        this.cssVariables['--control-blur'] = this.materials.materials.control.blur;
        this.cssVariables['--control-border'] = this.materials.materials.control.border;
        this.cssVariables['--control-radius'] = this.materials.materials.control.radius;

        // 下拉材质变量
        this.cssVariables['--dropdown-bg'] = this.materials.materials.dropdown.background;
        this.cssVariables['--dropdown-blur'] = this.materials.materials.dropdown.blur;
        this.cssVariables['--dropdown-border'] = this.materials.materials.dropdown.border;
        this.cssVariables['--dropdown-shadow'] = this.materials.materials.dropdown.shadow;

        // UI行为变量
        this.cssVariables['--mode-switcher-auto-hide-delay'] = this.materials.ui_behavior.mode_switcher.auto_hide_delay + 'ms';
    }

    // 应用CSS变量到根元素
    applyCSSVariables() {
        const root = document.documentElement;
        Object.entries(this.cssVariables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
    }

    // 默认材质配置（如果JSON加载失败）
    loadDefaultMaterials() {
        console.log('Using default materials');
        this.materials = {
            materials: {
                panel: {
                    background: "rgba(30, 30, 35, 0.25)",
                    blur: "blur(1px)",
                    shadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.08)"
                },
                control: {
                    background: "rgba(255, 255, 255, 0.03)",
                    blur: "blur(1px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    radius: "12px"
                },
                dropdown: {
                    background: "rgba(25, 25, 30, 0.95)",
                    blur: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    shadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                }
            },
            ui_behavior: {
                mode_switcher: {
                    auto_hide_delay: 5000,
                    show_on_hover_top: true
                }
            }
        };
        this.generateCSSVariables();
        this.applyCSSVariables();
    }

    // 获取材质配置
    getMaterialConfig(materialType) {
        return this.materials?.materials[materialType] || null;
    }

    // 获取UI行为配置
    getUIBehaviorConfig() {
        return this.materials?.ui_behavior || null;
    }
}

// 创建全局材质加载器实例
const materialLoader = new MaterialLoader();

// 页面加载时自动加载材质
document.addEventListener('DOMContentLoaded', () => {
    materialLoader.loadMaterials();
});

// 导出材质加载器供其他模块使用
window.MaterialLoader = MaterialLoader;
window.materialLoader = materialLoader;