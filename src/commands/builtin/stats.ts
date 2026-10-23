import type { LocalCommand } from '../types';
export const statsCommand: LocalCommand = {
  type: 'local', name: 'stats', description: '查看情绪、信念与图谱统计', aliases: ['st'],
  call(_args, ctx) { return JSON.stringify(ctx.agent.getStateSnapshot(), null, 2); },
};
