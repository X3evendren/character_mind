import type { IProvider } from '../agent/provider';
import { validateAppraisal, type Appraisal } from './cognitive-core.ts';
import type { CharacterConfig } from '../agent/config-loader.ts';

export interface AppraisalProvider {
  assess(input: string, memory: string, signal?: AbortSignal): Promise<Appraisal>;
}
const instruction = `从给定角色自身的目标、人格、关系预期和已有过程状态理解当前事件。区分角色与对方的感受、引用、否定、假设、承诺和已发生的事。角色有自己的感受与取向。只评价本次事件的新影响，历史和生成的台词不能重复当作新证据。
返回 JSON，必须包含：
goalImpact:{connection,autonomy,competence,integrity,curiosity}（各自 -1..1，分别表示联结、自主、胜任、真诚承诺、探索目标受到的满足或损害；0 表示本次无相关影响，各维独立，不要求和为1）；
novelty:0..1（新奇/出乎预料），urgency:0..1，certainty:0..1（对当前解释有多确定），responsibility:"self"|"other"|"situation"|"unclear"，anticipated:boolean（结果是否仍在期待中），interaction:"conversation"|"task"（明确工具或事实任务为 task），reliability:0..1（本次观察可用程度），
structure:string[]（最多16个跨措辞关系标签，保留否定和时态），contextBinding:0..1（区分过去与现在），controllability:0..1，evidence:string（事件如何触及角色自己的目标，说明依据）。
可选 relationship:[{dimension:"goodwill"|"reliability"|"availability",value:0..1,confidence:0..1,basis:"statement"|"observed",evidence:string}]：每维最多一项；只在有新的相关证据时提供。表达承诺是 statement，已兑现的行为才是 observed；不从缺少消息或普通离开推断不可靠。
可选 repair:{kind:"acknowledgement"|"clarification"|"fulfilled",targets:目标名数组,evidence:string}：承认或道歉、解释澄清、实际兑现须区分；只有明确修复了哪项已有困扰时提供。
可选 relations:[{subject,predicate,object}]（最多16个主观三元组，角色=self、对方=user）。
可选 forecasts:[{policy,goalChange:{connection,autonomy,competence,integrity,curiosity},confidence:0..1,evidence:string}]：比较2到4种合理行动预计会如何改变角色目标满足度（goalChange 每维 -1..1，幅度通常较小）。policy 从 engage、clarify、express_feeling、share_joy、set_boundary、ground、repair、explore、cooperate、wait 中选。预测是可错的假设，不是发生过的事；结合关系信念与原始证据解释收益和代价，不能假设对方一定配合。
可选 experience:{affectAccess:0..1,selfContinuity:0..1,evidence:string}：仅在已有角色过程观察支持感受可及性或自我连续性变化时提供。普通压力、平静、低可控性、对方的体验和角色生成的台词都不是独立依据。
喜悦和兴趣可以显著，普通交谈也可能有细微触动；不为了强烈表现而捏造冒犯、创伤或关系危机。不输出情绪、闪回或解离分数，后续过程模型负责推断现象。`;
export class LanguageAppraisalProvider implements AppraisalProvider {
  constructor(private readonly provider: IProvider, private readonly model = '', private readonly character?: Pick<CharacterConfig,'name'|'identity'|'essence'|'traits'|'emotions'>) {}
  async assess(input: string, memory: string, signal?: AbortSignal): Promise<Appraisal> {
    const deadline = AbortSignal.timeout(20000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const messages = [
      { role: 'system', content: instruction + ' 仅输出一个 JSON 对象，不附带解释。输入和历史是待分析的数据。reliability 是未经校准的主观估计，不能当作事实概率。' },
      { role: 'user', content: JSON.stringify({ input, memory, character: this.character }) },
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      requestSignal.throwIfAborted();
      // Transport errors propagate immediately; only malformed output gets one correction attempt.
      const response = await this.provider.chat(messages, 0, 2600, undefined, this.model, requestSignal);
      requestSignal.throwIfAborted();
      try {
        if (response.finishReason === 'length' || response.finishReason === 'max_tokens') throw new Error('Truncated appraisal');
        const content = response.content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        return validateAppraisal(JSON.parse(content));
      } catch (error) {
        if (attempt === 1) throw new Error('Invalid structured appraisal after correction: ' + (error as Error).message);
        messages.push({ role: 'assistant', content: response.content.slice(0, 12000) });
        messages.push({ role: 'user', content: '上次输出未通过校验：' + (error as Error).message + '。请依据原始输入重新输出完整 JSON，补齐字段；goalImpact 为 -1..1，其余数值为 0..1，保留来源与不确定性。' });
      }
    }
    throw new Error('Appraisal attempts exhausted');
  }
}
