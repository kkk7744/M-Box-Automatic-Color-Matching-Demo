# 颜色处理文档

## 概述

本文档详细说明自动配色网站中的颜色处理流程、算法实现和配色规则。系统从用户上传的图片中提取颜色，应用莫兰迪色调映射，并根据预设规则将颜色应用到长图的各个元素。

## 颜色提取流程

### 1. 图片预处理

#### 1.1 Canvas绘制
```javascript
// 创建Canvas元素
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// 设置Canvas尺寸（性能优化：缩小图片）
const maxSize = 200;
const scale = Math.min(maxSize / img.width, maxSize / img.height);
canvas.width = img.width * scale;
canvas.height = img.height * scale;

// 绘制图片到Canvas
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
```

**说明**：
- 为了性能考虑，将图片缩放到最大200px
- 保持原始宽高比
- 使用Canvas API读取像素数据

#### 1.2 像素数据提取
```javascript
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const pixels = imageData.data;
```

**数据结构**：
- `imageData.data` 是一个Uint8ClampedArray
- 每4个元素代表一个像素：`[R, G, B, A]`
- 数组长度 = width × height × 4

### 2. 颜色量化与统计

#### 2.1 RGB转HSL
对每个像素进行颜色空间转换：

```javascript
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
        h: Math.round(h * 360),  // 色相：0-360
        s: Math.round(s * 100),  // 饱和度：0-100
        l: Math.round(l * 100)   // 明度：0-100
    };
}
```

**HSL颜色空间优势**：
- **H (Hue/色相)**：颜色的种类（红、绿、蓝等）
- **S (Saturation/饱和度)**：颜色的纯度（0=灰色，100=纯色）
- **L (Lightness/明度)**：颜色的亮度（0=黑色，100=白色）

HSL更适合进行颜色分析和调整，因为可以独立调整饱和度和明度。

#### 2.2 颜色量化
为了减少颜色数量，对HSL值进行量化：

```javascript
// 量化参数
const quantizedH = Math.floor(hsl.h / 10) * 10;  // 色相：每10度一组
const quantizedS = Math.floor(hsl.s / 20) * 20;  // 饱和度：每20%一组
const quantizedL = Math.floor(hsl.l / 20) * 20;  // 明度：每20%一组

const key = `${quantizedH},${quantizedS},${quantizedL}`;
```

**量化目的**：
- 将相似的颜色归类到一起
- 减少需要统计的颜色数量
- 提高计算效率

#### 2.3 颜色统计
使用Map数据结构统计每种量化颜色的出现次数：

```javascript
const colorMap = new Map();
const totalPixels = canvas.width * canvas.height;

for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    
    // 跳过透明或接近透明的像素
    if (a < 128) continue;
    
    // 转换为HSL并量化
    const hsl = rgbToHsl(r, g, b);
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
```

**统计结果**：
- 每种颜色记录RGB、HSL值和出现次数
- 计算占比：`ratio = count / totalPixels`

### 3. 颜色选择

#### 3.1 按占比排序
```javascript
const colors = Array.from(colorMap.values()).map(color => ({
    ...color,
    ratio: color.count / totalPixels
}));

colors.sort((a, b) => b.ratio - a.ratio);
```

**说明**：
- 按占比从高到低排序
- 占比高的颜色通常是图片的主要颜色

#### 3.2 提取两种主要颜色
```javascript
const color1 = colors[0] || defaultColor1;
let color2 = colors[1];

// 如果没有第二种颜色，创建对比色
if (!color2) {
    const hsl1 = rgbToHsl(color1.r, color1.g, color1.b);
    const rgb2 = hslToRgb(
        (hsl1.h + 180) % 360,  // 色相+180度（互补色）
        hsl1.s,
        Math.min(hsl1.l + 40, 85)
    );
    color2 = { r: rgb2.r, g: rgb2.g, b: rgb2.b, ... };
}
```

