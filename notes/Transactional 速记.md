---
title: Transactional 速记
category: spring
clip: true
---

`@Transactional` 是 Spring 声明式事务注解：标在类/方法上，由 AOP 代理拦截，经 PlatformTransactionManager 自动开启、提交、回滚事务。

## 标注位置

类上：该类所有 public 方法默认带事务；方法上：覆盖类级配置。

## 工作原理

代理 Bean → `TransactionInterceptor` 拦截 → 读 `@Transactional` 事务属性 → `PlatformTransactionManager` 开/加入事务 → 执行业务 → 正常提交，异常按回滚规则回滚。

## 回滚规则

- `RuntimeException` / `Error`：回滚。
- Checked Exception：不回滚。
- 想全回滚：`@Transactional(rollbackFor = Exception.class)`。

## 最佳实践

- 放 Service 层、方法 public；查询 `readOnly = true`。
- 事务尽量小，避远程调用 / 消息 / 长 IO；避同类自调用（绕开代理、增强失效，详见 [[Spring AOP]]）。
- 多数据源指定 `transactionManager`；`REQUIRES_NEW` 新开事务占额外连接，留意连接池与死锁。
