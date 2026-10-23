# 研究依据与实现范围

2026-10-23 核查。本文件替换旧的未逐条核实文献清单，只保留本次设计实际参考的机制。以下工作来自不同理论与实验层次；把它们接入一个角色系统，是工程综合，不代表它们已经构成被统一验证的人脑模型。

| 原始研究 / 理论 | 参考内容 | 当前实现与限制 |
| --- | --- | --- |
| [Marsella & Gratch, 2009：EMA](https://people.ict.usc.edu/~gratch/CSCI534/Readings/COGSYS-RS-EMOTION-2008-6.pdf) | 目标相关评价、可控性与过程变化 | 结构化目标影响、责任归属、修复、行动预测；没有复刻完整 EMA 推理器。 |
| [Ryan & Deci, 2000：自我决定理论](https://www.selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf) | 自主、胜任与联结需要 | 三项作为目标基础；真诚承诺与探索是本项目额外设计，不冒称 SDT 的另两项标准需要。 |
| [Gross, 2015：情绪调节](https://doi.org/10.1080/1047840X.2014.940781) | 情绪生成与调节过程 | 区分外显克制与内部状态；澄清重评按参数缓解目标负荷。未实现完整调节阶段模型。 |
| [Kuppens 等, 2010：情绪惯性](https://pmc.ncbi.nlm.nih.gov/articles/PMC2901421/) | 情绪存在时间延续 | 快情绪和慢心境采用不同半衰期；15 分钟与 3 小时是工程默认，非论文拟合值。 |
| [Keramati & Gutkin, 2014：稳态强化学习](https://elifesciences.org/articles/04811) | 奖赏收集与内部稳定的计算联系 | 需要势能下降形成奖励；从生理变量推广到心理目标属于类比。旧清单把本篇误列为另一刊物，现已更正。 |
| [Smith、Friston & Whyte, 2022：主动推断教程](https://pmc.ncbi.nlm.nih.gov/articles/PMC8956124/) | 信念、偏好、行动及信息价值 | 独立 Beta 信念、简单观察模型的信息收益、行动预测与代价。没有实现完整 POMDP 预期自由能求解。 |
| [Schultz、Dayan & Montague, 1997：奖赏预测信号](https://pubmed.ncbi.nlm.nih.gov/9054347/) | 多巴胺活动与奖赏预测误差 | TD 误差形成调节信号并用于行动学习；无神经元放电或真实浓度。 |
| [Niv 等, 2007：平均奖赏与行动力度](https://www.princeton.edu/~ndaw/ndjd07.pdf) | 机会成本与行为 vigor 的理论联系 | 奖赏历史和机会影响行动代价。当前是事件平均，没有复刻连续时间最优延迟模型。 |
| [Berridge & Robinson, 1998](https://sites.lsa.umich.edu/berridge-lab/wp-content/uploads/sites/743/2019/10/BerridgeRobinsonBrResRev1998.pdf) | 实验与理论区分奖赏的追求和愉悦成分 | incentive 与 positive affect 分开保存，共同输入可相关，但前者不直接给后者加分。动物实验不是对人类情绪的完整定律。 |
| [Aston-Jones & Cohen, 2005：适应性增益](https://onlinelibrary.wiley.com/doi/10.1002/cne.20723) | LC-NE、任务投入与探索的理论模型 | alerting 与 uncertainty 调整注意、唤醒、探索和学习；采用有界工程函数，不复刻脑区动力学。 |
| [Shamay-Tsoory & Abu-Akel, 2016：社会显著性假说](https://research.birmingham.ac.uk/en/publications/the-social-salience-hypothesis-of-oxytocin/) | 催产素效应依赖情境和个体，不能简单等于普遍信任 | 社会线索权重可增强正向或不利证据；长期联结独立依据事件学习。此处采用假说的计算启发，未声称已定论。 |
| [Berendzen 等, 2023：Oxtr 与草原田鼠依恋](https://pubmed.ncbi.nlm.nih.gov/36708707/) | 特定遗传敲除条件下仍出现配对依恋与亲代行为 | 提醒单一受体／物质不等于完整依恋机制；也不能由动物敲除结果推出催产素对人类关系完全无作用。 |
| [Brewin 等, 2010：侵入性意象与记忆表征](https://pmc.ncbi.nlm.nih.gov/articles/PMC2834572/) | 感官／情境表征与侵入性再体验 | 负向旧来源与弱当下绑定支持闪回样读出，正常回忆另设共鸣；未覆盖全部创伤现象。 |
| [Saini 等, 2022：去人格化的计算视角](https://pmc.ncbi.nlm.nih.gov/articles/PMC9772393/) | 自我体验、内感受与调节的理论联系 | 感受可及和自我连续需有独立依据；本模型的乘积读出不是原论文经验证的诊断公式。 |

## 对“苯乙胺使人坠入爱河”的处理

本次检索未找到足以将“苯乙胺升高必然触发恋爱”作为确定性因果规则的原始实验证据。[Marazziti & Canale 的早期恋爱激素研究](https://doi.org/10.1016/j.psyneuen.2003.08.006)讨论激素变化，不足以证明这条苯乙胺机制。因此本版本没有实现 PEA 恋爱开关。这里是对当前证据能支持何种工程主张的判断，不是宣称已经证明苯乙胺毫无作用。

实际采用的是：新奇与目标机会改变警觉和追求；具体互动改变关系信念与历史联结；后续结果产生预测误差；这些过程共同影响亲近、退让、边界或继续探索。不存在被预设为必经的恋爱阶段。

## API 输出控制与未来扩展

[DeepSeek 接口文档](https://api-docs.deepseek.com/api/create-chat-completion/)和[思考模式文档](https://api-docs.deepseek.com/guides/thinking_mode/)用于确认当前 API 参数范围。此项目显式关闭 DeepSeek thinking，动态请求温度和长度预算；候选选择是应用层计算，不是神经网络隐藏层干预。没有把服务可能忽略的采样项宣传为有效情感控制。

[CAA（ACL 2024）](https://aclanthology.org/2024.acl-long.828/)与[ReFT](https://arxiv.org/abs/2404.03592)说明在可访问模型内部表示时，可以研究激活干预与表示微调。本项目目前没有自托管模型、相关训练或激活控制代码，不把这些研究列为已实现功能。

## 记忆压缩参考

[ranxianglei/billion-context](https://github.com/ranxianglei/billion-context)是摘要、来源保留与展开思路的参考。当前实现仍为本地单一图谱与有损摘要视图，没有复制其完整代理调度或声称达到同等规模。情绪和关系对应通过原始事件与评估边保留，压缩不会新增心理证据。
