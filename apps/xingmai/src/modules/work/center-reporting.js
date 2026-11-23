import { obligationBundle, diaryObligation } from './diary.js';

export async function eligibility(ctx,date) {
  const bundle=await obligationBundle(date);
  const weekday=new Date(date+'T12:00:00+08:00').getUTCDay();
  const eligible=new Map();
  for(const p of ctx.active) {
    const config=ctx.config;
    const included=config.reportMembers.length?config.reportMembers.map(String).includes(p.id):config.reportRoles.includes(p.role);
    const onDay=config.weekdays.includes(weekday)&&!config.restDays.includes(date);
    const obligation=await diaryObligation({person:ctx.bundle.people.find(row=>String(row.id)===p.id)||p,date,onRoster:false,templateFilled:false,templateLabels:[],bundle:bundle.bundle,attendance:bundle.attendance});
    const attendance=bundle.attendance.get(Number(p.id));
    eligible.set(p.id,{required:included&&onDay&&!obligation.exempt&&!attendance?.pending,reason:!included?'岗位无需提交':!onDay?'非填报工作日':obligation.exempt?obligation.note:attendance?.pending?'考勤待核对':'',pending:Boolean(attendance?.pending)});
  }
  return eligible;
}
