import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = '/Users/jingzhan.chen/Workbuddy/2026-08-02-23-04-06/Vibe-Coding-扫盲.pptx';
const W = 1280, H = 720;
const C = { bg:'#0B1020', panel:'#121A2E', panel2:'#18233A', text:'#F4F7FB', muted:'#A9B4C7', lime:'#B8F34A', cyan:'#62D9FF', orange:'#FFB86B', red:'#FF6B7A', line:'#2B3854' };
function box(slide, x,y,w,h, fill=C.panel, radius='rounded-lg', lineFill='none') { const o={geometry: radius==='none'?'rect':'roundRect', position:{left:x,top:y,width:w,height:h}, fill, line:{style:'solid',fill:lineFill,width:lineFill==='none'?0:1}}; if(radius!=='none') o.borderRadius=radius; return slide.shapes.add(o); }
function txt(slide, text, x,y,w,h, size=20, color=C.text, bold=false, align='left') { const s=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}}); s.text=text; s.text.style={fontSize:size,color,bold,align,verticalAlign:'mid'}; return s; }
function line(slide,x1,y1,x2,y2,color=C.line,width=2){ slide.shapes.add({geometry:'line',position:{left:x1,top:y1,width:x2-x1,height:y2-y1},line:{style:'solid',fill:color,width},fill:'none'}); }
function base(slide, n, section='VIBE CODING 101'){ slide.background.fill=C.bg; txt(slide,section,64,34,300,24,14,C.lime,true); txt(slide,String(n).padStart(2,'0'),1160,34,56,24,14,C.muted,true,'right'); line(slide,64,676,1216,676,C.line,1); txt(slide,'把想法说清楚，剩下的交给协作。',64,686,500,18,12,C.muted); }
function title(slide, t, sub=''){ txt(slide,t,64,82,1120,70,38,C.text,true); if(sub) txt(slide,sub,68,154,1050,34,20,C.muted); }

const p=Presentation.create({slideSize:{width:W,height:H}});

// 1
{ const s=p.slides.add(); s.background.fill=C.bg; txt(s,'VIBE CODING',64,54,500,30,16,C.lime,true); txt(s,'不会写代码，\n也能做出软件？',64,128,700,180,56,C.text,true); txt(s,'一场关于 AI 编程的扫盲课',68,336,620,42,26,C.muted); box(s,820,122,330,390,C.panel,'rounded-2xl',C.line); txt(s,'idea',866,156,100,30,18,C.lime,true); txt(s,'→',960,154,40,30,22,C.muted,true,'center'); txt(s,'product',1008,156,110,30,18,C.cyan,true); line(s,866,216,1110,216,C.line,1); txt(s,'“做一个能记录\n灵感的网页”',866,250,230,72,24,C.text,true); txt(s,'AI',1022,368,76,58,38,C.lime,true,'center'); txt(s,'把自然语言\n变成可运行的东西',866,436,235,52,18,C.muted); txt(s,'适合：产品、设计、运营、创业者',68,592,600,28,18,C.muted); line(s,64,676,1216,676,C.line,1); txt(s,'VIBE CODING 101',64,686,240,18,12,C.muted); }

// 2
{ const s=p.slides.add(); base(s,2); title(s,'它到底是什么？','一句话：用自然语言，和 AI 一起“编程”。'); box(s,64,236,1152,190,C.panel,'rounded-2xl',C.line); txt(s,'你负责',104,270,160,30,20,C.lime,true); txt(s,'目标、场景、判断与取舍',104,318,340,46,30,C.text,true); txt(s,'AI 负责',518,270,160,30,20,C.cyan,true); txt(s,'代码、结构、调试与迭代',518,318,390,46,30,C.text,true); txt(s,'最终交付',950,270,180,30,20,C.orange,true); txt(s,'可运行的产品',950,318,230,46,30,C.text,true); line(s,454,280,454,388,C.line,1); line(s,908,280,908,388,C.line,1); txt(s,'关键变化：编程从“写语法”变成“做判断”。',68,500,980,50,28,C.text,true); txt(s,'但它不是魔法，也不是“按一下就完事”。',68,560,900,34,20,C.muted); }

// 3
{ const s=p.slides.add(); base(s,3); title(s,'工作方式变了：从敲代码到搭回路','Vibe Coding 的核心，不是一次生成，而是持续对话。'); const steps=[['01','描述目标','先说清楚要解决谁的什么问题'],['02','让 AI 动手','生成页面、逻辑和基础结构'],['03','亲自试用','用真实场景找出不对的地方'],['04','反馈迭代','告诉 AI 哪里不对、为什么']]; steps.forEach((a,i)=>{const x=70+i*290; box(s,x,250,240,205,i===0?C.panel2:C.panel,'rounded-xl',i===0?C.lime:C.line); txt(s,a[0],x+20,274,50,30,16,C.lime,true); txt(s,a[1],x+20,324,200,36,24,C.text,true); txt(s,a[2],x+20,374,195,54,16,C.muted); if(i<3) txt(s,'→',x+248,330,38,30,24,C.lime,true,'center'); }); txt(s,'像带一个“速度很快、但需要复核的实习生”。',70,532,1000,44,28,C.text,true); }

