# playroom-visual-qa

## 标准流程

`Reconnaissance → Action → Screenshot/DOM → Action → Screenshot/DOM`。先等待真实 JS 状态，再定位真实 selector，禁止凭源码猜 UI。

## 必查

Desktop 1440、至少一个 390px 和 360px viewport；可见性、布局溢出、modal 是否适配、触控目标、文本对比度、
`console.error`、`pageerror`、未处理 rejection 和 failed request。

## 证据规则

浏览器连接器/真实设备不可用时，写 `NOT_EXECUTED`，同时保留可运行的替代自动化证据；不能把 DOM smoke 伪称真实浏览器视觉验收。
