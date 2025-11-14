// 固定颜色定义
const FIXED_COLORS = {
    // 五个产品卖点序号颜色（永远不变）
    pointNumbers: ['#FA3F3F', '#FF8F0A', '#EFDD13', '#9EDC23', '#535ED9'],
    // 副标题文字颜色（永远不变）
    subtitleText: '#555555'
};

// 当前提取的颜色
let currentStrongColor = '#6B6B6B'; // 深色（主色）
let currentSoftColor = '#EFEFEF';   // 浅色（副色）

// DOM元素引用
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const uploadArea = document.getElementById('uploadArea');
const previewImage = document.getElementById('previewImage');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const themeImage = document.getElementById('themeImage');
const themeImageLabel = document.getElementById('themeImageLabel');
const strongColorBox = document.getElementById('strongColorBox');
const softColorBox = document.getElementById('softColorBox');
const strongColorCode = document.getElementById('strongColorCode');
const softColorCode = document.getElementById('softColorCode');
const titleBox = document.getElementById('titleBox');
const lightBackgroundSection = document.getElementById('lightBackgroundSection');
const colorLogicOutput = document.getElementById('colorLogicOutput');
const paletteJsonOutput = document.getElementById('paletteJsonOutput');
const cardAvatar = document.getElementById('cardAvatar');
const cardQrcode = document.getElementById('cardQrcode');
const qrcodeCanvas = document.getElementById('qrcodeCanvas');
const iphoneBtn = document.getElementById('iphoneBtn');
const h5Btn = document.getElementById('h5Btn');
const phoneMockup = document.getElementById('phoneMockup');
const phoneScreen = document.getElementById('phoneScreen');
const h5LongImageContainer = document.getElementById('h5LongImageContainer');
const h5LongImageContent = document.getElementById('h5LongImageContent');

// 处理文件上传的通用函数
function handleFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const imageUrl = event.target.result;
        
        // 显示预览图片，隐藏提示文字
        previewImage.src = imageUrl;
        previewImage.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        
        // 显示主题图片，隐藏提示文字
        if (themeImage) {
            themeImage.src = imageUrl;
            themeImage.style.display = 'block';
            if (themeImageLabel) {
                themeImageLabel.style.display = 'none';
            }
        }
        
        // 从主题图中提取两种颜色，并根据配色逻辑应用到长图
        extractColorsFromThemeImage(imageUrl);
    };
    reader.readAsDataURL(file);
}

// 绑定选择文件按钮事件
selectBtn.addEventListener('click', () => {
    fileInput.click();
});

// 文件选择事件
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

// 拖拽上传功能
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

// 点击上传区域也可以选择文件
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

/**
 * 从主题图中提取两种颜色，并根据配色逻辑应用到长图
 * @param {string} imageUrl - 主题图片的URL
 */