// 4
{ const s=p.slides.add(); base(s,4); title(s,'最适合从哪里开始？','先做“看得见、改得动、风险低”的小东西。'); const items=[['个人工具','表单、计算器、清单、仪表盘'],['内部效率','自动整理、查询、生成、提醒'],['原型验证','快速验证一个产品想法'],['学习实验','把抽象概念变成可操作 demo']]; items.forEach((a,i)=>{const y=228+i*92; txt(s,String(i+1).padStart(2,'0'),74,y+12,54,30,18,C.lime,true); txt(s,a[0],160,y,220,34,24,C.text,true); txt(s,a[1],420,y+2,640,32,19,C.muted); line(s,160,y+66,1110,y+66,C.line,1);}); box(s,950,520,260,64,C.lime,'rounded-xl'); txt(s,'先做一个周末能完成的',970,537,220,24,16,C.bg,true,'center'); }

// 5
{ const s=p.slides.add(); base(s,5); title(s,'好结果的分水岭：你会不会“提需求”','不是一句“帮我做个网站”，而是一份可验证的说明。'); box(s,64,230,520,330,C.panel,'rounded-2xl',C.line); txt(s,'模糊说法',96,264,180,28,18,C.red,true); txt(s,'“做个好看的记账 App”',96,320,390,44,28,C.text,true); txt(s,'结果：AI 只能猜。\n猜错了，再返工。',96,410,360,70,20,C.muted); box(s,650,230,566,330,C.panel2,'rounded-2xl',C.lime); txt(s,'可执行说法',682,264,200,28,18,C.lime,true); txt(s,'“为自由职业者做一个\n记录收入与待收款的网页”',682,316,450,78,26,C.text,true); txt(s,'补上：用户 · 场景 · 输入 · 输出 · 限制',682,436,470,32,18,C.muted); }

// 6
{ const s=p.slides.add(); base(s,6); title(s,'AI 很强，但它不替你承担责任','生成速度 ≠ 结果可靠。'); const cols=[['它擅长','搭骨架\n写样式\n改小问题',C.cyan],['它可能出错','理解偏差\n隐藏 Bug\n过时做法',C.orange],['你要把关','数据安全\n真实流程\n最终体验',C.lime]]; cols.forEach((a,i)=>{const x=92+i*380; box(s,x,250,300,248,C.panel,'rounded-2xl',a[2]); txt(s,a[0],x+28,280,240,30,22,a[2],true); txt(s,a[1],x+28,346,240,108,27,C.text,true);}); txt(s,'底线：涉及隐私、支付、权限、生产数据时，必须加人工审核。',92,558,1080,34,20,C.text,true); }

// 7
{ const s=p.slides.add(); base(s,7); title(s,'一套可复用的安全起步法','把第一次成功，拆成 5 个小回合。'); const labels=['选一个小问题','写清验收标准','让 AI 先出最小版','逐步加功能','保存可回退版本']; labels.forEach((t,i)=>{const x=90+i*225; txt(s,String(i+1),x,280,54,54,32,C.lime,true,'center'); box(s,x-12,348,174,8,C.lime,'none'); txt(s,t,x-18,386,190,64,20,C.text,true,'center'); if(i<4) line(s,x+170,352,x+212,352,C.line,2);}); box(s,160,520,960,72,C.panel2,'rounded-xl',C.line); txt(s,'每一轮只回答一个问题：现在的版本，离“能用”还差什么？',190,541,900,30,22,C.text,true,'center'); }

// 8
{ const s=p.slides.add(); base(s,8); title(s,'现在就可以开始','别从“学会编程”开始，从“解决一个小问题”开始。'); txt(s,'今天的行动',82,246,220,30,20,C.lime,true); const acts=['找一个重复做、很烦的小任务','用 3 句话写清楚用户与结果','让 AI 先做最小可用版本','亲自试 10 分钟，再反馈']; acts.forEach((t,i)=>{const y=300+i*58; txt(s,'✓',88,y,30,30,23,C.lime,true); txt(s,t,138,y,740,30,23,C.text,true);}); box(s,930,246,236,198,C.lime,'rounded-2xl'); txt(s,'VIBE',958,278,180,44,36,C.bg,true,'center'); txt(s,'→',1004,332,86,30,25,C.bg,true,'center'); txt(s,'MAKE',958,370,180,44,36,C.bg,true,'center'); txt(s,'最好的入门课\n是做出第一个小东西。',82,568,760,50,28,C.text,true); }

async function main(){ await fs.mkdir('/Users/jingzhan.chen/Workbuddy/2026-08-02-23-04-06/build/rendered',{recursive:true}); const pptx=await PresentationFile.exportPptx(p); await pptx.save(OUT); for(const [i,slide] of p.slides.items.entries()){ const b=await p.export({slide,format:'png',scale:1}); await fs.writeFile(`/Users/jingzhan.chen/Workbuddy/2026-08-02-23-04-06/build/rendered/slide-${i+1}.png`,new Uint8Array(await b.arrayBuffer())); } }
main().catch(e=>{console.error(e);process.exit(1)});
