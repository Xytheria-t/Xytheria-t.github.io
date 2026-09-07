---
title: Java 泛型
category: javase
aliases: [泛型, 泛型擦除, generics]
---

# Java 泛型

## 思维链路速查

```chain
为什么需要泛型 | 检查前移到编译期 | 动机
泛型语法速查 | 类/方法/边界 | 速查
类型擦除 | 运行时的真相 | 核心
通配符与 PECS | 读写方向 | 难点
面试问答 | 高频考点 | 复盘
```

泛型的全部内容围绕一次「搬家」：类型检查从运行时搬到编译期。搬家靠**擦除**实现——编译完类型参数就没了，只剩 Object 与编译器自动插入的强转；立住这条真相，通配符的读写方向（PECS）就是推论而不是口诀。

## 为什么需要泛型

泛型 = 类型参数化：把「容器/方法操作什么类型」写成参数 `<T>` 交给编译器，编译期完成检查，使用处免去强制转换。

| 无泛型写法 | 泛型写法 |
|---|---|
| `List list = new ArrayList();` `list.add("hi"); list.add(42);` | `List<String> list = new ArrayList<>();` `list.add(42);` → 编译报错 |
| 取值必须手动强转：`(String) list.get(0)` | 取出来直接就是 `String` |
| 装错类型运行时才炸 `ClassCastException` | 错误拦在编译期 |

> [!note] 类型参数只能是引用类型
> `List<int>` 编译不过——擦除后类型参数要替换成 Object，而 int 不是 Object 的子类。基本类型一律走包装类，装箱时机见 [[基本数据类型]]。

> [!tip] 泛型最大的用户是集合
> `List` / `Map` / `Set` 的元素类型声明全靠泛型兜底，接口形状见 [[Java Collection]]。

## 泛型语法速查

| 形态 | 写法 | 说明 |
|---|---|---|
| 泛型类 | `class Box<T> { T value; }` | T 随对象确定 |
| 泛型接口 | `interface Comparable<T>` | 实现类指定 T |
| 泛型方法 | `<T> T first(List<T> list)` | `<T>` 写在返回类型前，T 由实参推断 |
| 多类型参数 | `class Pair<K, V>` | 逗号分隔，各自独立 |
| 类型边界 | `<T extends Comparable<T>> T max(List<T> list)` | T 限定为 Comparable 的子类 |
| 原始类型 | `List list = new ArrayList()` | 裸类型：绕过全部泛型检查的旧写法，编译器发 unchecked（未检查）警告 |

| 字母 | 含义 | 典型位置 |
|---|---|---|
| T | Type，类型 | 通用占位 |
| E | Element，元素 | List、Set |
| K / V | Key / Value | Map |
| R | Return，返回值 | 方法返回类型 |
| ? | 未知类型 | 通配符，见下文 |

> [!warning] 边界只写 extends
> Java 没有 `<T implements X>` 写法；上界是类还是接口都写 `extends`，多个上界用 `&` 连接：`<T extends Comparable<T> & Serializable>`。

## 类型擦除

擦除 = 编译器生成字节码时把类型参数丢掉，换成上界（没写上界就是 Object），再在使用处自动插入强制转换。因此 `List<String>` 与 `List<Integer>` 在运行时是**同一个 Class**。

```java
// 你写的
List<String> list = new ArrayList<>();
list.add("hi");
String s = list.get(0);

// 编译后的等价形态
List list = new ArrayList();        // <String> 没了
list.add("hi");                     // 实际签名 add(Object)
String s = (String) list.get(0);    // 编译器自动插入的强转
```

擦除的推论（全部编译期拦截）：

| 写法 | 原因 |
|---|---|
| `new T()` 不行 | 运行时不知道 T 具体是谁 |
| `new T[10]`、`new List<String>[10]` 不行 | 数组靠运行时类型检查兜底，擦除后无类型可查 |
| `x instanceof List<String>` 不行 | 运行时只有 List |
| `T.class` 不行 | 类型参数不是运行时实体 |
| `class Box<T> { static T x; }` 编译错 | 擦除后 Box 只有一份字节码，静态字段却要随 T 各存一份 |
| `class MyEx<T> extends Exception` 编译错 | 擦除后 catch 泛型异常无法区分 |

> [!tip] 擦除是「半擦」：声明侧留了底
> 类、方法、字段**声明处**的泛型会写进字节码的 Signature 属性，反射 `getGenericSuperclass()` / `getGenericType()` 能读到；但运行中对象**实际装的是什么**拿不到。JSON 库的 `new TypeReference<List<User>>() {}` 正是钻这个空子——匿名子类把泛型写在了声明侧。

## 通配符与 PECS

PECS（Producer Extends, Consumer Super：生产者用 extends、消费者用 super）是通配符选型口诀，推导它之前先立住前提——**泛型是不变的**（invariant）：即使 String 是 Object 的子类，`List<String>` 与 `List<Object>` 之间也没有子类型关系。

```java
List<Object> objs = new ArrayList<String>();   // 编译错
```

| | 数组 | 泛型 |
|---|---|---|
| 子类型关系 | 协变：`String[]` 可赋给 `Object[]` | 不变：`List<String>` 与 `List<Object>` 无关 |
| 代价 | 错误推迟到运行时 `ArrayStoreException` | 想通用必须写通配符 |