function extractColorsFromThemeImage(imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
        // 创建Canvas来读取图片像素
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置Canvas尺寸（为了性能，可以缩小图片）
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // 绘制图片到Canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // 获取像素数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // 提取所有颜色并转换为HSL
        const colorMap = new Map();
        const totalPixels = canvas.width * canvas.height;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];
            
            // 跳过透明或接近透明的像素
            if (a < 128) continue;
            
            // 转换为HSL
            const hsl = rgbToHsl(r, g, b);
            
            // 量化颜色以减少颜色数量（将HSL值量化）
            const quantizedH = Math.floor(hsl.h / 10) * 10;
            const quantizedS = Math.floor(hsl.s / 20) * 20;
            const quantizedL = Math.floor(hsl.l / 20) * 20;
            const key = `${quantizedH},${quantizedS},${quantizedL}`;
            
            if (colorMap.has(key)) {
                colorMap.get(key).count++;
            } else {
                colorMap.set(key, {
                    r, g, b,
                    h: hsl.h,
                    s: hsl.s,
                    l: hsl.l,
                    count: 1
                });
            }
        }
        
        // 转换为数组并计算占比
        const colors = Array.from(colorMap.values()).map(color => {
            const ratio = color.count / totalPixels;
            // 确保有HSL属性
            const hsl = rgbToHsl(color.r, color.g, color.b);
            return {
                r: color.r,
                g: color.g,
                b: color.b,
                h: hsl.h,
                s: hsl.s,
                l: hsl.l,
                ratio
            };
        });
        
        // 按占比排序，找出占比最大的两种颜色（从主题图中提取的两种主要颜色）
        colors.sort((a, b) => b.ratio - a.ratio);
        
        // 提取两种主要颜色（如果只有一种颜色，创建默认的第二种颜色）
        // 这两种颜色将根据配色逻辑应用到长图上
        const color1 = colors[0] || { r: 107, g: 107, b: 107, h: 0, s: 0, l: 42, ratio: 0.5 };
        let color2 = colors[1];
        if (!color2) {
            // 如果没有第二种颜色，基于第一种颜色创建一个对比色
            const hsl1 = rgbToHsl(color1.r, color1.g, color1.b);
            const rgb2 = hslToRgb((hsl1.h + 180) % 360, hsl1.s, Math.min(hsl1.l + 40, 85));
            color2 = {
                r: rgb2.r,
                g: rgb2.g,
                b: rgb2.b,
                h: (hsl1.h + 180) % 360,
                s: hsl1.s,
                l: Math.min(hsl1.l + 40, 85),
                ratio: 0.3
            };
        }
        
        // 计算两种颜色的视觉重量得分
        // S 越高 → 视觉更重（颜色更浓）
        // L 越低 → 视觉更重（更暗）
        // 得分 = (S / 100) * 0.6 + ((100 - L) / 100) * 0.4
        const score1 = (color1.s / 100) * 0.6 + ((100 - color1.l) / 100) * 0.4;
        const score2 = (color2.s / 100) * 0.6 + ((100 - color2.l) / 100) * 0.4;
        
        // 根据得分判断strong和soft
        // 得分高 → strong，得分低 → soft
        let candidateStrong = score1 > score2 ? color1 : color2;
        let candidateSoft = score1 > score2 ? color2 : color1;
        
        // 确保strong是深色（L < 50），soft是浅色（L >= 50）
        // 如果strong不是深色，需要调整
        let finalStrong, finalSoft;
        
        if (candidateStrong.l >= 50) {
            // strong应该是深色，但当前是浅色，需要交换或调整
            if (candidateSoft.l < 50) {
                // 如果soft是深色，交换它们
                finalStrong = candidateSoft;
                finalSoft = candidateStrong;
            } else {
                // 两个都是浅色，将strong调整为深色
                const hsl = rgbToHsl(candidateStrong.r, candidateStrong.g, candidateStrong.b);
                const rgb = hslToRgb(hsl.h, hsl.s, Math.min(hsl.l, 45));
                finalStrong = {
                    r: rgb.r,
                    g: rgb.g,
                    b: rgb.b,
                    h: hsl.h,
                    s: hsl.s,
                    l: Math.min(hsl.l, 45)
                };
                finalSoft = candidateSoft;
            }
        } else {
            // strong是深色，检查soft
            if (candidateSoft.l < 50) {
                // soft也是深色，需要调整为浅色
                const hsl = rgbToHsl(candidateSoft.r, candidateSoft.g, candidateSoft.b);
                const rgb = hslToRgb(hsl.h, hsl.s, Math.max(hsl.l, 55));
                finalSoft = {
                    r: rgb.r,
                    g: rgb.g,
                    b: rgb.b,
                    h: hsl.h,
                    s: hsl.s,
                    l: Math.max(hsl.l, 55)
                };
            } else {
                finalSoft = candidateSoft;
            }
            finalStrong = candidateStrong;
        }
        
        // 对strong和soft都应用莫兰迪色调映射
        const morandiStrong = applyMorandiMapping(finalStrong);
        const morandiSoft = applyMorandiMapping(finalSoft);
        
        // 确保莫兰迪映射后，strong仍然是深色，soft仍然是浅色
        const strongHsl = rgbToHsl(morandiStrong.r, morandiStrong.g, morandiStrong.b);
        const softHsl = rgbToHsl(morandiSoft.r, morandiSoft.g, morandiSoft.b);
        
        let finalStrongRgb = morandiStrong;
        if (strongHsl.l >= 50) {
            // 如果映射后strong不是深色，强制调整为深色
            finalStrongRgb = hslToRgb(strongHsl.h, strongHsl.s, Math.min(strongHsl.l, 45));
        }
        
        let finalSoftRgb = morandiSoft;
        if (softHsl.l < 50) {
            // 如果映射后soft不是浅色，强制调整为浅色
            finalSoftRgb = hslToRgb(softHsl.h, softHsl.s, Math.max(softHsl.l, 55));
        }
        
        // 转换为十六进制
        const strongHex = rgbToHex(finalStrongRgb.r, finalStrongRgb.g, finalStrongRgb.b);
        const softHex = rgbToHex(finalSoftRgb.r, finalSoftRgb.g, finalSoftRgb.b);
        
        // 生成并显示取色逻辑代码（显示在右侧"取色逻辑"卡片）
        generateColorLogicCode(strongHex, softHex, finalStrongRgb, finalSoftRgb, {
            r: color1.r,
            g: color1.g,
            b: color1.b,
            h: color1.h,
            s: color1.s,
            l: color1.l,
            ratio: color1.ratio || 0
        }, {
            r: color2.r,
            g: color2.g,
            b: color2.b,
            h: color2.h,
            s: color2.s,
            l: color2.l,
            ratio: color2.ratio || 0
        });
        
        // 生成并显示Palette JSON代码（显示在右侧"Palette JSON 例子"卡片）
        generatePaletteJson(strongHex, softHex, finalStrongRgb, finalSoftRgb);
        
        // 将从主题图中提取的两种颜色根据配色逻辑应用到长图
        updateColors(strongHex, softHex);
    };
    
    img.src = imageUrl;
}

