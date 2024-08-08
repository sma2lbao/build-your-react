## useState

### 定义全局变量

增加 react/src/react-shared-internals-client.ts 文件；声明全局变量 ReactSharedInternals 并导出。

### 共享全局变量

增加 shared/react-shared-internals.ts 文件，默认引用和分享 react 包中 ReactSharedInternals 变量；

### useState 具体实现

hooks 的具体实现都在 react-reconciler 包，将实现好的函数赋值给全局变量 ReactSharedInternals；

#### 找到 FunctionComponent 相关逻辑

在 beginWork 中可以找到 renderWithHooks 函数；在该函数中实现将 hooks 具体实现赋值给全局对象 ReactSharedInternals 逻辑

#### mountState/updateState 实现

useState 根据 current 是否为 null，可分为渲染和更新两种实现。