**策略**：
- 优先选择占比最高的两种颜色
- 如果只有一种颜色，创建互补色作为第二种颜色

### 4. 颜色分类（深色/浅色）

#### 4.1 视觉重量计算
```javascript
// 视觉重量得分公式
const score = (S / 100) * 0.6 + ((100 - L) / 100) * 0.4;
```

**公式说明**：
- **饱和度权重**：60% - 饱和度越高，颜色越鲜艳，视觉重量越大
- **明度权重**：40% - 明度越低，颜色越深，视觉重量越大
- 得分范围：0-1

**为什么这样设计**：
- 饱和度高的颜色更容易吸引注意力
- 深色通常比浅色更有视觉重量
- 综合两个因素，更准确地判断颜色的视觉重要性

#### 4.2 初步分类
```javascript
const score1 = (color1.s / 100) * 0.6 + ((100 - color1.l) / 100) * 0.4;
const score2 = (color2.s / 100) * 0.6 + ((100 - color2.l) / 100) * 0.4;

let candidateStrong = score1 > score2 ? color1 : color2;
let candidateSoft = score1 > score2 ? color2 : color1;
```

**分类规则**：
- 得分高的 → candidateStrong（候选深色）
- 得分低的 → candidateSoft（候选浅色）

#### 4.3 明度验证与调整
确保深色和浅色符合明度要求：

```javascript
let finalStrong, finalSoft;

if (candidateStrong.l >= 50) {
    // strong应该是深色，但当前是浅色
    if (candidateSoft.l < 50) {
        // 如果soft是深色，交换它们
        finalStrong = candidateSoft;
        finalSoft = candidateStrong;
    } else {
        // 两个都是浅色，将strong调整为深色
        const hsl = rgbToHsl(candidateStrong.r, candidateStrong.g, candidateStrong.b);
        const rgb = hslToRgb(hsl.h, hsl.s, Math.min(hsl.l, 45));
        finalStrong = { r: rgb.r, g: rgb.g, b: rgb.b, ... };
        finalSoft = candidateSoft;
    }
} else {
    // strong是深色，检查soft
    if (candidateSoft.l < 50) {
        // soft也是深色，需要调整为浅色
        const hsl = rgbToHsl(candidateSoft.r, candidateSoft.g, candidateSoft.b);
        const rgb = hslToRgb(hsl.h, hsl.s, Math.max(hsl.l, 55));
        finalSoft = { r: rgb.r, g: rgb.g, b: rgb.b, ... };
    } else {
        finalSoft = candidateSoft;
    }
    finalStrong = candidateStrong;
}
```

**调整规则**：
- **深色（strong）**：明度必须 < 50，如果不符合则调整到 ≤ 45
- **浅色（soft）**：明度必须 ≥ 50，如果不符合则调整到 ≥ 55
- 保持色相和饱和度不变，只调整明度

## 莫兰迪色调映射

### 1. 莫兰迪色调特点

莫兰迪色调（Morandi Color）是意大利画家乔治·莫兰迪（Giorgio Morandi）作品中的色彩风格，特点：
- **低饱和度**：颜色柔和，不刺眼
- **高级感**：优雅、内敛、有质感
- **和谐统一**：颜色之间搭配和谐

### 2. 映射算法

```javascript
function applyMorandiMapping(color) {
    const hsl = rgbToHsl(color.r, color.g, color.b);
    
    // 1. 保持色相不变
    let morandiH = hsl.h;
    
    // 2. 降低饱和度到15-35%
    let morandiS = Math.max(Math.min(hsl.s * 0.5, 35), 15);
    
    // 3. 调整明度范围
    let morandiL;
    if (hsl.l < 50) {
        // 深色：保持在30-50之间
        morandiL = Math.max(Math.min(hsl.l, 50), 30);
    } else {
        // 浅色：保持在50-75之间
        morandiL = Math.max(Math.min(hsl.l, 75), 50);
    }
    
    return hslToRgb(morandiH, morandiS, morandiL);
}
```