/**
 * RGB转HSL
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {Object} HSL对象 {h, s, l}
 */
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0; // 无色彩
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * HSL转RGB
 * @param {number} h - 色相 (0-360)
 * @param {number} s - 饱和度 (0-100)
 * @param {number} l - 明度 (0-100)
 * @returns {Object} RGB对象 {r, g, b}
 */
function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // 无色彩
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * RGB转十六进制
 * @param {number} r - 红色值
 * @param {number} g - 绿色值
 * @param {number} b - 蓝色值
 * @returns {string} 十六进制颜色值
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * 十六进制转RGB
 * @param {string} hex - 十六进制颜色值（如 #FF0000）
 * @returns {Object} RGB对象 {r, g, b}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * 将颜色调淡（增加亮度）
 * @param {string} hexColor - 十六进制颜色值
 * @param {number} lightenAmount - 调淡程度（0-100，默认20，表示增加20%的亮度）
 * @returns {string} 调淡后的十六进制颜色值
 */
function lightenColor(hexColor, lightenAmount = 20) {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return hexColor;
    
    // 转换为HSL
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    // 增加亮度，但不超过95%
    const newLightness = Math.min(hsl.l + lightenAmount, 95);
    
    // 转换回RGB并返回十六进制
    const newRgb = hslToRgb(hsl.h, hsl.s, newLightness);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * 判断两种颜色的搭配效果是否和谐
 * 通过计算色差和视觉效果来判断
 * @param {Object} color1 - 第一种颜色对象 {r, g, b, h, s, l}
 * @param {Object} color2 - 第二种颜色对象 {r, g, b, h, s, l}
 * @returns {boolean} 是否和谐
 */
function checkColorHarmony(color1, color2) {
    // 计算色差（欧几里得距离）
    const colorDiff = Math.sqrt(
        Math.pow(color1.r - color2.r, 2) +
        Math.pow(color1.g - color2.g, 2) +
        Math.pow(color1.b - color2.b, 2)
    );
    
    // 计算色相差
    const hueDiff = Math.abs(color1.h - color2.h);
    const minHueDiff = Math.min(hueDiff, 360 - hueDiff);
    
    // 计算明度差
    const lightnessDiff = Math.abs(color1.l - color2.l);
    
    // 计算饱和度差
    const saturationDiff = Math.abs(color1.s - color2.s);
    
    // 判断是否和谐的标准：
    // 1. 色差不能太小（至少要有一定对比度）
    // 2. 色相差不能太大（避免过于冲突）
    // 3. 明度差要适中（不能太接近也不能太极端）
    // 4. 饱和度不能都太高（避免过于刺眼）
    
    const isContrastEnough = colorDiff > 50; // 色差足够
    const isHueHarmonious = minHueDiff < 120 || minHueDiff > 180; // 色相和谐（相近或互补）
    const isLightnessGood = lightnessDiff > 20 && lightnessDiff < 70; // 明度差适中
    const isSaturationGood = (color1.s + color2.s) / 2 < 80; // 平均饱和度不过高
    
    // 如果满足大部分条件，则认为和谐
    const harmonyScore = (isContrastEnough ? 1 : 0) + 
                        (isHueHarmonious ? 1 : 0) + 
                        (isLightnessGood ? 1 : 0) + 
                        (isSaturationGood ? 1 : 0);
    
    return harmonyScore >= 3; // 至少满足3个条件
}

/**
 * 应用莫兰迪色调映射
 * 莫兰迪色调特点：低饱和度、柔和、高级感
 * @param {Object} color - 颜色对象 {r, g, b, h, s, l}
 * @returns {Object} 映射后的RGB颜色 {r, g, b}
 */
function applyMorandiMapping(color) {
    // 将颜色转换为HSL
    const hsl = rgbToHsl(color.r, color.g, color.b);
    
    // 莫兰迪色调映射：
    // 1. 降低饱和度（通常降到15-35%）
    // 2. 保持原有的明度范围（深色保持深，浅色保持浅）
    // 3. 稍微调整色相，使其更柔和
    
    let morandiH = hsl.h;
    
    // 降低饱和度，但保持最低15%，最高35%
    let morandiS = Math.max(Math.min(hsl.s * 0.5, 35), 15);
    
    // 保持原有的明度范围，但稍微调整使其更柔和
    // 深色（L < 50）：保持在30-50之间
    // 浅色（L >= 50）：保持在50-75之间
    let morandiL;
    if (hsl.l < 50) {
        // 深色：保持在30-50之间
        morandiL = Math.max(Math.min(hsl.l, 50), 30);
    } else {
        // 浅色：保持在50-75之间
        morandiL = Math.max(Math.min(hsl.l, 75), 50);
    }
    
    // 转换为RGB
    return hslToRgb(morandiH, morandiS, morandiL);
}

/**
 * 生成并显示取色逻辑代码（显示在右侧"取色逻辑"卡片）
 * @param {string} strongHex - 深色（主色）的十六进制值
 * @param {string} softHex - 浅色（副色）的十六进制值
 * @param {Object} finalStrongRgb - 深色的RGB值
 * @param {Object} finalSoftRgb - 浅色的RGB值
 * @param {Object} color1 - 提取的第一种颜色
 * @param {Object} color2 - 提取的第二种颜色
 */
function generateColorLogicCode(strongHex, softHex, finalStrongRgb, finalSoftRgb, color1, color2) {
    if (!colorLogicOutput) return;
    
    const strongHsl = rgbToHsl(finalStrongRgb.r, finalStrongRgb.g, finalStrongRgb.b);
    const softHsl = rgbToHsl(finalSoftRgb.r, finalSoftRgb.g, finalSoftRgb.b);
    const lightenedSoft = lightenColor(softHex, 15);
    
    const code = `// 从主题图中提取的两种颜色
// ============================================

// 提取的原始颜色
const extractedColor1 = {
    rgb: [${color1.r}, ${color1.g}, ${color1.b}],
    hsl: [${Math.round(color1.h)}, ${Math.round(color1.s)}, ${Math.round(color1.l)}],
    hex: "${rgbToHex(color1.r, color1.g, color1.b).toUpperCase()}",
    ratio: ${(color1.ratio * 100).toFixed(2)}%
};

const extractedColor2 = {
    rgb: [${color2.r}, ${color2.g}, ${color2.b}],
    hsl: [${Math.round(color2.h)}, ${Math.round(color2.s)}, ${Math.round(color2.l)}],
    hex: "${rgbToHex(color2.r, color2.g, color2.b).toUpperCase()}",
    ratio: ${(color2.ratio * 100).toFixed(2)}%
};

// 处理后的最终颜色
const strongColor = {
    name: "深色（主色）",
    rgb: [${finalStrongRgb.r}, ${finalStrongRgb.g}, ${finalStrongRgb.b}],
    hsl: [${Math.round(strongHsl.h)}, ${Math.round(strongHsl.s)}, ${Math.round(strongHsl.l)}],
    hex: "${strongHex.toUpperCase()}"
};

const softColor = {
    name: "浅色（副色）",
    rgb: [${finalSoftRgb.r}, ${finalSoftRgb.g}, ${finalSoftRgb.b}],
    hsl: [${Math.round(softHsl.h)}, ${Math.round(softHsl.s)}, ${Math.round(softHsl.l)}],
    hex: "${softHex.toUpperCase()}"
};

// 调淡后的浅色（用于背景）
const lightenedSoftColor = {
    hex: "${lightenedSoft.toUpperCase()}",
    usage: "用于浅色背景区域和产品卖点卡片"
};

// ============================================
// 配色逻辑应用
// ============================================

// 1. 标题框
titleBox.style.backgroundColor = "${strongHex.toUpperCase()}";
// 标题框文字颜色：白色（固定）

// 2. 六个产品小标题
// 固定颜色：#555555（不变）

// 3. 数值文字
subtitleValues.forEach(el => {
    el.style.color = "${strongHex.toUpperCase()}";
});

// 4. 产品卖点五条白卡
sellingPointItems.forEach(el => {
    el.style.backgroundColor = "${lightenedSoft.toUpperCase()}";
});
sellingPointTexts.forEach(el => {
    el.style.color = "${strongHex.toUpperCase()}";
});

// 5. 三个标签（产卖点签、责任摘要、疾病条款）
headers.forEach(el => {
    el.style.backgroundColor = "${strongHex.toUpperCase()}";
});
// 标签文字颜色：白色（固定）

// 6. 浅色背景区域（副标题下方的整个区域）
lightBackgroundSection.style.backgroundColor = "${lightenedSoft.toUpperCase()}";

// 7. 名片区域边框
cardSection.style.borderColor = "${strongHex.toUpperCase()}";

// ============================================
// 固定颜色（不变）
// ============================================
// - 卡片区域背景：白色
// - 产卖点签的序号颜色：固定不变
//   #FA3F3F, #FF8F0A, #EFDD13, #9EDC23, #535ED9
// - 副标题标签文字：固定 #555555`;
    
    colorLogicOutput.innerHTML = `<code class="code-content">${code}</code>`;
}

/**
 * 生成并显示Palette JSON代码（显示在右侧"Palette JSON 例子"卡片）
 * @param {string} strongHex - 深色（主色）的十六进制值
 * @param {string} softHex - 浅色（副色）的十六进制值
 * @param {Object} finalStrongRgb - 深色的RGB值
 * @param {Object} finalSoftRgb - 浅色的RGB值
 */
function generatePaletteJson(strongHex, softHex, finalStrongRgb, finalSoftRgb) {
    if (!paletteJsonOutput) return;
    
    const strongHsl = rgbToHsl(finalStrongRgb.r, finalStrongRgb.g, finalStrongRgb.b);
    const softHsl = rgbToHsl(finalSoftRgb.r, finalSoftRgb.g, finalSoftRgb.b);
    const lightenedSoft = lightenColor(softHex, 15);
    const lightenedSoftRgb = hexToRgb(lightenedSoft);
    const lightenedSoftHsl = rgbToHsl(lightenedSoftRgb.r, lightenedSoftRgb.g, lightenedSoftRgb.b);
    
    const json = {
        palette: {
            strong: {
                name: "深色（主色）",
                hex: strongHex.toUpperCase(),
                rgb: [finalStrongRgb.r, finalStrongRgb.g, finalStrongRgb.b],
                hsl: [Math.round(strongHsl.h), Math.round(strongHsl.s), Math.round(strongHsl.l)],
                usage: ["标题框背景", "标签背景", "数值文字", "产品卖点文字", "名片头像", "思维导图主节点", "连接线"]
            },
            soft: {
                name: "浅色（副色）",
                hex: softHex.toUpperCase(),
                rgb: [finalSoftRgb.r, finalSoftRgb.g, finalSoftRgb.b],
                hsl: [Math.round(softHsl.h), Math.round(softHsl.s), Math.round(softHsl.l)],
                usage: ["产品卖点卡片背景", "思维导图子节点背景"]
            },
            lightenedSoft: {
                name: "调淡后的浅色",
                hex: lightenedSoft.toUpperCase(),
                rgb: [lightenedSoftRgb.r, lightenedSoftRgb.g, lightenedSoftRgb.b],
                hsl: [Math.round(lightenedSoftHsl.h), Math.round(lightenedSoftHsl.s), Math.round(lightenedSoftHsl.l)],
                usage: ["浅色背景区域", "产品卖点卡片背景"]
            },
            fixed: {
                pointNumbers: ["#FA3F3F", "#FF8F0A", "#EFDD13", "#9EDC23", "#535ED9"],
                subtitleText: "#555555",
                cardBackground: "#FFFFFF",
                titleText: "#FFFFFF",
                labelText: "#FFFFFF"
            }
        }
    };
    
    const jsonString = JSON.stringify(json, null, 2);
    paletteJsonOutput.innerHTML = `<code class="code-content">${jsonString}</code>`;
}

/**
 * 根据配色逻辑，将从主题图中提取的两种颜色应用到长图的各个元素
 * @param {string} strongColor - 深色（主色）的十六进制值，从主题图中提取
 * @param {string} softColor - 浅色（副色）的十六进制值，从主题图中提取
 * 
 * 配色逻辑：
 * 1. 标题框：深色背景（主色）+ 白字
 * 2. 六个产品小标题：固定 #555（不变）
 * 3. 数值文字：使用深色（主色）
 * 4. 产品卖点五条白卡：浅色底（副色，调淡）+ 深色字（主色）
 * 5. 三个标签：深色背景（主色）+ 白字
 * 6. 卡片：始终白色（不变）
 * 7. 产卖点签的序号颜色：永远保持不变
 */
function updateColors(strongColor, softColor) {
    // 保存当前颜色
    currentStrongColor = strongColor;
    currentSoftColor = softColor;
    
    // 更新颜色显示（左侧控制面板）
    strongColorBox.style.backgroundColor = strongColor;
    softColorBox.style.backgroundColor = softColor;
    strongColorCode.textContent = strongColor.toUpperCase();
    softColorCode.textContent = softColor.toUpperCase();
    
    // 将浅色调淡用于背景（使背景更柔和）
    const lightenedSoftColor = lightenColor(softColor, 15);
    
    // === 根据配色逻辑应用到长图 ===
    
    // 1. 标题框：深色背景（主色）+ 白字
    titleBox.style.backgroundColor = strongColor;
    
    // 2. 六个产品小标题：固定 #555（已在CSS中定义，不变）
    
    // 3. 数值文字：使用深色（主色）
    const subtitleValues = document.querySelectorAll('.subtitle-value');
    subtitleValues.forEach(el => {
        el.style.color = strongColor;
    });
    
    // 4. 产品卖点五条白卡：浅色底（副色，调淡）+ 深色字（主色）
    const sellingPointItems = document.querySelectorAll('.selling-point-item');
    sellingPointItems.forEach(el => {
        el.style.backgroundColor = lightenedSoftColor;
    });
    const sellingPointTexts = document.querySelectorAll('.selling-point-item p');
    sellingPointTexts.forEach(el => {
        el.style.color = strongColor;
    });
    
    // 5. 三个标签：深色背景（主色）+ 白字
    const headers = document.querySelectorAll('.selling-points-header, .summary-header, .terms-header');
    headers.forEach(el => {
        el.style.backgroundColor = strongColor;
    });
    
    // 6. 浅色背景区域（副标题下方的整个区域）：使用调淡后的副色
    if (lightBackgroundSection) {
        lightBackgroundSection.style.backgroundColor = lightenedSoftColor;
    }
    
    // 7. 名片区域颜色应用
    updateCardColors(strongColor);
    
    // 8. 思维导图节点颜色应用
    updateMindmapColors(strongColor, lightenedSoftColor);
    
    // 注意：卡片区域（selling-points-section, summary-section, terms-section, card-section）保持白色，不随背景改变
    // 注意：产卖点签的序号颜色永远保持不变（已在HTML中定义）
}

/**
 * 更新名片区域的颜色
 * @param {string} strongColor - 深色（主色）
 */
function updateCardColors(strongColor) {
    // 头像区域：使用深色（主色）
    if (cardAvatar) {
        cardAvatar.style.backgroundColor = strongColor;
    }
    
    // 文字和图标颜色：使用深色（主色）
    const cardName = document.querySelector('.card-name');
    const cardRole = document.querySelector('.card-role');
    const cardPhone = document.querySelector('.card-phone');
    const cardIcons = document.querySelectorAll('.card-icon');
    
    if (cardName) cardName.style.color = strongColor;
    if (cardRole) cardRole.style.color = strongColor;
    if (cardPhone) cardPhone.style.color = strongColor;
    cardIcons.forEach(icon => {
        icon.style.color = strongColor;
    });
}

/**
 * 生成占位二维码
 */
function generatePlaceholderQRCode() {
    if (!qrcodeCanvas) return;
    
    const ctx = qrcodeCanvas.getContext('2d');
    const size = 50;
    const moduleSize = 5; // 每个模块5x5像素，共10x10模块
    
    // 清空画布
    ctx.clearRect(0, 0, size, size);
    
    // 填充白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // 生成随机二维码图案（无意义的占位图）
    ctx.fillStyle = '#000000';
    
    // 绘制定位标记（左上、右上、左下）
    function drawFinderPattern(x, y) {
        // 外框 7x7
        ctx.fillRect(x, y, 7, 7);
        // 内框 5x5 白色
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 1, y + 1, 5, 5);
        // 中心点 3x3 黑色
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2, y + 2, 3, 3);
    }
    
    // 绘制三个定位标记
    drawFinderPattern(0, 0);
    drawFinderPattern(size - 7, 0);
    drawFinderPattern(0, size - 7);
    
    // 随机填充其他模块（模拟二维码数据区域）
    ctx.fillStyle = '#000000';
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            // 跳过定位标记区域
            if ((x < 2 && y < 2) || 
                (x > 7 && y < 2) || 
                (x < 2 && y > 7)) {
                continue;
            }
            // 随机填充（50%概率）
            if (Math.random() > 0.5) {
                ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
            }
        }
    }
}

