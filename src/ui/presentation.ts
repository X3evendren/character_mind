import type { AgentPort, AgentSnapshot } from './agent-port';
import type { Turn } from './stores/chat-store';
import type { GraphNode } from '../memory/knowledge-graph';
import { getCommands } from '../commands';
import { wrapText } from './text';
import { marked } from 'marked';
import { beliefMean, effectiveAffect } from '../mind/process-state';
import { GOALS, GOAL_NAMES } from '../mind/profile';

export type Tone = 'text' | 'textDim' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
export interface Row { text: string; tone?: Tone; bold?: boolean; }
const row = (text: string, tone: Tone = 'text', bold = false): Row => ({ text, tone, bold });
export function wrapRows(rows: Row[], width: number): Row[] {
  return rows.flatMap(r => wrapText(r.text, width).map(text => ({ ...r, text })));
}
/** Block Markdown becomes physical rows so long messages remain scrollable. */
export function markdownRows(text: string): Row[] {
  return marked.lexer(text).flatMap(token => {
    if (token.type === 'heading') return [row(token.text, 'secondary', true)];
    if (token.type === 'code') return [row(`┌ ${token.lang || 'code'}`, 'textDim'), ...token.text.split('\n').map(t => row('  ' + t)), row('└', 'textDim')];
    if (token.type === 'blockquote') return token.text.split('\n').map(t => row('│ ' + t, 'textDim'));
    if (token.type === 'space') return [row('')];
    if (token.type === 'hr') return [row('────────', 'textDim')];
    // Preserve inline Markdown, links, lists and tables verbatim rather than losing information.
    return [row(token.raw.trimEnd())];
  });
}
export const POLICY_NAMES: Record<string, string> = { engage: '交流', clarify: '澄清', set_boundary: '设立边界', ground: '恢复当下定向', repair: '关系修复', express_feeling: '表达感受', share_joy: '分享喜悦', explore: '探索', cooperate: '共同完成任务', wait: '等待' };
export const PHASE_NAMES: Record<string, string> = { guard_input: '检查输入', appraise: '理解情境', decide: '选择回应策略', generate: '生成回应', guard_output: '检查回应', commit_memory: '保存记忆' };
export const KIND_NAMES: Record<string, string> = { event: '事件', appraisal: '评估', state: '过程状态', phenomenon: '现象', emotion: '历史情绪记录', decision: '决策', summary: '摘要', entity: '实体', relation: '关系', learning: '行动学习', control: '生成控制' };
const percent = (n: number) => `${Math.round(n * 100)}%`;
function meter(label: string, value: number, tone: Tone = 'primary'): Row {
  const count = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return row(`${label} ${'━'.repeat(count)}${'·'.repeat(10 - count)} ${percent(value)}`, tone);
}