### 3. 映射规则详解

#### 3.1 色相（H）
- **保持不变**：保留原始颜色的色相
- **原因**：色相决定颜色的种类，改变色相会改变颜色的本质

#### 3.2 饱和度（S）
- **降低到15-35%**：`morandiS = Math.max(Math.min(hsl.s * 0.5, 35), 15)`
- **计算方式**：原始饱和度 × 0.5，然后限制在15-35%之间
- **原因**：低饱和度是莫兰迪色调的核心特征，使颜色更柔和

#### 3.3 明度（L）
- **深色（L < 50）**：保持在30-50之间
  - 确保不会太深（≥30）也不会太浅（≤50）
- **浅色（L ≥ 50）**：保持在50-75之间
  - 确保不会太浅（≤75）也不会太深（≥50）
- **原因**：保持颜色的深浅层次，同时确保可读性

### 4. 映射后验证

```javascript
const morandiStrong = applyMorandiMapping(finalStrong);
const morandiSoft = applyMorandiMapping(finalSoft);

// 验证映射后的明度
const strongHsl = rgbToHsl(morandiStrong.r, morandiStrong.g, morandiStrong.b);
const softHsl = rgbToHsl(morandiSoft.r, morandiSoft.g, morandiSoft.b);

// 如果映射后不符合要求，强制调整
if (strongHsl.l >= 50) {
    finalStrongRgb = hslToRgb(strongHsl.h, strongHsl.s, Math.min(strongHsl.l, 45));
}
if (softHsl.l < 50) {
    finalSoftRgb = hslToRgb(softHsl.h, softHsl.s, Math.max(softHsl.l, 55));
}
```

**验证目的**：
- 确保映射后深色仍然是深色
- 确保映射后浅色仍然是浅色
- 如果不符合，进行强制调整

## 颜色调淡

### 1. 调淡算法

```javascript
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
```

### 2. 使用场景

- **浅色背景区域**：将浅色（soft）调淡15%用于背景
- **产品卖点卡片背景**：使用调淡后的浅色，使背景更柔和

### 3. 调淡参数

- **默认调淡量**：20%
- **最大明度限制**：95%（避免过亮导致可读性下降）

## 配色规则应用

### 1. 固定颜色（永远不变）

这些颜色不会随提取的颜色变化，保持设计的一致性：

| 元素 | 颜色值 | 说明 |
|------|--------|------|
| 产品卖点序号1 | #FA3F3F | 红色 |
| 产品卖点序号2 | #FF8F0A | 橙色 |
| 产品卖点序号3 | #EFDD13 | 黄色 |
| 产品卖点序号4 | #9EDC23 | 绿色 |
| 产品卖点序号5 | #535ED9 | 蓝色 |
| 六个产品小标题 | #555555 | 深灰色 |
| 卡片区域背景 | #FFFFFF | 白色 |
| 标题框文字 | #FFFFFF | 白色 |
| 标签文字 | #FFFFFF | 白色 |

### 2. 动态颜色（根据提取的颜色变化）

#### 2.1 深色（Strong/主色）应用

| 元素 | 应用方式 | 说明 |
|------|----------|------|
| 标题框背景 | `backgroundColor = strongColor` | 深色背景 |
| 数值文字 | `color = strongColor` | 深色文字 |
| 产品卖点文字 | `color = strongColor` | 深色文字 |
| 三个标签背景 | `backgroundColor = strongColor` | 深色背景（产卖点签、责任摘要、疾病条款） |
| 名片头像 | `backgroundColor = strongColor` | 深色背景 |
| 名片文字 | `color = strongColor` | 深色文字 |
| 名片图标 | `color = strongColor` | 深色图标 |
| 思维导图主节点 | `backgroundColor = strongColor` | 深色背景 |
| 思维导图连接线 | `borderColor = strongColor` | 深色线条 |

#### 2.2 浅色（Soft/副色）应用

