---
title: Elasticsearch
type: moc
category: es
aliases: [ES]
---

# Elasticsearch

ES 的两条代价线互为因果：倒排结构把「哪些文档含这个词」变成直接命中，换来检索速度；段不可变只能追加，换来写入吞吐。先看清倒排结构，再走一遍写入与查询链路，分片、翻页与 MySQL 分工才讲得通。

- [[倒排索引]]