export const WORKSPACE_COMMANDS = [
  { name: 'view', description: '切换 chat / mind / memory / help' },
  { name: 'memory', description: '浏览图谱；可加节点类型或关键词' },
  { name: 'search', description: '在节点原文、关系与结构中搜索' },
  { name: 'stop', description: '取消当前对话，保留已记录输入' },
  { name: 'clear', description: '清空显示记录，保留图谱记忆' },
  { name: 'initiative', description: '主动表达 on / off / status' },
];
export function commandItems() { return [...getCommands().filter(c => !c.isHidden), ...WORKSPACE_COMMANDS]; }
export function helpRows(): Row[] {
  return [row('Character Mind · 操作指南', 'secondary', true), row(''),
    row('视图与操作', 'primary', true),
    row('Tab / Shift+Tab  切换视图；输入 /命令 时 Tab 补全'),
    row('Enter  发送或执行命令；Alt+Enter  换行'),
    row('Esc  取消当前对话；关闭记忆详情'),
    row('PgUp / PgDn  按页滚动；Ctrl+↑ / ↓  逐行滚动'),
    row('Ctrl+K  随时请求压缩；Ctrl+F  搜索图谱'),
    row('Ctrl+G  心智视图；Ctrl+L  清屏；Ctrl+C  保存并退出'),
    row('↑ / ↓  输入历史；记忆视图空输入时选择节点'),
    row('记忆视图 Enter  查看选中节点及来源；Esc 返回'),
    row('Ctrl+A / E  行首 / 行尾；← / →  移动光标'), row(''),
    row('命令', 'primary', true),
    ...commandItems().map(c => row(`/${c.name}  ${c.description}`)), row(''),
    row('阅读心智状态', 'primary', true),
    row('这些数值描述角色的主观模拟，不是对使用者的诊断。'),
    row('情绪体验、记忆共鸣、闪回样再体验、解离样疏离均由过程与来源证据推断，可以共存。'),
    row('现象区分发生、减弱、消退；强度和支持度都是模型读数，不是诊断概率。'),
    row('关系信念分别估计善意、可靠与可获得性；策略分数用于比较行动，不是发生概率。'),
    row('神经调节是计算类比，会影响注意、学习、动机和生成；不是人体浓度测量。'),
    row('摘要是有损视图。原始事件、情绪与关系结构保留，可随时展开。'),
  ];
}

