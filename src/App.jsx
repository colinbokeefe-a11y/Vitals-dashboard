import { useState, useRef } from "react";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// --- Health Data ---
const sampleAppleHealth = {
  steps: 8342, stepsGoal: 10000,
  activeCalories: 487, restingCalories: 1820,
  heartRate: 62, hrv: 54,
  weeklySteps: [7200, 9100, 6800, 11200, 8342, 0, 0],
};
const sampleWhoop = {
  recovery: 78, strain: 12.4,
  sleep: { score: 85, duration: "7h 22m", deepSleep: "1h 48m", remSleep: "1h 55m", lightSleep: "3h 39m", efficiency: 91 },
  hrv: 58, restingHR: 51,
};
const sampleMeals = [
  { id: 1, name: "Overnight Oats",       time: "8:14 AM",  tag: "Breakfast", calories: 420, protein: 18, carbs: 62, fat: 11, notes: "Added blueberries and almond butter", emoji: "🥣" },
  { id: 2, name: "Grilled Chicken Bowl", time: "12:45 PM", tag: "Lunch",     calories: 680, protein: 52, carbs: 55, fat: 18, notes: "Brown rice, avocado, salsa",           emoji: "🍗" },
  { id: 3, name: "Protein Shake",        time: "4:30 PM",  tag: "Snack",     calories: 210, protein: 30, carbs: 12, fat: 4,  notes: "Post workout",                         emoji: "🥤" },
];

// --- Marathon: April 6 → June 20, 2026 (11 weeks) ---
// Today: March 26, 2026 — plan starts April 6
const RACE_DATE    = new Date("2026-06-20");
const TODAY        = new Date("2026-03-26");
const PLAN_START   = new Date("2026-04-06"); // Week 1 Monday
const CURRENT_WEEK = 0; // Pre-training (plan hasn't started yet)

// 11 weeks: April 7–June 20
// April: Wks 1–4 (Base), May: Wks 5–9 (Build/Peak), June: Wks 10–11 (Taper) + Race Day
const trainingPlan = [
  // APRIL — Base Building
  { week:1,  month:"April", easy:8,  tempo:3, midweek:5,  long:10, label:"Base Building", dates:"Apr 6–12"   },
  { week:2,  month:"April", easy:9,  tempo:4, midweek:6,  long:12, label:"Base Building", dates:"Apr 13–19"  },
  { week:3,  month:"April", easy:10, tempo:4, midweek:7,  long:14, label:"Build Phase",   dates:"Apr 20–26"  },
  { week:4,  month:"April", easy:7,  tempo:3, midweek:5,  long:10, label:"Recovery",      dates:"Apr 27–May 3"},
  // MAY — Build & Peak
  { week:5,  month:"May",   easy:11, tempo:5, midweek:8,  long:16, label:"Build Phase",   dates:"May 4–10"   },
  { week:6,  month:"May",   easy:12, tempo:5, midweek:8,  long:18, label:"Peak Phase",    dates:"May 11–17"  },
  { week:7,  month:"May",   easy:13, tempo:6, midweek:9,  long:20, label:"Peak Phase",    dates:"May 18–24"  },
  { week:8,  month:"May",   easy:8,  tempo:4, midweek:6,  long:13, label:"Recovery",      dates:"May 25–31"  },
  { week:9,  month:"May",   easy:12, tempo:5, midweek:8,  long:18, label:"Peak Phase",    dates:"Jun 1–7"    },
  // JUNE — Taper & Race
  { week:10, month:"June",  easy:9,  tempo:3, midweek:5,  long:13, label:"Taper Begins",  dates:"Jun 8–14"   },
  { week:11, month:"June",  easy:5,  tempo:0, midweek:3,  long:26, label:"Race Day 🏁",   dates:"Jun 15–20"  },
];

// No runs logged yet — training hasn't started
const initialRuns = [];

const monthRanges = [
  { label:"April", color:"#5e5ce6", wks:[1,2,3,4],   status:"Starting Apr 6" },
  { label:"May",   color:"#ff6b35", wks:[5,6,7,8,9], status:"Upcoming"       },
  { label:"June",  color:"#30d158", wks:[10,11],      status:"Race Month"     },
];

