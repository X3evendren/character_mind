/** Config Loader — Parse config/*.md into typed TS objects. */
import { readFileSync } from "fs";
import { resolve } from "path";
import { validateProfile, type PsychologicalProfile } from '../mind/profile.ts';

export interface CharacterConfig {
  name: string;
  identity: string;
  essence: string;
  traits: string;
  emotions: string;
  rules: string;
  psychology: PsychologicalProfile;
}

export function loadCharacterConfig(configDir: string): CharacterConfig {
  const text = readFileSync(resolve(configDir, 'character.md'), 'utf8').replace(/\r\n/g, '\n');
  const sections = Object.fromEntries(text.split(/^## /m).slice(1).map(s => {
    const index = s.indexOf('\n'); return [s.slice(0,index).trim(),s.slice(index+1).trim()];
  }));
  for (const name of ['身份','核心取向','人格','情感与关系','表达与边界','心理参数']) if (!sections[name]) throw new Error('角色配置缺少章节：' + name);
  const name = sections['身份'].match(/名字[：:]\s*(.+)/)?.[1]?.trim();
  if (!name) throw new Error('角色配置缺少名字');
  const parameters = sections['心理参数'].match(/```json\s*([\s\S]*?)```/)?.[1];
  if (!parameters) throw new Error('心理参数需要 JSON 代码块');
  return { name, identity: sections['身份'], essence: sections['核心取向'], traits: sections['人格'], emotions: sections['情感与关系'], rules: sections['表达与边界'], psychology: validateProfile(JSON.parse(parameters)) };
}


