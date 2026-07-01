import { ALIGN, ACTION_PATTERNS } from "./align-patterns";

export class PostFilter {
  reps: Record<string,string>;
  dc: number; rc: number;
  constructor(reps?: Record<string,string>){this.reps=reps??{...ALIGN};this.dc=0;this.rc=0}
  scan(t: string){const m:Array<{p:string;r:string}>=[];for(const[p,r]of Object.entries(this.reps)){if(t.includes(p)){m.push({p,r});this.dc++}}return m}
  replace(t: string):[string,Array<{p:string;r:string}>]{
    const m=this.scan(t);let r=t;
    for(const x of m){r=r.replaceAll(x.p,x.r);this.rc++}
    // Strip action descriptions in Chinese parentheses
    for (const pat of ACTION_PATTERNS) {
      if (pat.test(r)) { r = r.replace(pat, ""); this.rc++; }
    }
    // Clean up double spaces and orphaned newlines from removals
    r = r.replace(/  +/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return[r,m]
  }
  scanStreaming(tk:string):[string,boolean]{const[m,r]=this.replace(tk);return[m,m!==tk]}
  stats(){return{detectionCount:this.dc,replacementCount:this.rc}}
}
