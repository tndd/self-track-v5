import { mean, shiftDay, type Overview } from './journal.ts';
import { distribution, observations, laggedAssociation, type AnalysisSource, type Observation } from './insights.ts';

export type Sample = { id: string; date: string; recordedAt: string; score: number | null; tags: string[] };
const HOUR = 3600000;
const score = (r: Sample) => r.score ?? 3;
const stamp = (r: Sample) => Date.parse(r.recordedAt);
const hour = (r: Sample) => new Date(stamp(r) + 9 * HOUR).getUTCHours();
const byTime = (rows: Sample[]) => [...rows].sort((a,b) => stamp(a)-stamp(b) || a.id.localeCompare(b.id));
const delta = (a: number|null, b: number|null) => a === null || b === null ? null : a-b;
export const WINDOWS = [{hours:-1,label:'直前',tolerance:1},{hours:0,label:'記録時',tolerance:0},{hours:1,label:'1時間後',tolerance:.5},{hours:3,label:'3時間後',tolerance:1},{hours:6,label:'6時間後',tolerance:2},{hours:24,label:'翌日同時刻',tolerance:3}] as const;

// 時間窓の最寄りの実測だけを使う。同時刻の別投稿は前後の変化とみなさない。
function near(rows: Sample[], event: Sample, hours: number, tolerance: number) {
    if (!hours) return event;
    const t = stamp(event), target = t + hours*HOUR;
    let best: Sample|undefined, distance = Infinity;
    let low=0,high=rows.length;
    while(low<high){const middle=(low+high)>>>1;if(stamp(rows[middle])<target)low=middle+1;else high=middle;}
    for (const index of [low-1,low]) {
        const r=rows[index];if(!r)continue;
        const rt=stamp(r), d=Math.abs(rt-target);
        if ((hours<0 ? rt<t : rt>t) && d<=tolerance*HOUR && d<distance) { best=r;distance=d; }
    }
    return best;
}
function dayGroups(rows: Sample[]) {
    const map=new Map<string,Sample[]>();
    for(const r of byTime(rows)){const g=map.get(r.date)??[];g.push(r);map.set(r.date,g);}
    return map;
}
export function eventTrajectory(rows: Sample[], tag: string) {
    const sorted=byTime(rows), days=dayGroups(rows);
    // 同タグの連続投稿を繰り返し数えない。一日最初の記録を起点にする。
    const events=[...days.values()].flatMap(g=>{const e=g.find(r=>r.tags.includes(tag));return e?[e]:[];});
    const controls=[...days.values()].filter(g=>!g.some(r=>r.tags.includes(tag)));
    const points=WINDOWS.map(w=>{
        const values:number[]=[],changes:number[]=[],matchedChanges:number[]=[],expected:number[]=[],dates:string[]=[],comparisonDates=new Set<string>();
        for(const e of events){
            const after=near(sorted,e,w.hours,w.tolerance);if(!after)continue;
            values.push(score(after));changes.push(score(after)-score(e));dates.push(e.date);
            const candidates=controls.flatMap(g=>{
                const candidates=g.filter(c=>score(c)===score(e)&&Math.floor(hour(c)/6)===Math.floor(hour(e)/6));
                const c=candidates.sort((a,b)=>Math.abs(hour(a)-hour(e))-Math.abs(hour(b)-hour(e)))[0];
                if(!c)return [];const follow=near(sorted,c,w.hours,w.tolerance);
                return follow?[{date:c.date,change:score(follow)-score(c)}]:[];
            });
            if(candidates.length){matchedChanges.push(score(after)-score(e));expected.push(mean(candidates.map(c=>c.change))!);candidates.forEach(c=>comparisonDates.add(c.date));}
        }
        const actual=distribution(values), change=distribution(changes);
        return {label:w.label,hours:w.hours,actual,change,dates,matched:matchedChanges.length,controls:comparisonDates.size,
            difference:matchedChanges.length>=5&&comparisonDates.size>=5?delta(mean(matchedChanges),mean(expected)):null};
    });
    return {events:events.length,points};
}
export function conditionalPatterns(rows: Observation[], tag: string, end: string) {
    const scores=new Map(rows.map(r=>[r.date,r.score]));
    const other=[...new Set(rows.flatMap(r=>r.tags))].filter(t=>t!==tag)
        .sort((a,b)=>rows.filter(r=>r.tags.includes(b)).length-rows.filter(r=>r.tags.includes(a)).length||a.localeCompare(b,'ja')).slice(0,6);
    const definitions=[{label:'低めの日（平均2.5未満）',test:(r:Observation)=>r.score!==null&&r.score<2.5},
        {label:'平均2.5以上の日',test:(r:Observation)=>r.score!==null&&r.score>=2.5},
        ...other.map(t=>({label:`「${t}」もある日`,test:(r:Observation)=>r.tags.includes(t)}))];
    return definitions.map(d=>({label:d.label,...laggedAssociation(rows.filter(d.test),scores,tag,1,end)}));
}
export function stability(rows: Sample[]) {
    return [...dayGroups(rows)].map(([date,g])=>{
        const values=g.map(score), avg=mean(values)!;
        const jumps=g.slice(1).flatMap((r,i)=>{const elapsed=stamp(r)-stamp(g[i]);return elapsed>0&&elapsed<=3*HOUR?[Math.abs(score(r)-score(g[i]))]:[];});
        return {date,count:g.length,average:avg,low:Math.min(...values),high:Math.max(...values),
            sd:Math.sqrt(mean(values.map(v=>(v-avg)**2))!),step:mean(jumps),pairs:jumps.length};
    });
}
export function recovery(rows: Sample[]) {
    const sorted=byTime(rows), episodes:{date:string;start:string;lower:number;upper:number|null;observed:number}[]=[];
    let i=0;
    while(i<sorted.length){
        const first=sorted[i];if(score(first)>2){i++;continue;}
        let last=first,j=i+1,found:Sample|undefined;
        for(;j<sorted.length;j++){
            const r=sorted[j];if(stamp(r)-stamp(first)>24*HOUR||stamp(r)-stamp(last)>6*HOUR)break;
            if(stamp(r)===stamp(last)){last=r;continue;}
            if(score(r)>=3){found=r;break;}last=r;
        }
        episodes.push({date:first.date,start:first.recordedAt,lower:(stamp(last)-stamp(first))/HOUR,upper:found?(stamp(found)-stamp(first))/HOUR:null,observed:(stamp(found??last)-stamp(first))/HOUR});
        i=found?j+1:Math.max(i+1,j);
    }
    return {episodes,confirmed:episodes.filter(e=>e.upper!==null).length,unresolved:episodes.filter(e=>e.upper===null).length};
}
function comparison(a:{date:string;value:number}[],b:{date:string;value:number}[]){const first=distribution(a.map(r=>r.value)),second=distribution(b.map(r=>r.value));return {first,second,enough:a.length>=5&&b.length>=5,diff:delta(first.mean,second.mean),dates:[...a.map(r=>r.date),...b.map(r=>r.date)]};}
export function sequencePatterns(samples:Sample[], rows:Observation[],tag:string,partner:string) {
    const map=new Map(rows.map(r=>[r.date,r]));
    const ordered:{date:string;value:number}[]=[],reversed:{date:string;value:number}[]=[],repeated:{date:string;value:number}[]=[],single:{date:string;value:number}[]=[];
    let tied=0;
    for(const [date,g] of dayGroups(samples)){
        const current=map.get(date),next=map.get(shiftDay(date,1));
        if(current?.score==null||next?.score==null)continue;
        const a=g.find(r=>r.tags.includes(tag));if(!a)continue;
        const record={date,value:next.score-current.score};
        const previous=map.get(shiftDay(date,-1));
        if(previous)(previous.tags.includes(tag)?repeated:single).push(record);
        const b=partner?g.find(r=>r.tags.includes(partner)):undefined;
        if(b){if(stamp(a)===stamp(b))tied++;else (stamp(a)<stamp(b)?ordered:reversed).push(record);}
    }
    return {order:comparison(ordered,reversed),consecutive:comparison(repeated,single),tied};
}
export function similarDays(rows:Observation[]) {
    const anchor=rows.filter(r=>r.score!==null).at(-1);if(!anchor)return {anchor:null,matches:[]};
    const map=new Map(rows.map(r=>[r.date,r]));
    const matches=rows.flatMap(r=>{
        const nextDate=shiftDay(r.date,1),next=map.get(nextDate);
        // 起点の日もその翌日も、現在の比較対象日より過去に限定する。
        if(r.score===null||next?.score==null||nextDate>=anchor.date)return [];
        const union=new Set([...r.tags,...anchor.tags]);const intersection=r.tags.filter(t=>anchor.tags.includes(t)).length;
        const tagSimilarity=union.size?intersection/union.size:1;
        const distance=Math.abs(r.score-anchor.score!)+(1-tagSimilarity);
        return distance<=1.5?[{date:r.date,score:r.score,after:next.score,nextDate,distance,tags:r.tags}]:[];
    }).sort((a,b)=>a.distance-b.distance||b.date.localeCompare(a.date)).slice(0,5);
    return {anchor,matches};
}