export function conversationRows(turns: Turn[], name: string, debug: boolean): Row[] {
  if (!turns.length) return [row(''), row(`与 ${name} 开始一段对话`, 'secondary', true), row(''),
    row('你的话先被记录，再形成理解、情绪与回应。'),
    row('Tab 查看心智、记忆与帮助；/help 查看全部操作。', 'textDim')];
  return turns.flatMap(t => {
    const time = new Date(t.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const rows = t.kind === 'initiative' ? [row(`主动表达 · ${time}`, 'accent', true)] : [row(`${t.kind === 'command' ? '命令' : '你'} · ${time}`, 'accent', true), row(t.userMessage.content)];
    if (t.kind !== 'command') rows.push(row(`${name} · ${t.status === 'streaming' ? '处理中' : t.status === 'interrupted' ? '已中断' : '已完成'}${t.elapsedMs ? ` · ${(t.elapsedMs / 1000).toFixed(1)} 秒` : ''}`, t.status === 'interrupted' ? 'warning' : 'primary', true));
    for (const b of t.blocks) {
      if (b.type === 'reasoning') continue;
      if (b.type === 'tool_call') rows.push(row(`工具 ${b.toolName} · ${b.status === 'streaming' ? '执行中' : b.toolSuccess ? '完成' : '失败'}`, 'textDim'));
      else if (b.type === 'final' && t.kind !== 'command') rows.push(...markdownRows(b.content));
      else rows.push(row(b.content, b.type === 'error' ? 'error' : 'text'));
    }
    if (debug && t.stateBadge) {
      const e = t.stateBadge.state;
      const names = t.stateBadge.phenomena.filter(p => p.status !== 'resolved').map(p => p.label).join('、');
      rows.push(row(`效价 ${e.valence.toFixed(2)} · 唤醒 ${percent(e.arousal)} · 现象 ${names || '暂无'}`, 'textDim'));
    }
    rows.push(row('')); return rows;
  });
}

export function mindRows(snapshot: AgentSnapshot | null, agent: AgentPort | null, compact = false): Row[] {
  if (!snapshot) return [row('等待心智数据…', 'textDim')];
  const e = snapshot.mind.state;
  const status = { active: '发生', fading: '减弱', resolved: '消退' };
  const rows = [row('当下现象', 'secondary', true)];
  for (const p of snapshot.mind.phenomena) {
    rows.push(row(`${p.label} · ${status[p.status]} · 强度 ${percent(p.intensity)}`, p.status === 'resolved' ? 'textDim' : 'primary'));
    if (!compact) rows.push(row(`支持度 ${percent(p.support)} · ${new Date(p.startedAt).toLocaleTimeString('zh-CN')} 起`, 'textDim'));
  }
  if (!snapshot.mind.phenomena.length) rows.push(row('暂无足够依据支持的现象。', 'textDim'));
  rows.push(row(''), row('底层过程', 'secondary', true), row(`效价 ${e.valence >= 0 ? '+' : ''}${e.valence.toFixed(2)}  ${e.valence < -.2 ? '偏负向' : e.valence > .2 ? '偏正向' : '接近中性'}`),
    meter('唤醒', e.arousal), meter('感受可及', e.affectAccess), meter('自我连续', e.selfContinuity), meter('情境绑定', e.contextBinding), meter('能动性', e.agency), row(''),
    meter('正向感受', effectiveAffect(e).positive), meter('负向感受', effectiveAffect(e).negative),
    row('关系信念', 'secondary', true),
    ...([['goodwill', '善意'], ['reliability', '可靠'], ['availability', '可获得性']] as const).map(([key, label]) => meter(label, beliefMean(e.belief[key]))),
    row(''), row(`回应策略 · ${POLICY_NAMES[snapshot.decision] ?? snapshot.decision}`, 'secondary', true));
  if (compact) return [...rows, row(`图谱 ${snapshot.memory.nodes} 节点 · ${snapshot.memory.summaries} 摘要`, 'textDim'), row('Tab 查看心智详情与来源', 'textDim')];
  rows.push(row(''), row('需要与调节', 'secondary', true), ...GOALS.map(g => meter(`${GOAL_NAMES[g]}满足`, e.motivation.satisfaction[g])), meter('可用精力', e.motivation.energy), row(`调节：${e.regulation.strategy} · ${e.regulation.reason}`));
  for (const c of e.concerns) rows.push(row(`仍在意：${GOAL_NAMES[c.goal]} ${percent(c.load)} · ${c.evidence}`, 'warning'));
  const n = e.neuromodulation;
  rows.push(row(''), row('神经调节计算类比', 'secondary', true), row(`多巴胺通路 · 预测误差 ${n.rewardPredictionError.toFixed(3)} · 奖赏率 ${n.rewardRate.toFixed(3)}`), meter('追求动机', n.incentive), meter('去甲肾上腺素通路 · 警觉', n.alerting), meter('不确定性', n.uncertainty), meter('催产素通路 · 社会显著性', n.socialSalience), meter('历史联结积累', n.attachment));
  const learning = e.motivation.lastLearning;
  if (learning) rows.push(row(`上次行动反馈 · ${POLICY_NAMES[learning.policy]} · 奖赏 ${learning.reward.toFixed(3)} · 误差 ${learning.predictionError.toFixed(3)}`), row(`反馈来源 ${learning.sourceEventId}`, 'textDim'));
  if (snapshot.control) rows.push(row('生成控制', 'secondary', true), row(JSON.stringify(snapshot.control, null, 2)));
  const decision = agent?.graph.all('decision').at(-1);
  const scores = decision?.data.candidates as Array<{ policy: string; score: number; reason: string }> | undefined;
  for (const s of scores ?? []) rows.push(row(`${POLICY_NAMES[s.policy] ?? s.policy}  ${s.score.toFixed(3)} · ${s.reason}`));
  rows.push(row('策略分数是可比较的启发式效用，不是概率。', 'textDim'), row(''), row('情绪与结构的对应关系', 'secondary', true));
  const appraisal = agent?.graph.all('appraisal').at(-1);
  if (appraisal) {
    rows.push(row(`评估依据：${appraisal.text}`), row(`结构标签：${(appraisal.data.structure as string[]).join(' · ') || '无'}`),
      row(`原始事件：${appraisal.data.eventId}`, 'textDim'),
      row(`情境绑定 ${percent(Number(appraisal.data.contextBinding))} · 可控性 ${percent(Number(appraisal.data.controllability))} · 主观可靠性 ${percent(Number(appraisal.data.reliability))}`));
    for (const relation of agent.graph.related(appraisal.id, 'asserts')) rows.push(row(`${relation.data.subject} — ${relation.data.predicate} → ${relation.data.object}`));
  } else rows.push(row('尚无有效情境评估。', 'textDim'));
  rows.push(row(''), row('现象依据与来源', 'secondary', true));
  for (const p of snapshot.mind.phenomena) {
    rows.push(row(`${p.label} · ${status[p.status]}`, 'primary', true), ...p.basis.map(b => row(b)),
      row(`过程因素 ${JSON.stringify(p.factors)}`, 'textDim'));
    for (const id of p.sourceEventIds) rows.push(row(id, 'textDim'), row(agent?.graph.get(id)?.text ?? '来源不可用'));
  }
  if (!snapshot.mind.phenomena.length) rows.push(row('尚无现象推断。', 'textDim'));
  rows.push(row(''), row('模型模拟 · 尚未经过心理学数据校准', 'warning'), row('过去情绪被再激活，并不说明过去事件正在再次发生。', 'textDim'));
  return rows;
}

export function memoryNodes(agent: AgentPort | null, query: string): GraphNode[] {
  if (!agent) return [];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return agent.graph.all().filter(n => terms.every(t => `${n.id} ${n.kind} ${KIND_NAMES[n.kind]} ${n.text} ${JSON.stringify(n.data)}`.toLowerCase().includes(t))).reverse();
}

export function memoryRows(agent: AgentPort | null, nodes: GraphNode[], selected: number, detailId: string | null): Row[] {
  if (!detailId) return [row(`知识图谱 · ${nodes.length} 个匹配节点`, 'secondary', true),
    row('↑↓ 选择 · Enter 详情 · /search 关键词 · /memory summary 查看摘要', 'textDim'), row(''),
    ...nodes.map((n, i) => row(`${i === selected ? '›' : ' '} ${KIND_NAMES[n.kind]} · ${n.id.slice(0, 8)}  ${n.text.replace(/\s+/g, ' ').slice(0, 100)}`, i === selected ? 'secondary' : 'text', i === selected)),
    ...(!nodes.length ? [row('没有匹配记录；空查询显示全部节点。', 'textDim')] : [])];
  const node = agent?.graph.get(detailId);
  if (!node) return [row('节点不存在或已不可读取。', 'warning')];
  const rows = [row(`${KIND_NAMES[node.kind]} · 来源详情`, 'secondary', true), row(node.id, 'textDim'),
    row(new Date(node.at).toLocaleString('zh-CN'), 'textDim'), row(''), row(node.text), row(''), row('结构数据', 'primary', true), row(JSON.stringify(node.data, null, 2))];
  const associated = node.kind === 'event' ? agent.graph.all('appraisal').filter(a => a.data.eventId === node.id) : node.kind === 'appraisal' ? [node] : [];
  for (const a of associated) {
    rows.push(row(''), row('主观评估 → 过程 / 现象 / 关系', 'primary', true), row(a.text), row(`结构：${(a.data.structure as string[]).join(' · ')}`));
    for (const n of agent.graph.interpretationContext(a.id)) rows.push(row(`${KIND_NAMES[n.kind]} ${n.id}`, 'textDim'), row(JSON.stringify(n.data, null, 2)));
  }
  if (node.kind === 'summary') {
    rows.push(row(''), row('展开原始记录 · 摘要有损，以下为保留原文', 'primary', true));
    for (const source of agent.graph.expand(node.id)) rows.push(row(`${source.id} · ${source.data.role}`, 'textDim'), row(source.text), row(''));
  }
  for (const n of agent.graph.related(node.id)) rows.push(row(`→ ${KIND_NAMES[n.kind]} ${n.id}`, 'textDim'), row(n.text));
  return rows;
}