| 写法 | 含义 | 写入 | 读取 |
|---|---|---|---|
| `? extends Number` | Number 或其某个子类（具体未知） | 禁止（null 除外） | 读出按 Number 用 |
| `? super Integer` | Integer 或其某个父类（具体未知） | 能放 Integer 及其子类 | 读出只能当 Object |
| `?` | 某个未知类型 | 禁止 | 读出只能当 Object |

```java
// extends：能读不能写
List<? extends Number> read = new ArrayList<Integer>(); // OK
Number n = read.get(0);      // OK：不管装谁，一定是 Number 的子类
// read.add(1);              // 编译错：万一实际是 List<Double> 呢

// super：能写不能读（读出来只能是 Object）
List<? super Integer> write = new ArrayList<Number>();  // OK
write.add(1);                // OK：Integer 放进 Number 的容器合法
// Integer i = write.get(0); // 编译错：里面可能是 Number、Object
```

> [!warning] 读写不对称的根源
> 通配符只约定「某个未知类型」：extends 视角下写入任何具体类都可能撞上实际类型，编译器干脆禁写；super 视角下写入 Integer 及其子类一定合法（子类可当父类用），读出时却只知道是 Object。

```branch
01: 选择通配符
02: 按数据流向分流
- 只读 | extends | 生产者 Producer
- 只写 | super | 消费者 Consumer
- 又读又写 | 精确类型 | 不用通配符
```

> [!tip] 标准库范例
> `Collections.copy(List<? super T> dest, List<? extends T> src)`：src 只出数据是生产者，dest 只收数据是消费者，一个签名把 PECS 用全。

## 落地：易错点代码

> [!note] 四组对照
> 不变 vs 数组协变、擦除四连、通配符读写、原始类型绕检查。

```java
// 1. 泛型不变 vs 数组协变：一个编译期拦下，一个运行时翻车
List<Object> a = new ArrayList<String>();   // 编译错
Object[] arr = new String[]{"x"};
arr[0] = 42;                                // ArrayStoreException

// 2. 擦除四连：编译期就拦下
// T obj = new T();                         // 编译错
// T[] xs = new T[10];                      // 编译错
// if (x instanceof List<String>) {}        // 编译错
// class Box<T> { static T x; }             // 编译错

// 3. 通配符读写规则
List<? extends Number> read = new ArrayList<Integer>();
Number n = read.get(0);                     // 只读 OK
List<? super Integer> write = new ArrayList<Number>();
write.add(1);                               // 只写 OK

// 4. 原始类型绕过检查：unchecked 警告的来源
List raw = new ArrayList<String>();         // unchecked 警告
raw.add(42);                                // 混入 Integer，无人拦
String s = (String) raw.get(0);             // ClassCastException，运行时才炸
```

<details>
<summary>面试问答 (6题)</summary>

Q：什么是类型擦除？为什么设计成擦除而不是保留泛型？

A：编译器把类型参数替换成上界（无上界则 Object），并在使用处自动插入强转。目的是二进制兼容：旧类库无需重新编译即可与泛型代码互操作，代价是运行时拿不到类型参数，`List<String>` 与 `List<Integer>` 是同一个 Class。

Q：泛型信息完全丢失了吗？JSON 库怎么拿到 `List<User>` 的类型？

A：没全丢。声明侧（类继承、方法签名、字段）的泛型写进字节码 Signature 属性，反射 `getGenericSuperclass()` 可读；`new TypeReference<List<User>>() {}` 用匿名子类把类型固定在声明侧，运行时即可取到。运行中对象的实际装的内容（instanceof、getClass 泛型参数）拿不到。

Q：PECS 是什么？举个例子。

A：Producer Extends, Consumer Super。只读的容器（生产者）用 `? extends T`，只写的容器（消费者）用 `? super T`；又读又写就用精确类型。如 `Collections.copy(List<? super T> dest, List<? extends T> src)`。

Q：为什么 `List<int>` 编译不过？

A：擦除后类型参数替换为 Object，只能装引用类型；基本类型须用包装类，伴随自动装箱开销。

Q：`List<String>` 和 `List<Integer>` 运行时是同一个类吗？

A：是。擦除后都是 List，`getClass()` 相同，静态成员共享。泛型的编译期检查是纯编译器行为，运行时无类型可查。

Q：桥方法是什么？

A：擦除导致实现与接口的签名不一致：实现 `Comparable<String>` 写的是 `compareTo(String)`，接口擦除后要求 `compareTo(Object)`。编译器自动生成一个 `compareTo(Object)` 桥方法转发到具体实现，多态才不中断。

</details>

<details>
<summary>常见误区 (5条)</summary>

- 误区：泛型是运行时机制，`x instanceof List<String>` 可行。实际擦除，运行时只有 List，泛型信息只在声明侧的 Signature 属性里。
- 误区：`List<Object>` 是 `List<String>` 的父类型，可以直接赋值。泛型不变，兼容关系必须靠通配符显式表达。
- 误区：`? extends` 既能读也能写。extends 禁写（null 除外）；super 读出来只能是 Object。
- 误区：`List`（原始类型）等价于 `List<Object>`。原始类型绕过全部泛型检查，只是兼容旧代码的裸写法，unchecked 警告就是在提醒这件事。
- 误区：泛型数组 `new List<String>[10]` 只是运行时危险。直接编译报错——数组的运行时类型检查与擦除后的伪类型冲突，放行会造成堆污染。

</details>