// 探索期間で候補を固定してから後半を確認。後半の結果による候補の入れ替えはしない。
export function discoveryInbox(rows:Observation[], end:string) {
    if(rows.length<30)return {split:null,candidates:[],tested:0};
    const split=rows[Math.floor(rows.length*.65)].date, train=rows.filter(r=>r.date<split), confirm=rows.filter(r=>r.date>=split);
    const trainEnd=shiftDay(split,-1),trainScores=new Map(train.map(r=>[r.date,r.score])),testScores=new Map(confirm.map(r=>[r.date,r.score]));
    const tags=[...new Set(train.flatMap(r=>r.tags))];
    const ranked=tags.flatMap(tag=>[1,3,7].map(lag=>({tag,lag,train:laggedAssociation(train,trainScores,tag,lag,trainEnd)})))
        .filter(c=>c.train.enough&&Math.abs(c.train.diff??0)>=.3)
        .sort((a,b)=>Math.abs(b.train.diff!)-Math.abs(a.train.diff!)||a.tag.localeCompare(b.tag,'ja')||a.lag-b.lag);
    const used=new Set<string>(),profiles=new Set<string>();const chosen=ranked.filter(c=>{const profile=train.map(r=>r.tags.includes(c.tag)?'1':'0').join('');if(used.has(c.tag)||profiles.has(profile))return false;used.add(c.tag);profiles.add(profile);return true;}).slice(0,2);
    return {split,tested:tags.length*3,candidates:chosen.map(c=>{
        const confirmation=laggedAssociation(confirm,testScores,c.tag,c.lag,end);
        return {...c,confirmation,status:!confirmation.enough?'pending' as const:Math.sign(confirmation.diff!)===Math.sign(c.train.diff!)&&Math.abs(confirmation.diff!)>=.15?'consistent' as const:'different' as const};
    })};
}
export function patternAnalysis(overview:Overview,samples:Sample[],start:string,end:string,source:AnalysisSource,tag:string,partner:string){
    const rows=observations(overview,start,end,source), filtered=samples.filter(r=>r.date>=start&&r.date<=end);
    return {trajectory:eventTrajectory(filtered,tag),conditions:conditionalPatterns(rows,tag,end),stability:stability(filtered),recovery:recovery(filtered),sequence:sequencePatterns(filtered,rows,tag,partner),similar:similarDays(rows),inbox:discoveryInbox(rows,end)};
}
