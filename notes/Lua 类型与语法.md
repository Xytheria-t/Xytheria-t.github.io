---
title: Lua 类型与语法
category: redis
---

# Lua 类型与语法

## 思维链路速查

```chain
类型与真值 | 8 个类型与两个假值 | 基础
table 与循环 | 唯一容器的建与遍历 | 核心
函数与作用域 | 多返回值与 local | 核心
落地：逐行读第一个脚本 | 对照 Java 读 | 实战
复盘 | 面试问答与误区 | 收尾
```

这篇只取读写 [[Redis Lua 脚本]] 够用的语言子集，每一处都拿 Java 对照；真正反直觉、会咬人的只有两处 —— 真值规则（0 也是「真」）和下标从 1 开始。

## 类型与真值

| 类型 | 例 | Java 对照 | 脚本里常见度 |
|---|---|---|---|
| nil | 未赋值 / 字段不存在 | null | 高 |
| boolean | true / false | Boolean | 高 |
| number | 3、0.5 | double（只有这一种数字类型，没有整数） | 高 |
| string | 'k1' 或 "k1"（单双引号等价，不可变） | String | 高 |
| table | {} —— 唯一容器 | ArrayList 与 HashMap 的合体 | 高 |
| function | 一等公民，可存进变量、当参数传 | 方法引用 / Lambda | 中 |
| thread / userdata | 协程 / 宿主 C 数据 | —— | Redis 脚本碰不到 |

变量是动态类型：变量本身没有类型，值才有类型，同一个 local x 可以先后装数字和字符串。

> [!danger] 真值规则：只有 nil 和 false 为假
> 0 与 "" 都是真值，Java 的 if(x) 与 JS 的隐式转换直觉在这里全部失效。判断「命令返回 0」必须写 == 0 —— not 0 恒为 false（因为 0 是真值）。

## 运算符：与 Java 对照

| Lua | Java | 备注 |
|---|---|---|
| == / ~= | == / != | ~= 是不等于；string 的 == 按内容比（Java 的 == 是引用比较） |
| .. | +（字符串拼接） | 两侧自动转字符串："剩余 " .. n |
| # | .length / .size() | #arr、#s 取长度 |
| and / or / not | && / \|\| / ! | 同样短路；惯用法 x = v or 0（v 为 nil/false 时取 0） |
| （没有） | ++、+=、?: | 只能 n = n + 1 |

## table 与两种循环

table 是 Lua 唯一的容器，数组与哈希二合一：

```lua
local arr = {10, 20, 30}    -- 数组用法：下标从 1 开始
local cfg = {timeout = 5}   -- 哈希用法：cfg.timeout 或 cfg["timeout"]
arr[1]                      -- 10（不是 0！）
```

遍历有两套 for，选错会踩坑：

| | ipairs(t) | pairs(t) |
|---|---|---|
| 遍历范围 | 下标 1..n 的连续段 | 全部键值对 |
| 顺序 | 保证升序 | 不保证（哈希序） |
| 遇到 nil | 立即停止 | 该键不存在，自然跳过 |
| 典型用途 | 遍历 KEYS / ARGV | 遍历配置类 table |

数字 for 是闭区间，两端都含：

```lua
for i = 1, 10 do end    -- i = 1..10，等价 Java 的 for(int i = 1; i <= 10; i++)
```

> [!note] 没有 continue
> 想跳过某轮只能用 if 包住循环体。另外 #arr 只对无洞的连续序列可靠：中间塞过 nil 的表，# 计数会被洞截断。

## 函数与作用域

**所有变量、函数一律 local。** 默认作用域是全局，而 Redis 的脚本沙箱禁止创建全局变量（报 `Script attempted to create global variable`），忘写 local 直接炸：

```lua
local function divmod(a, b)          -- local function 声明
    return math.floor(a / b), a % b
end

local q, r = divmod(7, 2)            -- 多返回值：q=3, r=1
```

多返回值是 Java 没有的能力：接不住的丢弃、不够的补 nil；Redis 脚本的惯例是 `return ok, err`（成功标志 + 错误信息）。

常用标准库够用就行：

| 函数 | 作用 | 备注 |
|---|---|---|
| tonumber(s) | 字符串 → 数字 | 失败返回 nil 而不报错（Java 的 parseInt 抛异常） |
| tostring(v) | 任意值 → 字符串 | |
| string.sub(s, i, j) | 截取 | 下标 1 起、含两端 |
| string.format(fmt, ...) | 格式化 | 类似 String.format |

> [!note] 元表（metatable）
> Lua 的「类 / 继承 / 运算符重载」全靠 table + 元表模拟。写 Redis 脚本用不到，知道这个名字即可。

## 落地：逐行读第一个脚本

脚本由 Redis 执行，KEYS 是它注入的键名数组（下标从 1 起，机制见 [[Redis Lua 脚本]]）。下面这段统计「传入的键里有几个真实存在」：

```lua
local n = 0                              -- 计数器：必须 local，否则沙箱报错
for _, k in ipairs(KEYS) do              -- _ 是惯例占位名：表示「这个下标我不用」
    if redis.call('exists', k) == 1 then -- exists 返回 1/0；必须 == 1，0 是真值不能靠真值判断
        n = n + 1                        -- 没有 ++，只能写全
    end
end
return n                                 -- number 自动转成 Redis 整数回复
```

<details>
<summary>面试问答 (3题)</summary>

Q：Redis 为什么选 Lua 内嵌？

A：解释器小、C 实现易嵌入沙箱、解释执行无编译开销，同步语义契合 Redis 单线程原子执行的模型。官方内嵌 Lua 5.1，用 redis.call 把命令桥接进脚本。

Q：Lua 与 Java 类型系统最大的差异？

A：动态类型（变量无类型、值有类型）；number 只有 double 一种；真值规则只有 nil 和 false 为假，0 与 "" 都真。

Q：Lua 怎么实现面向对象？

A：table + 元表（metatable）模拟类、继承与运算符重载；写 Redis 脚本用不到，知道即可。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：not redis.call('exists', k) 判断「不存在」。0 是真值，not 0 恒为 false；必须写 == 0。
- 误区：数组下标从 0 开始。Lua 从 1 起，KEYS[1] 才是第一个键。
- 误区：pairs 按插入顺序遍历。顺序无保证，要顺序用 ipairs（且遇 nil 即停）。
- 误区：变量不写 local。Redis 沙箱禁止创建全局变量，直接报错；所有声明一律 local。

</details>