| 元素 | 应用方式 | 说明 |
|------|----------|------|
| 产品卖点卡片背景 | `backgroundColor = lightenColor(softColor, 15)` | 调淡15%的浅色 |
| 思维导图子节点背景 | `backgroundColor = lightenColor(softColor, 15)` | 调淡15%的浅色 |
| 浅色背景区域 | `backgroundColor = lightenColor(softColor, 15)` | 调淡15%的浅色（整个副标题下方区域） |

### 3. 颜色应用代码示例

```javascript
function updateColors(strongColor, softColor) {
    // 调淡浅色用于背景
    const lightenedSoftColor = lightenColor(softColor, 15);
    
    // 1. 标题框：深色背景
    titleBox.style.backgroundColor = strongColor;
    
    // 2. 数值文字：深色
    subtitleValues.forEach(el => {
        el.style.color = strongColor;
    });
    
    // 3. 产品卖点卡片：浅色背景 + 深色文字
    sellingPointItems.forEach(el => {
        el.style.backgroundColor = lightenedSoftColor;
    });
    sellingPointTexts.forEach(el => {
        el.style.color = strongColor;
    });
    
    // 4. 标签：深色背景
    headers.forEach(el => {
        el.style.backgroundColor = strongColor;
    });
    
    // 5. 浅色背景区域
    lightBackgroundSection.style.backgroundColor = lightenedSoftColor;
    
    // 6. 名片区域
    updateCardColors(strongColor);
    
    // 7. 思维导图
    updateMindmapColors(strongColor, lightenedSoftColor);
}
```

## 颜色空间转换

### 1. RGB ↔ HSL 转换

#### RGB转HSL
```javascript
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
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
```

#### HSL转RGB
```javascript
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
```

### 2. RGB ↔ 十六进制转换

#### RGB转十六进制
```javascript
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}
```

#### 十六进制转RGB
```javascript
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
```

## 颜色处理流程图

```
上传图片
    ↓
Canvas绘制（缩放至200px）
    ↓
提取像素数据（RGB）
    ↓
转换为HSL颜色空间
    ↓
颜色量化（减少颜色数量）
    ↓
统计颜色占比
    ↓
按占比排序
    ↓
提取占比最高的两种颜色
    ↓
计算视觉重量得分
    ↓
分类为深色/浅色
    ↓
明度验证与调整
    ↓
应用莫兰迪色调映射
    ↓
映射后验证
    ↓
转换为十六进制
    ↓
应用到长图元素
```

## 性能优化

### 1. 图片缩放
- 将图片缩放到最大200px，减少需要处理的像素数量
- 保持宽高比，不影响颜色提取的准确性

### 2. 颜色量化
- 对HSL值进行量化，将相似颜色归类
- 减少需要统计的颜色数量，提高计算效率

### 3. 跳过透明像素
- 检查alpha通道，跳过透明或接近透明的像素
- 减少不必要的计算

## 注意事项

1. **颜色提取准确性**：
   - 建议上传色彩丰富、对比度适中的图片
   - 单色或过于单调的图片可能提取效果不佳

2. **明度调整**：
   - 系统会自动调整颜色明度，确保深色和浅色的对比度
   - 可能会改变原始颜色的明度

3. **莫兰迪映射**：
   - 所有提取的颜色都会应用莫兰迪色调映射
   - 可能会降低颜色的饱和度

4. **固定颜色**：
   - 某些颜色区域（如产品卖点序号）不会随提取的颜色变化
   - 这是设计上的要求，保持一致性

5. **跨域限制**：
   - 如果图片来自其他域名，可能会遇到Canvas跨域限制
   - 建议使用本地图片或已配置CORS的图片

## 算法复杂度

- **时间复杂度**：O(n)，其中n是图片的像素数量
- **空间复杂度**：O(m)，其中m是量化后的颜色种类数量

由于进行了图片缩放和颜色量化，实际处理的像素数量和颜色种类都大大减少，保证了良好的性能。

