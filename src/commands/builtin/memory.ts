import type { LocalCommand } from '../types';
export const compressCommand: LocalCommand = {
  type: 'local', name: 'compress', description: '压缩旧对话，保留原始来源',
  async call(_args, ctx) { return ctx.agent.compressMemory(); },
};
export const expandCommand: LocalCommand = {
  type: 'local', name: 'expand', description: '按节点 ID 展开原始记忆',
  call(args, ctx) {
    if (!args.trim()) return '用法：/expand <摘要或事件 ID>';
    return JSON.stringify(ctx.agent.graph.expand(args.trim()), null, 2);
  },
};