/**
 * 更新思维导图的颜色
 * @param {string} strongColor - 深色（主色）
 * @param {string} lightenedSoftColor - 调淡后的浅色（副色）
 */
function updateMindmapColors(strongColor, lightenedSoftColor) {
    // 将十六进制颜色转换为RGB，用于rgba
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };
    
    const strongRgb = hexToRgb(strongColor);
    const softRgb = hexToRgb(lightenedSoftColor);
    
    // 中心节点：深色背景 + 白色文字
    const mainNode = document.getElementById('mindmapMainNode');
    if (mainNode) {
        mainNode.style.backgroundColor = strongColor;
    }
    
    // 子节点（责任名称）：浅色背景 + 深色文字
    const subNodes = document.querySelectorAll('.mindmap-sub-node');
    subNodes.forEach(node => {
        if (softRgb) {
            node.style.backgroundColor = lightenedSoftColor; // 使用调淡后的浅色
        }
        node.style.color = strongColor;
    });
    
    // 详情节点和叶子节点：根据节点类型应用样式
    const detailNodes = document.querySelectorAll('.mindmap-detail-node, .mindmap-leaf-node');
    detailNodes.forEach(node => {
        const nodeId = node.id || '';
        // 副标题节点：浅色背景 + 深色边框 + 深色文字
        if (nodeId.includes('DetailNode7') || nodeId.includes('DetailNode8') || nodeId.includes('DetailNode9')) {
            if (softRgb) {
                node.style.backgroundColor = lightenedSoftColor;
                node.style.borderColor = strongColor;
            }
            node.style.color = strongColor;
        }
        // 给付时间间隔节点：白色背景 + 深色边框 + 深色文字
        else if (nodeId.includes('DetailNode5') || nodeId.includes('DetailNode13') || nodeId.includes('DetailNode18')) {
            node.style.backgroundColor = '#FFFFFF';
            node.style.borderColor = strongColor;
            node.style.color = strongColor;
        }
        // 其他详情节点：透明背景 + 浅色边框 + 深色文字
        else {
            node.style.backgroundColor = 'transparent';
            if (softRgb) {
                node.style.borderColor = lightenedSoftColor;
            }
            node.style.color = strongColor;
        }
    });
    
    // 连接线：深色
    const style = document.createElement('style');
    style.id = 'mindmap-dynamic-styles';
    
    // 移除旧的动态样式
    const oldStyle = document.getElementById('mindmap-dynamic-styles');
    if (oldStyle) {
        oldStyle.remove();
    }
    
    style.textContent = `
        .mindmap-branch::before {
            background-color: ${strongColor} !important;
        }
        .mindmap-horizontal-branch::before {
            background-color: ${strongColor} !important;
        }
        .mindmap-vertical-details::before {
            background-color: ${strongColor} !important;
        }
        .mindmap-vertical-details > .mindmap-node::before {
            background-color: ${strongColor} !important;
        }
        .mindmap-vertical-branches::before {
            background-color: ${strongColor} !important;
        }
        .mindmap-subtitle-branch::before {
            background-color: ${strongColor} !important;
        }
        .mindmap-horizontal-details::before,
        .mindmap-horizontal-details::after {
            background-color: ${strongColor} !important;
        }
        .mindmap-horizontal-details > .mindmap-node::before {
            background-color: ${strongColor} !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * 生成并显示莫兰迪色系颜色列表
 */
function generateMorandiColorsList() {
    const morandiColorsList = document.getElementById('morandiColorsList');
    if (!morandiColorsList) return;
    
    // 莫兰迪色系颜色调色板（每种色系两种：浓色和淡色）
    const morandiPalette = [
        // 红色系
        '#C49A9A', // 浓红莫兰迪
        '#E8D4D4', // 淡红莫兰迪
        // 橙色系
        '#C4A89A', // 浓橙莫兰迪
        '#E8D9C8', // 淡橙莫兰迪
        // 黄色系
        '#C4B59A', // 浓黄莫兰迪
        '#E8DCC4', // 淡黄莫兰迪
        // 绿色系
        '#A8B59A', // 浓绿莫兰迪
        '#D4E0C8', // 淡绿莫兰迪
        // 蓝色系
        '#9AA8C4', // 浓蓝莫兰迪
        '#C8D4E8', // 淡蓝莫兰迪
        // 紫色系
        '#B59AC4', // 浓紫莫兰迪
        '#D9C8E8', // 淡紫莫兰迪
        // 粉色系
        '#C4A8B5', // 浓粉莫兰迪
        '#E8D4E0', // 淡粉莫兰迪
        // 灰色系
        '#8B8B8B', // 浓灰莫兰迪
        '#C4C4C4', // 淡灰莫兰迪
        // 棕色系
        '#A89A8B', // 浓棕莫兰迪
        '#D4C8B8', // 淡棕莫兰迪
        // 米色系
        '#B5A89A', // 浓米莫兰迪
        '#E0D4C8', // 淡米莫兰迪
    ];
    
    // 清空现有内容
    morandiColorsList.innerHTML = '';
    
    // 生成颜色项
    morandiPalette.forEach(hex => {
        const colorItem = document.createElement('div');
        colorItem.className = 'morandi-color-item';
        colorItem.style.backgroundColor = hex;
        
        // 计算颜色亮度，决定文字颜色
        const rgb = hexToRgb(hex);
        if (rgb) {
            // 使用相对亮度公式：0.299*R + 0.587*G + 0.114*B
            const brightness = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            const textColor = brightness > 0.5 ? '#333333' : '#FFFFFF';
            
            const colorHex = document.createElement('span');
            colorHex.className = 'color-hex';
            colorHex.textContent = hex.toUpperCase();
            colorHex.style.color = textColor;
            if (brightness <= 0.5) {
                colorHex.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
            } else {
                colorHex.style.textShadow = '0 1px 2px rgba(255, 255, 255, 0.5)';
            }
            
            colorItem.appendChild(colorHex);
            morandiColorsList.appendChild(colorItem);
        }
    });
}

/**
 * 切换到iPhone样机模式
 */
function switchToIphoneMode() {
    // 显示样机，隐藏H5长图
    if (phoneMockup) phoneMockup.style.display = 'block';
    if (h5LongImageContainer) h5LongImageContainer.style.display = 'none';
    
    // 更新按钮状态
    if (iphoneBtn) iphoneBtn.classList.add('active');
    if (h5Btn) h5Btn.classList.remove('active');
}

/**
 * 切换到H5长图模式
 */
function switchToH5Mode() {
    // 隐藏样机，显示H5长图
    if (phoneMockup) phoneMockup.style.display = 'none';
    if (h5LongImageContainer) h5LongImageContainer.style.display = 'block';
    
    // 更新按钮状态
    if (iphoneBtn) iphoneBtn.classList.remove('active');
    if (h5Btn) h5Btn.classList.add('active');
    
    // 复制长图内容（排除状态栏、导航栏和底部按钮）
    if (phoneScreen && h5LongImageContent) {
        const longImage = phoneScreen.querySelector('.long-image');
        if (longImage) {
            // 克隆整个long-image元素（包括主题图片区域）
            const clonedLongImage = longImage.cloneNode(true);
            // 清空并重新设置内容
            h5LongImageContent.innerHTML = '';
            h5LongImageContent.appendChild(clonedLongImage);
        }
    }
}

// 绑定切换按钮事件
if (iphoneBtn) {
    iphoneBtn.addEventListener('click', switchToIphoneMode);
}

if (h5Btn) {
    h5Btn.addEventListener('click', switchToH5Mode);
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 生成占位二维码
    generatePlaceholderQRCode();
    
    // 生成莫兰迪色系颜色列表
    generateMorandiColorsList();
    
    // 初始化默认颜色
    updateColors(currentStrongColor, currentSoftColor);
    
    // 默认显示iPhone模式
    switchToIphoneMode();
});

