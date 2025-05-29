// 为Gradient.js创建类型声明
export class Gradient {
    constructor(...args: any[]);
    initGradient(canvasSelector: string): void;
    connect(): Promise<void>;
    disconnect(): void;
    initMaterial(): void;
    initMesh(): void;
    shouldSkipFrame(timestamp: number): boolean;
    updateFrequency(frequency: number): void;
    toggleColor(index: number): void;
    showGradientLegend(): void;
    hideGradientLegend(): void;
    init(): void;
    waitForCssVars(): Promise<any>;
    initGradientColors(): void;
} 