// --- Utilities ---
const ring = (pct, color, size=80, stroke=8) => {
  const r=(size-stroke)/2, circ=2*Math.PI*r, dash=circ*Math.min(pct/100,1);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f5" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.8s ease"}}/>
    </svg>
  );
};
const MacroBar = ({label,value,total,color}) => {
  const pct=Math.min((value/total)*100,100);
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#6e6e80",marginBottom:4}}>
        <span>{label}</span><span style={{color:"#1c1c1e",fontWeight:600}}>{value}g</span>
      </div>
      <div style={{background:"#f0f0f5",borderRadius:99,height:7,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.7s ease"}}/>
      </div>
    </div>
  );
};
const Tag = ({label}) => {
  const bg={Breakfast:"#fff3e0",Lunch:"#e8f5e9",Dinner:"#e3f2fd",Snack:"#f3e5f5"};
  const tx={Breakfast:"#e65100",Lunch:"#2e7d32",Dinner:"#1565c0",Snack:"#6a1b9a"};
  return <span style={{background:bg[label]||"#f5f5f5",color:tx[label]||"#555",borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:600}}>{label}</span>;
};
const RunBadge = ({type}) => {
  const m={"Long Run":["#fff3e0","#e65100"],"Tempo":["#fce4ec","#c62828"],"Easy":["#e8f5e9","#2e7d32"],"Midweek":["#e3f2fd","#1565c0"]};
  const [bg,c]=m[type]||["#f5f5f5","#555"];
  return <span style={{background:bg,color:c,borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700}}>{type}</span>;
};

// --- App ---
export default function HealthDashboard() {
  const [tab, setTab]   = useState("overview");
  const [meals,setMeals]= useState(sampleMeals);
  const [runs, setRuns] = useState(initialRuns);
  const [mView, setMView]     = useState("monthly");
  const [logOpen, setLogOpen] = useState(false);
  const [newRun, setNewRun]   = useState({miles:"",pace:"",type:"Easy",notes:"",week:1});
  const [selWeek, setSelWeek] = useState(1);
  const [analyzing, setAnalyzing]         = useState(false);
  const [dragOver,  setDragOver]          = useState(false);
  const [uploadedImage,     setUploadedImage]     = useState(null);
  const [uploadedImageData, setUploadedImageData] = useState(null);
  const [analysisResult,    setAnalysisResult]    = useState(null);
  const [newNote, setNewNote] = useState("");
  const [newTag,  setNewTag]  = useState("Lunch");
  const fileRef = useRef();

  // Nutrition
  const totalCals    = meals.reduce((s,m)=>s+m.calories,0);
  const totalProtein = meals.reduce((s,m)=>s+m.protein,0);
  const totalCarbs   = meals.reduce((s,m)=>s+m.carbs,0);
  const totalFat     = meals.reduce((s,m)=>s+m.fat,0);
  const calGoal = 2500;

  // Marathon stats
  const daysUntilPlan = Math.ceil((PLAN_START - TODAY) / 86400000);
  const daysUntilRace = Math.ceil((RACE_DATE  - TODAY) / 86400000);
  const weeksUntilRace= Math.ceil(daysUntilRace / 7);
  const totalLogged   = runs.reduce((s,r)=>s+r.miles,0);
  const weeksComplete = runs.length > 0 ? Math.max(...runs.map(r=>r.week)) - 1 : 0;

  const monthColor = {April:"#5e5ce6", May:"#ff6b35", June:"#30d158"};
  const weekMiles  = trainingPlan.map(w=>({
    week:w.week,
    planned:w.easy+w.tempo+w.midweek+w.long,
    logged:runs.filter(r=>r.week===w.week).reduce((s,r)=>s+r.miles,0),
    month:w.month
  }));
  const maxWkMiles = Math.max(...weekMiles.map(w=>w.planned));

  const selPlan  = trainingPlan[selWeek-1];
  const selRuns  = runs.filter(r=>r.week===selWeek);
  const selMiles = selRuns.reduce((s,r)=>s+r.miles,0);
  const selTotal = selPlan.easy+selPlan.tempo+selPlan.midweek+selPlan.long;

  // Image analysis
  const handleFile = (file) => {
    if (!file||!file.type.startsWith("image/")) return;
    const r=new FileReader();
    r.onload=e=>{setUploadedImage(e.target.result);setUploadedImageData(e.target.result.split(",")[1]);};
    r.readAsDataURL(file);
  };
  const analyzeImage = async () => {
    if (!uploadedImageData) return;
    setAnalyzing(true); setAnalysisResult(null);
    try {
      const res=await fetch(ANTHROPIC_API_URL,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:"image/jpeg",data:uploadedImageData}},
          {type:"text",text:`Analyze this meal image and return ONLY a JSON object (no markdown) with: { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "emoji": string }`}
        ]}]})});
      const data=await res.json();
      const text=data.content.map(b=>b.text||"").join("");
      setAnalysisResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch {setAnalysisResult({error:"Could not analyze. Please try again."});}
    setAnalyzing(false);
  };
  const addMeal = () => {
    if (!analysisResult||analysisResult.error) return;
    const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setMeals([...meals,{id:Date.now(),name:analysisResult.name,time,tag:newTag,calories:analysisResult.calories,protein:analysisResult.protein,carbs:analysisResult.carbs,fat:analysisResult.fat,notes:newNote,emoji:analysisResult.emoji||"🍽️"}]);
    setUploadedImage(null);setUploadedImageData(null);setAnalysisResult(null);setNewNote("");
  };
  const addRun = () => {
    if (!newRun.miles) return;
    setRuns([...runs,{id:Date.now(),week:parseInt(newRun.week),date:newRun.date||"—",miles:parseFloat(newRun.miles),type:newRun.type,pace:newRun.pace||"—",notes:newRun.notes}]);
    setNewRun({miles:"",pace:"",type:"Easy",notes:"",week:newRun.week});
    setLogOpen(false);
  };

  const S = {
    app:{minHeight:"100vh",background:"#f7f7fa",fontFamily:"'DM Sans',sans-serif",color:"#1c1c1e"},
    hdr:{background:"white",borderBottom:"1px solid #ebebf0",padding:"0 24px",position:"sticky",top:0,zIndex:100},
    hdrIn:{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64},
    main:{maxWidth:980,margin:"0 auto",padding:"28px 24px"},
    g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16},
    g3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16},
    card:{background:"white",borderRadius:20,padding:24,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"},
    ct:{fontSize:12,fontWeight:600,color:"#8e8e93",letterSpacing:"0.6px",textTransform:"uppercase",marginBottom:16},
    big:{fontSize:36,fontWeight:700,letterSpacing:"-1px"},
    sub:{fontSize:13,color:"#8e8e93",marginTop:2},
    pill:(c)=>({display:"inline-block",background:c+"18",color:c,borderRadius:99,padding:"3px 12px",fontSize:12,fontWeight:600}),
    dz:(ov)=>({border:`2px dashed ${ov?"#007aff":"#d1d1d8"}`,borderRadius:16,padding:"32px 24px",textAlign:"center",cursor:"pointer",background:ov?"#f0f7ff":"#fafafa",transition:"all 0.2s",marginBottom:16}),
    btn:(c="#007aff")=>({background:c,color:"white",border:"none",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}),
    sbtn:(c="#007aff",out=false)=>({background:out?"transparent":c,color:out?c:"white",border:out?`1.5px solid ${c}`:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}),
    inp:{width:"100%",border:"1.5px solid #e5e5ea",borderRadius:10,padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box",color:"#1c1c1e"},
    sel:{border:"1.5px solid #e5e5ea",borderRadius:10,padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif",background:"white",outline:"none",color:"#1c1c1e",cursor:"pointer"},
    mc:{background:"white",borderRadius:16,padding:"16px 20px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:10,display:"flex",alignItems:"center",gap:16},
    nb:(a)=>({padding:"8px 16px",borderRadius:99,border:"none",cursor:"pointer",background:a?"#1c1c1e":"transparent",color:a?"white":"#6e6e80",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,transition:"all 0.2s"}),
  };

  const weekDays=["M","T","W","T","F","S","S"];
  const maxSteps=Math.max(...sampleAppleHealth.weeklySteps,1);

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <header style={S.hdr}>
        <div style={S.hdrIn}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#30d158,#007aff)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:18}}>❤️</span>
            </div>
            <div>
              <div style={{fontSize:18,fontWeight:700,letterSpacing:"-0.5px"}}>Vitals</div>
              <div style={{fontSize:12,color:"#8e8e93"}}>Your health, unified</div>
            </div>
          </div>
          <nav style={{display:"flex",gap:4}}>
            {[["overview","Overview"],["whoop","Whoop"],["marathon","🏃 Marathon"],["nutrition","Nutrition"]].map(([id,lbl])=>(
              <button key={id} style={S.nb(tab===id)} onClick={()=>setTab(id)}>{lbl}</button>
            ))}
          </nav>
        </div>
      </header>

      <main style={S.main}>

        {/* ══ OVERVIEW ══ */}
        {tab==="overview" && (<>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.5px",margin:0}}>Good morning 👋</h1>
            <p style={{color:"#8e8e93",marginTop:4,fontSize:14,marginBottom:0}}>Thursday, March 26, 2026</p>
          </div>
          <div style={S.g3}>
            <div style={S.card}>
              <div style={S.ct}>Steps</div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{position:"relative",flexShrink:0}}>
                  {ring(sampleAppleHealth.steps/sampleAppleHealth.stepsGoal*100,"#ff6b35")}
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🦶</div>
                </div>
                <div><div style={S.big}>{sampleAppleHealth.steps.toLocaleString()}</div><div style={S.sub}>Goal: {sampleAppleHealth.stepsGoal.toLocaleString()}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,marginTop:16,height:36}}>
                {sampleAppleHealth.weeklySteps.map((s,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{width:"100%",background:i===4?"#ff6b35":"#ebebf0",borderRadius:3,height:`${(s/maxSteps)*32}px`,minHeight:s>0?3:0}}/>
                    <span style={{fontSize:9,color:"#c7c7cc"}}>{weekDays[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ct}>Heart</div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{position:"relative",flexShrink:0}}>
                  {ring(70,"#ff3b30")}
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>❤️</div>
                </div>
                <div><div style={S.big}>{sampleAppleHealth.heartRate}</div><div style={S.sub}>BPM resting</div></div>
              </div>
              <div style={{marginTop:16,padding:"12px 14px",background:"#fff5f5",borderRadius:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#8e8e93"}}>HRV</span>
                  <span style={{fontSize:20,fontWeight:700,color:"#ff3b30"}}>{sampleAppleHealth.hrv} <span style={{fontSize:12,fontWeight:400}}>ms</span></span>
                </div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ct}>Activity</div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{position:"relative",flexShrink:0}}>
                  {ring(sampleAppleHealth.activeCalories/600*100,"#30d158")}
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🔥</div>
                </div>
                <div><div style={S.big}>{sampleAppleHealth.activeCalories}</div><div style={S.sub}>Active kcal</div></div>
              </div>
              <div style={{marginTop:16,padding:"12px 14px",background:"#f0fff4",borderRadius:12}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:"#8e8e93"}}>Resting kcal</span>
                  <span style={{fontSize:14,fontWeight:600}}>{sampleAppleHealth.restingCalories}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={S.g2}>
            <div style={S.card}>
              <div style={S.ct}>Whoop Recovery</div>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={{position:"relative",flexShrink:0}}>
                  {ring(sampleWhoop.recovery,"#30d158",96,10)}
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:22,fontWeight:700,color:"#30d158"}}>{sampleWhoop.recovery}%</span>
                  </div>
                </div>
                <div>
                  <div style={{...S.pill("#30d158"),marginBottom:8}}>Optimal</div>
                  <div style={{fontSize:13,color:"#6e6e80",lineHeight:1.7}}>
                    HRV: <strong style={{color:"#1c1c1e"}}>{sampleWhoop.hrv} ms</strong><br/>
                    Resting HR: <strong style={{color:"#1c1c1e"}}>{sampleWhoop.restingHR} bpm</strong><br/>
                    Strain: <strong style={{color:"#1c1c1e"}}>{sampleWhoop.strain}</strong>
                  </div>
                </div>
              </div>
            </div>
            {/* Marathon mini card */}
            <div style={{...S.card,cursor:"pointer"}} onClick={()=>setTab("marathon")}>
              <div style={S.ct}>Marathon Training</div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
                <span style={{fontSize:36}}>🏃</span>
                <div><div style={S.big}>{daysUntilRace}</div><div style={S.sub}>days to race · Jun 20, 2026</div></div>
              </div>
              {/* Pre-training countdown to plan start */}
              <div style={{background:"#f0f0ff",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>📅</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#5e5ce6"}}>Training starts in {daysUntilPlan} days</div>
                  <div style={{fontSize:11,color:"#8e8e93"}}>April 6, 2026 — 11-week plan</div>
                </div>
              </div>
            </div>
          </div>
          <div style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={S.ct}>Today's Nutrition</div>
              <button style={{...S.btn(),padding:"8px 16px",fontSize:13}} onClick={()=>setTab("nutrition")}>+ Log Meal</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:28}}>
              <div style={{position:"relative",flexShrink:0}}>
                {ring(totalCals/calGoal*100,"#ff9f0a",88,9)}
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:18,fontWeight:700}}>{totalCals}</span>
                  <span style={{fontSize:9,color:"#8e8e93"}}>kcal</span>
                </div>
              </div>
              <div style={{flex:1}}>
                <MacroBar label="Protein" value={totalProtein} total={180} color="#ff3b30"/>
                <MacroBar label="Carbs"   value={totalCarbs}   total={300} color="#ff9f0a"/>
                <MacroBar label="Fat"     value={totalFat}     total={80}  color="#30d158"/>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:"#8e8e93"}}>Remaining</div>
                <div style={{fontSize:24,fontWeight:700,color:totalCals>calGoal?"#ff3b30":"#30d158"}}>{Math.max(calGoal-totalCals,0)}</div>
                <div style={{fontSize:12,color:"#8e8e93"}}>kcal left</div>
              </div>
            </div>
          </div>
        </>)}

        {/* ══ WHOOP ══ */}
        {tab==="whoop" && (<>
          <h2 style={{fontSize:22,fontWeight:700,letterSpacing:"-0.3px",marginBottom:20}}>Whoop Data</h2>
          <div style={S.g2}>
            <div style={S.card}>
              <div style={S.ct}>Recovery</div>
              <div style={{textAlign:"center",padding:"16px 0"}}>
                <div style={{position:"relative",display:"inline-block"}}>
                  {ring(sampleWhoop.recovery,"#30d158",140,14)}
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:38,fontWeight:700,color:"#30d158"}}>{sampleWhoop.recovery}%</span>
                    <span style={{fontSize:12,color:"#8e8e93"}}>Recovery Score</span>
                  </div>
                </div>
                <div style={{marginTop:16}}><span style={S.pill("#30d158")}>🟢 Optimal — Push hard today</span></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
                {[["HRV",`${sampleWhoop.hrv} ms`,"#5e5ce6"],["Resting HR",`${sampleWhoop.restingHR} bpm`,"#ff3b30"],["SpO₂","98%","#007aff"],["Skin Temp","+0.2°C","#ff9f0a"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"#fafafa",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:"#8e8e93",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ct}>Daily Strain</div>
              <div style={{textAlign:"center",padding:"16px 0"}}>
                <div style={{position:"relative",display:"inline-block"}}>
                  {ring(sampleWhoop.strain/21*100,"#007aff",140,14)}
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:38,fontWeight:700,color:"#007aff"}}>{sampleWhoop.strain}</span>
                    <span style={{fontSize:12,color:"#8e8e93"}}>/ 21 max</span>
                  </div>
                </div>
                <div style={{marginTop:16}}><span style={S.pill("#007aff")}>Moderate Load</span></div>
              </div>
              <div style={{background:"#f0f7ff",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:12,color:"#8e8e93",marginBottom:4}}>Cardiovascular Load</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,background:"#d1e8ff",borderRadius:99,height:8,overflow:"hidden"}}>
                    <div style={{width:`${sampleWhoop.strain/21*100}%`,height:"100%",background:"#007aff",borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:600,color:"#007aff"}}>{Math.round(sampleWhoop.strain/21*100)}%</span>
                </div>
              </div>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.ct}>Sleep Analysis</div>
            <div style={{display:"flex",alignItems:"center",gap:24,marginBottom:20}}>
              <div style={{position:"relative",flexShrink:0}}>
                {ring(sampleWhoop.sleep.score,"#5e5ce6",100,10)}
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:20,fontWeight:700,color:"#5e5ce6"}}>{sampleWhoop.sleep.score}%</span>
                </div>
              </div>
              <div>
                <div style={{fontSize:28,fontWeight:700,letterSpacing:"-0.5px"}}>{sampleWhoop.sleep.duration}</div>
                <div style={{fontSize:13,color:"#8e8e93"}}>Total sleep · {sampleWhoop.sleep.efficiency}% efficient</div>
              </div>
            </div>
            <div style={{display:"flex",height:24,borderRadius:99,overflow:"hidden",gap:2,marginBottom:14}}>
              <div style={{background:"#5e5ce6",flex:24}}/><div style={{background:"#bf5af2",flex:26}}/><div style={{background:"#64d2ff",flex:49}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[["Deep Sleep",sampleWhoop.sleep.deepSleep,"#5e5ce6","🌑"],["REM Sleep",sampleWhoop.sleep.remSleep,"#bf5af2","💭"],["Light Sleep",sampleWhoop.sleep.lightSleep,"#64d2ff","☁️"]].map(([l,v,c,ic])=>(
                <div key={l} style={{background:"#fafafa",borderRadius:14,padding:16}}>
                  <div style={{fontSize:18,marginBottom:6}}>{ic}</div>
                  <div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:11,color:"#8e8e93",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </>)}

        {/* ══ MARATHON ══ */}
        {tab==="marathon" && (<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <h2 style={{fontSize:22,fontWeight:700,letterSpacing:"-0.3px",margin:0}}>🏃 Marathon Tracker</h2>
              <p style={{color:"#8e8e93",fontSize:14,marginTop:4,marginBottom:0}}>April · May · June 2026 — Race Day: June 20, 2026</p>
            </div>
            <button style={S.sbtn("#5e5ce6")} onClick={()=>setLogOpen(!logOpen)}>+ Log Run</button>
          </div>

          {/* Countdown banner */}
          <div style={{background:"linear-gradient(135deg,#1c1c1e,#2c2c2e)",borderRadius:20,padding:"24px 28px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,color:"#8e8e93",fontWeight:600,letterSpacing:"0.6px",textTransform:"uppercase",marginBottom:6}}>Race Day Countdown</div>
              <div style={{fontSize:48,fontWeight:700,color:"white",letterSpacing:"-2px",lineHeight:1}}>{daysUntilRace}<span style={{fontSize:18,fontWeight:400,color:"#8e8e93",marginLeft:6}}>days</span></div>
              <div style={{fontSize:13,color:"#8e8e93",marginTop:4}}>June 20, 2026 · {weeksUntilRace} weeks away</div>
            </div>
            <div style={{textAlign:"right"}}>
              {/* Pre-training: show plan countdown */}
              <div style={{fontSize:11,color:"#8e8e93",marginBottom:6,letterSpacing:"0.4px",textTransform:"uppercase"}}>Training Begins</div>
              <div style={{fontSize:40,fontWeight:700,color:"#5e5ce6",letterSpacing:"-1px"}}>{daysUntilPlan}</div>
              <div style={{fontSize:12,color:"#8e8e93"}}>days · April 6, 2026</div>
              <div style={{width:180,background:"#3a3a3c",borderRadius:99,height:6,marginTop:10,marginLeft:"auto"}}>
                <div style={{width:"0%",height:"100%",background:"#5e5ce6",borderRadius:99}}/>
              </div>
              <div style={{fontSize:11,color:"#8e8e93",marginTop:4}}>0 of 11 weeks complete</div>
            </div>
          </div>

          {/* Pre-training notice */}
          <div style={{...S.card,marginBottom:16,background:"linear-gradient(135deg,#f0f0ff,#e8e8ff)",border:"1.5px solid #5e5ce6"}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <span style={{fontSize:40}}>📋</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Your 11-Week Training Plan is Ready</div>
                <div style={{fontSize:13,color:"#6e6e80",lineHeight:1.6}}>
                  Training kicks off <strong style={{color:"#5e5ce6"}}>April 6, 2026</strong> — just {daysUntilPlan} days away.
                  Use this time to build your base, stay consistent with easy runs, and nail your sleep & nutrition.
                </div>
              </div>
              <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:28,fontWeight:700,color:"#5e5ce6"}}>11</div>
                <div style={{fontSize:11,color:"#8e8e93"}}>weeks</div>
                <div style={{fontSize:11,color:"#8e8e93"}}>to race</div>
              </div>
            </div>
          </div>

          {/* Log run form */}
          {logOpen && (
            <div style={{...S.card,marginBottom:16,border:"1.5px solid #5e5ce6"}}>
              <div style={S.ct}>Log a Run</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:"#8e8e93",marginBottom:4}}>Training Week</div>
                  <select style={{...S.sel,width:"100%"}} value={newRun.week} onChange={e=>setNewRun({...newRun,week:e.target.value})}>
                    {trainingPlan.map(w=><option key={w.week} value={w.week}>Week {w.week} ({w.dates})</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#8e8e93",marginBottom:4}}>Distance (miles) *</div>
                  <input style={S.inp} type="number" step="0.1" placeholder="e.g. 8.5" value={newRun.miles} onChange={e=>setNewRun({...newRun,miles:e.target.value})}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#8e8e93",marginBottom:4}}>Avg Pace (min/mi)</div>
                  <input style={S.inp} placeholder="e.g. 9:30" value={newRun.pace} onChange={e=>setNewRun({...newRun,pace:e.target.value})}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#8e8e93",marginBottom:4}}>Run Type</div>
                  <select style={{...S.sel,width:"100%"}} value={newRun.type} onChange={e=>setNewRun({...newRun,type:e.target.value})}>
                    {["Easy","Tempo","Midweek","Long Run"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <input style={{...S.inp,marginBottom:12}} placeholder="Notes (optional)..." value={newRun.notes} onChange={e=>setNewRun({...newRun,notes:e.target.value})}/>
              <div style={{display:"flex",gap:10}}>
                <button style={S.sbtn("#5e5ce6")} onClick={addRun}>Save Run</button>
                <button style={S.sbtn("#8e8e93",true)} onClick={()=>setLogOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* View toggle */}
          <div style={{display:"flex",gap:6,marginBottom:16,background:"white",padding:4,borderRadius:12,width:"fit-content",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            {["weekly","monthly"].map(v=>(
              <button key={v} onClick={()=>setMView(v)} style={{padding:"7px 18px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,background:mView===v?"#5e5ce6":"transparent",color:mView===v?"white":"#6e6e80",transition:"all 0.2s"}}>
                {v.charAt(0).toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>

          {/* ── WEEKLY ── */}
          {mView==="weekly" && (
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div style={S.ct}>11-Week Training Plan · Apr–Jun 2026</div>
                <div style={{display:"flex",gap:12,fontSize:12,color:"#8e8e93"}}>
                  {[["#5e5ce6","April"],["#ff6b35","May"],["#30d158","June"]].map(([c,l])=>(
                    <span key={l}><span style={{display:"inline-block",width:10,height:10,background:c,borderRadius:2,marginRight:4}}/>{l}</span>
                  ))}
                </div>
              </div>
              {/* Bar chart — all upcoming, no logged yet */}
              <div style={{display:"flex",alignItems:"flex-end",gap:5,height:110,marginBottom:10}}>
                {weekMiles.map(({week,planned,logged,month})=>{
                  const mc=monthColor[month];
                  return (
                    <div key={week} onClick={()=>setSelWeek(week)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}}>
                      <div style={{width:"100%",position:"relative",height:`${(planned/maxWkMiles)*100}px`,borderRadius:"4px 4px 0 0",background:mc+"25",overflow:"hidden",border:`1px solid ${mc}40`}}>
                        {logged>0 && <div style={{position:"absolute",bottom:0,width:"100%",height:`${(logged/maxWkMiles)*100}px`,background:mc,borderRadius:"4px 4px 0 0",transition:"height 0.5s"}}/>}
                        {week===selWeek && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:mc}}/>}
                      </div>
                      <span style={{fontSize:8,color:week===selWeek?mc:"#c7c7cc",fontWeight:week===selWeek?700:400}}>W{week}</span>
                    </div>
                  );
                })}
              </div>
              {/* Month band */}
              <div style={{display:"grid",gridTemplateColumns:"4fr 5fr 2fr",gap:5,marginBottom:16}}>
                {["April","May","June"].map(m=>(
                  <div key={m} style={{textAlign:"center",fontSize:11,fontWeight:600,color:monthColor[m],background:monthColor[m]+"12",borderRadius:6,padding:"3px 0"}}>{m}</div>
                ))}
              </div>
              {/* Selected week detail */}
              <div style={{background:"#fafafa",borderRadius:14,padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>Week {selWeek} — {selPlan.label}</div>
                    <div style={{fontSize:12,color:"#8e8e93",marginTop:2}}>{selPlan.dates}</div>
                  </div>
                  <span style={{...S.pill(monthColor[selPlan.month])}}>{selPlan.month}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  {[["Easy",selPlan.easy,"🟢"],["Tempo",selPlan.tempo,"🔴"],["Midweek",selPlan.midweek,"🔵"],["Long Run",selPlan.long,"🟠"]].map(([type,miles,icon])=>(
                    <div key={type} style={{background:"white",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                      <div>{icon}</div>
                      <div style={{fontSize:14,fontWeight:700,marginTop:4}}>{miles} mi</div>
                      <div style={{fontSize:10,color:"#8e8e93"}}>{type}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12,display:"flex",justifyContent:"space-between",fontSize:13,color:"#8e8e93"}}>
                  <span>Total planned</span><span style={{fontWeight:600,color:"#1c1c1e"}}>{selTotal} miles</span>
                </div>
                {/* Long run callout */}
                <div style={{marginTop:10,background:"white",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,border:"1.5px solid #fff3e0"}}>
                  <span style={{fontSize:20}}>🟠</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#e65100"}}>Weekend Long Run</div>
                    <div style={{fontSize:11,color:"#8e8e93"}}>{selPlan.long === 26 ? "26.2 miles — Race Day! 🏁" : `${selPlan.long} miles · Saturday or Sunday`}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MONTHLY ── */}
          {mView==="monthly" && (<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
              {monthRanges.map(({label,color,wks,status})=>{
                const planned=trainingPlan.filter(w=>wks.includes(w.week)).reduce((s,w)=>s+w.easy+w.tempo+w.midweek+w.long,0);
                const logged=runs.filter(r=>wks.includes(r.week)).reduce((s,r)=>s+r.miles,0);
                const longs=wks.map(w=>trainingPlan[w-1].long);
                return (
                  <div key={label} style={{...S.card}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div style={{fontWeight:700,fontSize:16}}>{label} 2026</div>
                      <span style={{background:color+"18",color,borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:600}}>{status}</span>
                    </div>
                    <div style={{fontSize:30,fontWeight:700,color,letterSpacing:"-0.5px",marginBottom:2}}>
                      {logged>0?logged.toFixed(0):"—"}<span style={{fontSize:14,color:"#8e8e93",fontWeight:400}}>/{planned} mi planned</span>
                    </div>
                    <div style={{background:"#f0f0f5",borderRadius:99,height:6,overflow:"hidden",marginBottom:12,marginTop:8}}>
                      <div style={{width:`${Math.min(logged/planned*100,100)}%`,height:"100%",background:color,borderRadius:99}}/>
                    </div>
                    <div style={{fontSize:11,color:"#8e8e93",marginBottom:10}}>Long runs: {longs.map(l=>l===26?"26.2🏁":`${l}mi`).join(" → ")}</div>
                    {/* Weekend dots */}
                    <div style={{display:"flex",gap:5}}>
                      {wks.map((w,i)=>{
                        const done=runs.some(r=>r.week===w&&r.type==="Long Run");
                        return (
                          <div key={i} style={{flex:1,background:done?color:color+"15",borderRadius:8,padding:"8px 4px",textAlign:"center",border:`1px solid ${color}30`}}>
                            <div style={{fontSize:longs[i]===26?9:11,fontWeight:700,color:done?"white":color}}>{longs[i]===26?"26.2🏁":`${longs[i]}mi`}</div>
                            <div style={{fontSize:8,color:done?"rgba(255,255,255,0.7)":color+"80"}}>Wk{w}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full long run schedule */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={S.ct}>Complete Long Run Schedule — Apr–Jun 2026</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(11,1fr)",gap:6}}>
                {trainingPlan.map(w=>{
                  const mc=monthColor[w.month];
                  const done=runs.some(r=>r.week===w.week&&r.type==="Long Run");
                  return (
                    <div key={w.week} style={{borderRadius:10,padding:"10px 6px",textAlign:"center",background:done?mc+"22":mc+"10",border:`1px solid ${mc}35`}}>
                      <div style={{fontSize:9,color:"#8e8e93",marginBottom:2}}>Wk{w.week}</div>
                      <div style={{fontSize:w.long===26?9:13,fontWeight:700,color:done?mc:mc+"cc"}}>{done?"✓":w.long===26?"🏁 26.2":`${w.long}mi`}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"4fr 5fr 2fr",gap:6,marginTop:8}}>
                {["April","May","June"].map(m=>(
                  <div key={m} style={{textAlign:"center",fontSize:11,fontWeight:600,color:monthColor[m],background:monthColor[m]+"12",borderRadius:6,padding:"4px 0"}}>{m}</div>
                ))}
              </div>
            </div>
          </>)}
        </>)}

        {/* ══ NUTRITION ══ */}
        {tab==="nutrition" && (<>
          <h2 style={{fontSize:22,fontWeight:700,letterSpacing:"-0.3px",marginBottom:4}}>Nutrition Tracker</h2>
          <p style={{color:"#8e8e93",fontSize:14,marginBottom:20}}>Snap a photo of your meal for instant AI analysis.</p>
          <div style={{...S.card,marginBottom:16}}>
            <div style={S.ct}>Today's Totals</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
              {[["Calories",totalCals,`/ ${calGoal}`,"#ff9f0a"],["Protein",`${totalProtein}g`,"/ 180g","#ff3b30"],["Carbs",`${totalCarbs}g`,"/ 300g","#007aff"],["Fat",`${totalFat}g`,"/ 80g","#30d158"]].map(([l,v,g,c])=>(
                <div key={l} style={{background:"#fafafa",borderRadius:14,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:"#8e8e93",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.3px"}}>{l}</div>
                  <div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:11,color:"#c7c7cc"}}>{g}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.ct}>Log a Meal</div>
            {!uploadedImage ? (
              <div style={S.dz(dragOver)} onClick={()=>fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}>
                <div style={{fontSize:40,marginBottom:10}}>📷</div>
                <div style={{fontSize:15,fontWeight:600,color:"#1c1c1e",marginBottom:4}}>Drop a meal photo here</div>
                <div style={{fontSize:13,color:"#8e8e93"}}>or click to browse · JPG, PNG, HEIC</div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>
            ) : (
              <div style={{marginBottom:16}}>
                <img src={uploadedImage} alt="meal" style={{width:"100%",maxHeight:240,objectFit:"cover",borderRadius:12,marginBottom:12}}/>
                {!analysisResult && <button style={S.btn()} onClick={analyzeImage} disabled={analyzing}>{analyzing?"🔍 Analyzing...":"✨ Analyze with AI"}</button>}
              </div>
            )}
            {analysisResult && !analysisResult.error && (
              <div style={{background:"#f7f7fa",borderRadius:14,padding:16,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <span style={{fontSize:32}}>{analysisResult.emoji}</span>
                  <div><div style={{fontWeight:700,fontSize:17}}>{analysisResult.name}</div><div style={{fontSize:13,color:"#8e8e93"}}>AI estimate</div></div>
                  <div style={{marginLeft:"auto",textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:700,color:"#ff9f0a"}}>{analysisResult.calories}</div>
                    <div style={{fontSize:11,color:"#8e8e93"}}>kcal</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {[["P",analysisResult.protein,"#ff3b30"],["C",analysisResult.carbs,"#007aff"],["F",analysisResult.fat,"#30d158"]].map(([l,v,c])=>(
                    <div key={l} style={{flex:1,background:"white",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:c}}>{v}g</div>
                      <div style={{fontSize:10,color:"#8e8e93"}}>{l==="P"?"Protein":l==="C"?"Carbs":"Fat"}</div>
                    </div>
                  ))}
                </div>
                <select value={newTag} onChange={e=>setNewTag(e.target.value)} style={{...S.sel,width:"100%",marginBottom:10}}>
                  {["Breakfast","Lunch","Dinner","Snack"].map(t=><option key={t}>{t}</option>)}
                </select>
                <input style={{...S.inp,marginBottom:10}} placeholder="Add a note..." value={newNote} onChange={e=>setNewNote(e.target.value)}/>
                <div style={{display:"flex",gap:10}}>
                  <button style={S.btn("#30d158")} onClick={addMeal}>✓ Add to Log</button>
                  <button style={S.btn("#8e8e93")} onClick={()=>{setUploadedImage(null);setUploadedImageData(null);setAnalysisResult(null);}}>Retake</button>
                </div>
              </div>
            )}
            {analysisResult?.error && <div style={{color:"#ff3b30",fontSize:13,padding:"10px 14px",background:"#fff0f0",borderRadius:10}}>{analysisResult.error}</div>}
          </div>
          <div style={{marginTop:20}}>
            <div style={{fontSize:13,fontWeight:600,color:"#8e8e93",letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:12}}>Meal History</div>
            {meals.map(meal=>(
              <div key={meal.id} style={S.mc}>
                <div style={{fontSize:30,flexShrink:0}}>{meal.emoji}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:15}}>{meal.name}</span><Tag label={meal.tag}/>
                  </div>
                  {meal.notes && <div style={{fontSize:12,color:"#8e8e93",marginBottom:3}}>{meal.notes}</div>}
                  <div style={{fontSize:11,color:"#c7c7cc"}}>{meal.time}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:"#ff9f0a"}}>{meal.calories}</div>
                  <div style={{fontSize:10,color:"#8e8e93"}}>kcal</div>
                  <div style={{fontSize:11,color:"#c7c7cc",marginTop:2}}>P{meal.protein} C{meal.carbs} F{meal.fat}</div>
                </div>
              </div>
            ))}
          </div>
        </>)}

      </main>
    </div>
  );
}
