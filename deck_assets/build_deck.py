#!/usr/bin/env python3
"""Generate the redesigned StudyStrike pitch deck (.pptx)."""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Palette ──
NAVY=RGBColor(0x0F,0x34,0x60); NAVY2=RGBColor(0x1A,0x54,0x90)
TEAL=RGBColor(0x0D,0x73,0x77); TEALL=RGBColor(0x14,0xA0,0x85)
GOLD=RGBColor(0xF5,0xA6,0x23); GOLDL=RGBColor(0xFF,0xD1,0x66)
GREY=RGBColor(0x6B,0x7F,0x99); TEXT=RGBColor(0x1A,0x25,0x40)
BG=RGBColor(0xF8,0xFA,0xFD); WHITE=RGBColor(0xFF,0xFF,0xFF)
BORDER=RGBColor(0xE2,0xEA,0xF4); RED=RGBColor(0xE8,0x4A,0x5F)
CREAMCARD=RGBColor(0xEE,0xF4,0xFD); TEALBG=RGBColor(0xE7,0xF7,0xF2)

prs=Presentation()
prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5)
BLANK=prs.slide_layouts[6]
SW,SH=prs.slide_width,prs.slide_height

def slide():
    s=prs.slides.add_slide(BLANK)
    r=s.shapes.add_shape(MSO_SHAPE.RECTANGLE,0,0,SW,SH)
    r.fill.solid(); r.fill.fore_color.rgb=BG; r.line.fill.background()
    r.shadow.inherit=False
    return s

def box(s,x,y,w,h,fill=None,line=None,line_w=1.0,round=False,shadow=False):
    shp=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if round else MSO_SHAPE.RECTANGLE,
                           Inches(x),Inches(y),Inches(w),Inches(h))
    if fill is None: shp.fill.background()
    else: shp.fill.solid(); shp.fill.fore_color.rgb=fill
    if line is None: shp.line.fill.background()
    else: shp.line.color.rgb=line; shp.line.width=Pt(line_w)
    shp.shadow.inherit=False
    return shp

def txt(s,x,y,w,h,runs,align=PP_ALIGN.LEFT,anchor=MSO_ANCHOR.TOP,sp_after=4,line_sp=1.0):
    tb=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
    tf=tb.text_frame; tf.word_wrap=True; tf.vertical_anchor=anchor
    tf.margin_left=Inches(0.05);tf.margin_right=Inches(0.05);tf.margin_top=Inches(0.02);tf.margin_bottom=Inches(0.02)
    if isinstance(runs[0],tuple): runs=[runs]
    for i,para in enumerate(runs):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph()
        p.alignment=align; p.space_after=Pt(sp_after); p.space_before=Pt(0); p.line_spacing=line_sp
        for (t,sz,col,bold) in para:
            r=p.add_run(); r.text=t; r.font.size=Pt(sz); r.font.color.rgb=col
            r.font.bold=bold; r.font.name='Segoe UI'
    return tb

def header(s,kicker,claim,claim2=None):
    box(s,0,0,13.333,0.16,fill=GOLD)
    txt(s,0.55,0.34,12.2,0.4,[[(kicker,13,TEAL,True)]])
    rows=[[(claim,30,NAVY,True)]]
    if claim2: rows.append([(claim2,30,NAVY,True)])
    txt(s,0.55,0.62,12.2,1.0,rows,line_sp=1.0)

def chip(s,x,y,w,txt_runs,fill=CREAMCARD,line=BORDER,h=0.55):
    box(s,x,y,w,h,fill=fill,line=line,round=True)
    txt(s,x+0.12,y,w-0.24,h,txt_runs,anchor=MSO_ANCHOR.MIDDLE)

def kpi(s,x,y,w,big,label,h=1.5,big_col=NAVY2,fill=WHITE):
    box(s,x,y,w,h,fill=fill,line=BORDER,round=True)
    txt(s,x+0.1,y+0.18,w-0.2,0.7,[[(big,34,big_col,True)]],align=PP_ALIGN.CENTER)
    txt(s,x+0.1,y+0.92,w-0.2,h-0.95,[[(label,12,GREY,False)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.TOP)

def footer(s,note):
    txt(s,0.55,7.08,12.2,0.35,[[(note,9.5,GREY,False)]])

# ════════════════════ SLIDE 1 — TITLE ════════════════════
s=slide()
box(s,0,0,13.333,7.5,fill=NAVY)
box(s,0,0,13.333,7.5,fill=None)
# gradient-ish band
box(s,0,5.0,13.333,2.5,fill=RGBColor(0x0A,0x1E,0x3C))
box(s,0.7,0.7,1.0,1.0,fill=GOLD,round=True)
txt(s,0.7,0.72,1.0,1.0,[[("SS",24,NAVY,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
txt(s,1.85,0.72,8,0.9,[[("StudyStrike",30,WHITE,True)],[("Compete. Excel. Succeed.",14,GOLDL,False)]])
txt(s,0.7,2.15,12,1.6,[[("What if studying felt like a game",46,WHITE,True)],
                       [("you couldn't afford to lose?",46,GOLDL,True)]],line_sp=1.02)
txt(s,0.72,3.95,12,0.5,[[("Verified focus. Real grade rewards. A productivity platform UAE students actually stick with.",17,RGBColor(0xC5,0xDA,0xF0),False)]])
# team persona tags
team=[("Mohamed Fares","Product & Vision"),("Ayman Hanoun","Front-end & UX"),
      ("Faisal Ahmed","Market Research"),("Ahmed Nabil","Backend & Data"),
      ("Omar Mahmoud","Customer Development"),("Mohamed Ali","Business Model")]
x=0.7
for i,(n,role) in enumerate(team):
    col=i%3; rowi=i//3
    bx=0.7+col*4.1; by=5.25+rowi*0.78
    box(s,bx,by,3.9,0.66,fill=RGBColor(0x14,0x3E,0x78),line=RGBColor(0x2E,0x72,0xB8),round=True)
    txt(s,bx+0.18,by+0.06,3.6,0.6,[[(n,14,WHITE,True)],[(role,11,GOLDL,False)]])
txt(s,0.72,6.95,12,0.4,[[("FWS310 — Fundamentals of Innovation & Entrepreneurship  |  Spring 2025–2026  |  Instructor: Abdelrahman El Adly",11,RGBColor(0x9F,0xC3,0xE8),False)]])

# ════════════════════ SLIDE 2 — PROBLEM ════════════════════
s=slide()
header(s,"THE PROBLEM","Students don't lack intent — they lack a system","that turns knowing into doing")
# hero stat
box(s,0.55,1.85,3.7,2.0,fill=NAVY,round=True)
txt(s,0.55,2.05,3.7,1.0,[[("73%",60,GOLDL,True)]],align=PP_ALIGN.CENTER)
txt(s,0.7,3.15,3.4,0.7,[[("of students miss at least one deadline every semester",14,WHITE,False)]],align=PP_ALIGN.CENTER)
kpi(s,4.5,1.85,2.4,"5+ hrs","lost weekly to poor prioritisation & procrastination",h=2.0)
kpi(s,7.1,1.85,2.4,"2 in 3","say their tools don't fit their real-life schedule",h=2.0)
kpi(s,9.7,1.85,3.0,"$1.4B","global edtech-productivity market, growing 9.1%/yr",h=2.0,big_col=TEAL)
# pain points
txt(s,0.55,4.1,8,0.4,[[("Four root causes we kept hearing",16,TEXT,True)]])
pains=[("Procrastination","Students delay starting even when the deadline is known."),
       ("Emotional barriers","Anxiety & guilt block action — not a lack of knowledge."),
       ("Broken tools","Planners need constant manual upkeep, so they get abandoned."),
       ("One size fits none","Commuters, workers, ESL learners — generic tools fail them all.")]
for i,(t,d) in enumerate(pains):
    bx=0.55+i*3.07
    box(s,bx,4.55,2.9,2.0,fill=WHITE,line=BORDER,round=True)
    box(s,bx,4.55,2.9,0.08,fill=RED)
    txt(s,bx+0.2,4.75,2.5,0.5,[[(t,15,NAVY,True)]])
    txt(s,bx+0.2,5.3,2.55,1.2,[[(d,12.5,GREY,False)]],line_sp=1.05)
footer(s,"Sources: UAE student time-management survey (n=120, 2025); Statista EdTech productivity market, 2023.")

# ════════════════════ SLIDE 3 — INSIGHTS ════════════════════
s=slide()
header(s,"WHAT THE RESEARCH TOLD US","Four insights that point to one belief")
ins=[("01","Knowing ≠ Acting","Students know deadlines but have no system that converts them into a daily start-point."),
     ("02","It's emotional","Procrastination is an emotion-regulation problem — tasks must be made to feel manageable."),
     ("03","Maintenance overload","Manual planners pile admin onto academic load. Auto-sync isn't a nice-to-have — it's essential."),
     ("04","No one-size solution","Commuters, ESL learners and club leaders all need adaptive, context-aware scheduling.")]
for i,(num,t,d) in enumerate(ins):
    col=i%2; rowi=i//2
    bx=0.55+col*6.15; by=1.85+rowi*2.35
    box(s,bx,by,5.9,2.05,fill=WHITE,line=BORDER,round=True)
    box(s,bx,by,1.2,2.05,fill=CREAMCARD)
    txt(s,bx,by,1.2,2.05,[[(num,40,NAVY2,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
    txt(s,bx+1.45,by+0.32,4.2,0.5,[[(t,18,NAVY,True)]])
    txt(s,bx+1.45,by+0.92,4.25,1.0,[[(d,13.5,GREY,False)]],line_sp=1.08)
txt(s,0.55,6.5,12,0.5,[[("These four insights converge on a single conviction → ",15,TEAL,True),("our Golden Circle.",15,NAVY,True)]])

# ════════════════════ SLIDE 4 — GOLDEN CIRCLE ════════════════════
s=slide()
header(s,"OUR WHY","We start with why students don't act")
s.shapes.add_picture(os.path.join(HERE,"golden_circle.png"),Inches(0.4),Inches(1.45),height=Inches(5.7))

# ════════════════════ SLIDE 5 — INTRODUCING ════════════════════
s=slide()
header(s,"THE SOLUTION","Introducing StudyStrike")
box(s,0.55,1.9,6.1,4.6,fill=NAVY,round=True)
txt(s,0.95,2.35,5.4,3.5,[[("A gamified academic platform that turns assignment management into a motivating, competitive game —",22,WHITE,True)],
    [("",8,WHITE,False)],
    [("helping UAE students start earlier, stay focused, and hit every deadline.",22,GOLDL,True)]],line_sp=1.1)
txt(s,7.0,1.95,5.8,0.5,[[("The 'How Might We?' questions that shaped it",15,TEXT,True)]])
hmw=["Help students stay focused without social-media distractions?",
     "Motivate with streaks, rewards, and live leaderboards?",
     "Give one single view of every deadline and task?",
     "Push students to start early instead of last-minute?",
     "Adapt to each student's unique schedule and habits?"]
for i,q in enumerate(hmw):
    by=2.5+i*0.82
    box(s,7.0,by,0.6,0.6,fill=TEALL,round=True)
    txt(s,7.0,by,0.6,0.6,[[(str(i+1),18,WHITE,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
    txt(s,7.75,by,5.05,0.65,[[(q,13.5,TEXT,False)]],anchor=MSO_ANCHOR.MIDDLE,line_sp=1.0)

# ════════════════════ SLIDE 6 — CORE FEATURES ════════════════════
s=slide()
header(s,"CORE FEATURES","Built around one moat: verified effort that earns real rewards")
feats=[("🔒 Verified Focus Monitor","Webcam + screen presence confirm real focus — points are earned, not gamed.",GOLD,True),
       ("🏆 Grade-linked Leaderboard","Live weekly rankings per course. Top performers earn up to +2% on their grade.",TEAL,True),
       ("🔥 Streak System","A daily study streak builds momentum and habit through visual consistency.",NAVY2,True),
       ("📋 Smart Task Prioritiser","Auto-sorted task list with urgency labels, progress bars and time estimates.",NAVY2,False),
       ("📈 Predictions & Stats","Grade and rank projection over the next four weeks to keep students ahead.",NAVY2,False),
       ("🧑‍🏫 Instructor Dashboard","Teachers see progress, focus % and at-risk students — and apply the bonuses.",NAVY2,False)]
for i,(t,d,col,hero) in enumerate(feats):
    cx=0.55+(i%3)*4.12; cy=1.9+(i//3)*2.3
    box(s,cx,cy,3.95,2.05,fill=WHITE,line=BORDER,round=True)
    box(s,cx,cy,3.95,0.1,fill=col)
    txt(s,cx+0.22,cy+0.28,3.6,0.7,[[(t,15.5,NAVY,True)]],line_sp=0.95)
    txt(s,cx+0.22,cy+1.05,3.55,0.95,[[(d,12.5,GREY,False)]],line_sp=1.05)
    if hero:
        box(s,cx+3.0,cy+0.18,0.78,0.34,fill=GOLDL,round=True)
        txt(s,cx+3.0,cy+0.18,0.78,0.34,[[("MOAT",9,NAVY,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)

# ════════════════════ SLIDE 7 — WORKFLOW ════════════════════
s=slide()
header(s,"USER JOURNEY","From sign-up to habit in six steps")
steps=[("1","Register & link LMS","Connect Blackboard / MyADU"),
       ("2","Tasks auto-imported","Deadlines pulled in & prioritised"),
       ("3","Verified study session","Focus Monitor on · points per minute"),
       ("4","Points & streak update","Streak +1 · leaderboard refreshes"),
       ("5","Review predictions","4-week projected rank & grade"),
       ("6","Earn grade bonus","Top finish → instructor applies bonus")]
for i,(n,t,d) in enumerate(steps):
    cx=0.55+(i%3)*4.12; cy=2.0+(i//3)*2.3
    hero = (n=="3")
    box(s,cx,cy,3.7,1.9,fill=(NAVY if hero else WHITE),line=(GOLD if hero else BORDER),line_w=(2 if hero else 1),round=True)
    circ_col=GOLD if hero else NAVY2
    box(s,cx+0.25,cy+0.3,0.7,0.7,fill=circ_col,round=True)
    txt(s,cx+0.25,cy+0.3,0.7,0.7,[[(n,22,(NAVY if hero else WHITE),True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
    tc=WHITE if hero else NAVY; dc=GOLDL if hero else GREY
    txt(s,cx+1.1,cy+0.32,2.5,0.7,[[(t,15,tc,True)]],line_sp=0.95)
    txt(s,cx+1.1,cy+1.0,2.5,0.8,[[(d,11.5,dc,False)]],line_sp=1.0)
    if i%3!=2 and i!=5:
        txt(s,cx+3.72,cy+0.5,0.4,0.6,[[("→",24,GREY,True)]],align=PP_ALIGN.CENTER)
txt(s,0.55,6.55,12,0.5,[[("Step 3 is the magic moment — ",13.5,GOLD,True),("verified focus is what makes every point trustworthy.",13.5,TEXT,False)]])

# ════════════════════ SLIDE 8 — PROTOTYPE 1 ════════════════════
s=slide()
header(s,"PROTOTYPE — LIVE BUILD","This isn't a mock-up. The product runs today.")
# Left: focus dashboard
box(s,0.55,1.9,6.0,4.7,fill=WHITE,line=BORDER,round=True)
txt(s,0.8,2.1,5.5,0.4,[[("Focus Dashboard — home view",14,NAVY,True)]])
kpi(s,0.8,2.6,2.6,"🔥 19","day streak",h=1.3,big_col=GOLD)
kpi(s,3.6,2.6,2.7,"⭐ 3,850","total points",h=1.3)
txt(s,0.8,4.05,5.5,0.4,[[("Current semester rewards",12.5,GREY,True)]])
rw=[("1st","+2%"),("2nd","+1.5%"),("3rd","+1%"),("Top 10","+0.5%")]
for i,(r,b) in enumerate(rw):
    bx=0.8+i*1.42
    box(s,bx,4.5,1.32,1.7,fill=BG,line=BORDER,round=True)
    box(s,bx,4.5,1.32,0.07,fill=GOLD)
    txt(s,bx,4.65,1.32,0.5,[[(r,15,NAVY,True)]],align=PP_ALIGN.CENTER)
    txt(s,bx,5.2,1.32,0.5,[[(b,17,TEAL,True)]],align=PP_ALIGN.CENTER)
    txt(s,bx,5.7,1.32,0.4,[[("grade",10,GREY,False)]],align=PP_ALIGN.CENTER)
# Right: leaderboard
box(s,6.75,1.9,6.0,4.7,fill=WHITE,line=BORDER,round=True)
txt(s,7.0,2.1,5.5,0.4,[[("Leaderboard — weekly rankings",14,NAVY,True)]])
lb=[("🥇","Alex Chen","28d","4,520","+2.0%",False),("🥈","Jordan Smith","24d","4,180","+1.5%",False),
    ("🥉","You","19d","3,850","+1.0%",True),("#4","Morgan Lee","15d","3,620","+0.5%",False),
    ("#5","Casey Brown","12d","3,210","+0.5%",False)]
for i,(m,n,st,pts,bon,me) in enumerate(lb):
    by=2.6+i*0.74
    box(s,7.0,by,5.5,0.66,fill=(CREAMCARD if me else WHITE),line=(NAVY2 if me else BORDER),round=True)
    txt(s,7.12,by,0.7,0.66,[[(m,15,NAVY,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
    txt(s,7.85,by,2.3,0.66,[[((n+(" (You)" if me else "")),13,NAVY,me)]],anchor=MSO_ANCHOR.MIDDLE)
    txt(s,10.0,by,1.0,0.66,[[("🔥 "+st,11,GREY,False)]],anchor=MSO_ANCHOR.MIDDLE)
    txt(s,10.95,by,0.9,0.66,[[(pts,12.5,NAVY2,True)]],anchor=MSO_ANCHOR.MIDDLE,align=PP_ALIGN.RIGHT)
    txt(s,11.85,by,0.6,0.66,[[(bon,11,TEAL,True)]],anchor=MSO_ANCHOR.MIDDLE,align=PP_ALIGN.RIGHT)
footer(s,"Live demo available: the verified Focus Monitor flips green → red the moment a student looks away or opens off-task content.")

# ════════════════════ SLIDE 9 — PROTOTYPE 2 ════════════════════
s=slide()
header(s,"PROTOTYPE — ANALYTICS & TASKS","Predictions keep students ahead; the task view tells them what to do next")
box(s,0.55,1.9,6.0,4.7,fill=WHITE,line=BORDER,round=True)
txt(s,0.8,2.1,5.5,0.4,[[("Predictions & stats",14,NAVY,True)]])
for i,(v,l) in enumerate([("3,850","Total Points"),("19d","Streak"),("110%","Weekly Goal"),("92%","On-Time")]):
    bx=0.8+(i%2)*2.85; by=2.55+(i//2)*1.0
    txt(s,bx,by,2.7,0.45,[[(v,20,NAVY2,True)]])
    txt(s,bx,by+0.42,2.7,0.35,[[(l,11.5,GREY,False)]])
txt(s,0.8,4.7,5.5,0.4,[[("Predicted performance (next 4 weeks)",12.5,GREY,True)]])
pred=[("W1","~550","3rd"),("W2","~605","3rd"),("W3","~680","2nd"),("W4","~745","1st")]
for i,(w,p,r) in enumerate(pred):
    bx=0.8+i*1.42
    box(s,bx,5.15,1.32,1.1,fill=CREAMCARD,line=BORDER,round=True)
    txt(s,bx,5.22,1.32,0.4,[[(w,11,GREY,True)]],align=PP_ALIGN.CENTER)
    txt(s,bx,5.55,1.32,0.4,[[(p,15,NAVY,True)]],align=PP_ALIGN.CENTER)
    txt(s,bx,5.95,1.32,0.35,[[(r,11,TEAL,True)]],align=PP_ALIGN.CENTER)
# tasks
box(s,6.75,1.9,6.0,4.7,fill=WHITE,line=BORDER,round=True)
txt(s,7.0,2.1,5.5,0.4,[[("Task progress — prioritised",14,NAVY,True)]])
tasks=[("Due soon","Advanced Calculus – Problem Set 5","MATH 401 · 85% · Today 11:59 PM · 100 pts",RED),
       ("Urgent","Organic Chemistry Midterm","CHEM 301 · 30% · Tomorrow 2 PM · 250 pts",GOLD),
       ("Upcoming","Physics Pop Quiz","PHYS 200 · 0% · In 2 days · 50 pts",TEALL)]
for i,(lab,t,d,col) in enumerate(tasks):
    by=2.6+i*1.25
    box(s,7.0,by,5.5,1.1,fill=BG,line=BORDER,round=True)
    box(s,7.0,by,0.09,1.1,fill=col)
    box(s,11.3,by+0.18,1.05,0.36,fill=col,round=True)
    txt(s,11.3,by+0.18,1.05,0.36,[[(lab,9.5,WHITE,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
    txt(s,7.25,by+0.2,4.0,0.45,[[(t,13,NAVY,True)]])
    txt(s,7.25,by+0.66,4.9,0.4,[[(d,11,GREY,False)]])

# ════════════════════ SLIDE 10 — PILOT ════════════════════
s=slide()
header(s,"VALIDATION","Our 5-student pilot proved the hook — and showed us what to build next")
txt(s,0.55,1.55,12,0.4,[[("5 students · 1 week · Google Form + WhatsApp leaderboard simulation",13,GREY,True)]])
for i,(v,l) in enumerate([("5/5","found tasks easier to complete vs. the prior week"),
                          ("3/5","named leaderboard competition as their main motivator"),
                          ("1","did extra revision purely to protect a streak"),
                          ("2/5","used prioritisation to choose what to tackle first")]):
    bx=0.55+i*3.07
    box(s,bx,2.0,2.9,1.7,fill=NAVY if i==0 else WHITE,line=BORDER,round=True)
    txt(s,bx,2.2,2.9,0.6,[[(v,30,GOLDL if i==0 else NAVY2,True)]],align=PP_ALIGN.CENTER)
    txt(s,bx+0.15,2.85,2.6,0.8,[[(l,11.5,WHITE if i==0 else GREY,False)]],align=PP_ALIGN.CENTER,line_sp=1.0)
# issues -> fixes table
txt(s,0.55,3.95,12,0.4,[[("Every issue raised, we've since acted on",16,TEXT,True)]])
rows=[("Issue raised","Proposed / built fix"),
      ("Manual Google-Form entry was clunky","Native in-app task logging + LMS auto-sync"),
      ("No way to stop point-cheating","✓ BUILT: verified Focus Monitor (webcam + screen)"),
      ("Streak lost if internet dropped","Offline mode + streak-freeze (roadmap)")]
for i,(a,b) in enumerate(rows):
    by=4.5+i*0.62
    hdr=i==0
    box(s,0.55,by,5.9,0.58,fill=NAVY if hdr else WHITE,line=BORDER)
    box(s,6.55,by,6.2,0.58,fill=NAVY if hdr else (TEALBG if "BUILT" in b else WHITE),line=BORDER)
    txt(s,0.7,by,5.7,0.58,[[(a,12.5,WHITE if hdr else TEXT,hdr)]],anchor=MSO_ANCHOR.MIDDLE)
    txt(s,6.7,by,5.9,0.58,[[(b,12.5,WHITE if hdr else (TEAL if "BUILT" in b else TEXT),hdr or "BUILT" in b)]],anchor=MSO_ANCHOR.MIDDLE)

# ════════════════════ SLIDE 11 — VALUE PROP ════════════════════
s=slide()
header(s,"VALUE PROPOSITION","We connect every pain to a feature — and a feeling")
rows=[("Student pain (their words)","StudyStrike feature","The benefit they feel"),
      ("“I know the deadline, I just don't start.”","Smart prioritiser + daily start-points","Anxiety becomes one obvious next action"),
      ("“Planners are work on top of work.”","LMS auto-import","Zero maintenance — deadlines just appear"),
      ("“Nothing makes studying feel worth it.”","Grade-linked leaderboard & streaks","Effort becomes a grade investment"),
      ("“I get distracted / cheat my own timer.”","Verified Focus Monitor","Points you — and your instructor — can trust")]
cols=[0.55,4.85,9.0]; widths=[4.2,4.05,3.78]
for ri,row in enumerate(rows):
    by=1.95+ri*0.95
    hdr=ri==0
    for ci,cell in enumerate(row):
        fill=NAVY if hdr else (TEALBG if ci==2 else WHITE)
        box(s,cols[ci],by,widths[ci],0.88,fill=fill,line=BORDER)
        col=WHITE if hdr else (TEAL if ci==2 else TEXT)
        txt(s,cols[ci]+0.15,by,widths[ci]-0.3,0.88,[[(cell,12.5,col,hdr or ci==2)]],anchor=MSO_ANCHOR.MIDDLE,line_sp=1.0)
box(s,0.55,6.75,12.2,0.55,fill=NAVY,round=True)
txt(s,0.55,6.75,12.2,0.55,[[("The only student tool where ",13,WHITE,False),("verified daily effort converts into real grade bonuses",13,GOLDL,True),(" — a trust loop no leaderboard can fake.",13,WHITE,False)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)

# ════════════════════ SLIDE 12 — MARKET ════════════════════
s=slide()
header(s,"MARKET OPPORTUNITY","A growing market, a focused beachhead")
funnel=[("TAM","$1.4B","Global edtech-productivity market (2023) → $2.7B by 2031 @ 9.1% CAGR",11.5,NAVY),
        ("SAM","$85M","UAE + GCC higher-ed productivity tools (2025 estimate)",8.5,NAVY2),
        ("SOM","$4–8M","5–10% UAE share targeted within 3 years of launch",5.5,TEAL)]
for i,(t,v,d,w,col) in enumerate(funnel):
    by=1.95+i*1.45
    cx=(13.333-w)/2
    box(s,cx,by,w,1.25,fill=col,round=True)
    txt(s,cx+0.4,by,2.2,1.25,[[(t,20,GOLDL,True)],[(v,30,WHITE,True)]],anchor=MSO_ANCHOR.MIDDLE)
    txt(s,cx+3.0,by,w-3.3,1.25,[[(d,13.5,WHITE,False)]],anchor=MSO_ANCHOR.MIDDLE,line_sp=1.05)
txt(s,0.55,6.6,12,0.5,[[("Revenue model:  ",13,TEXT,True),("Free tier · Premium AED 29/mo · Institutional licence AED 15/student/yr",13,GREY,False)]])

# ════════════════════ SLIDE 13 — POSITIONING ════════════════════
s=slide()
header(s,"COMPETITIVE POSITIONING","We own the empty corner of the market")
s.shapes.add_picture(os.path.join(HERE,"positioning_map.png"),Inches(0.5),Inches(1.45),height=Inches(5.5))
box(s,8.7,1.7,4.2,4.9,fill=WHITE,line=BORDER,round=True)
txt(s,8.95,1.95,3.7,0.5,[[("Positioning statement",13,TEAL,True)]])
txt(s,8.95,2.45,3.75,1.8,[[("For UAE students who struggle to meet deadlines, StudyStrike turns assignments into competitive, motivating challenges — unlike generic tools that ignore grades and schedules.",12,TEXT,False)]],line_sp=1.05)
txt(s,8.95,4.35,3.7,0.5,[[("Why we win",13,TEAL,True)]])
txt(s,8.95,4.85,3.75,1.6,[[("A leaderboard can be copied. A ",12,TEXT,False),("verified",12,NAVY,True),(" link between daily effort and real grades cannot.",12,TEXT,False)]],line_sp=1.1)

# ════════════════════ SLIDE 14 — CUSTOMER DEV ════════════════════
s=slide()
header(s,"CUSTOMER DEVELOPMENT","We didn't guess — we interviewed, then built what they asked for")
people=[("Ahmed, 20","2nd-yr Engineering · part-time tutor","Balance tutoring shifts with heavy lab reports.","AED 25–35/mo","Asked for a 'work-shift blocker' → added to roadmap. Joined beta."),
        ("Sara, 22","3rd-yr Business · group-project lead","Group deadlines scattered across WhatsApp & email.","AED 20–30/mo","Asked for 'group sprint mode' → added. Volunteered for beta."),
        ("Bilal, 21","2nd-yr IT · international (ESL)","Underestimates task time due to English reading load.","AED 30/mo","Asked for a 'language difficulty multiplier' → in Predictions roadmap.")]
for i,(n,prof,need,wtp,out) in enumerate(people):
    cx=0.55+i*4.12
    box(s,cx,1.9,3.95,4.7,fill=WHITE,line=BORDER,round=True)
    box(s,cx,1.9,3.95,0.9,fill=NAVY)
    txt(s,cx+0.25,2.0,3.5,0.4,[[(n,17,WHITE,True)]])
    txt(s,cx+0.25,2.42,3.5,0.35,[[(prof,11,GOLDL,False)]])
    txt(s,cx+0.25,3.0,3.5,0.4,[[("NEED",10,TEAL,True)]])
    txt(s,cx+0.25,3.32,3.5,0.8,[[(need,12.5,TEXT,False)]],line_sp=1.0)
    txt(s,cx+0.25,4.2,3.5,0.4,[[("WILLING TO PAY",10,TEAL,True)]])
    txt(s,cx+0.25,4.52,3.5,0.4,[[(wtp,15,NAVY2,True)]])
    txt(s,cx+0.25,5.05,3.5,0.4,[[("SUGGESTED → WE BUILT",10,TEAL,True)]])
    txt(s,cx+0.25,5.37,3.5,1.1,[[(out,12,GREY,False)]],line_sp=1.05)

# ════════════════════ SLIDE 15 — LEARNED & ADAPTED ════════════════════
s=slide()
header(s,"LEARN & ADAPT","We validated the core — and changed course where the evidence said so")
box(s,0.55,1.9,6.0,4.7,fill=WHITE,line=BORDER,round=True)
box(s,0.55,1.9,6.0,0.7,fill=TEAL)
txt(s,0.8,1.9,5.5,0.7,[[("✓  Validated assumptions",16,WHITE,True)]],anchor=MSO_ANCHOR.MIDDLE)
for i,t in enumerate(["Gamification (streaks + leaderboard) lifts daily engagement",
                      "Grade-linked rewards beat generic badges by a wide margin",
                      "A single consolidated task view reduces missed deadlines",
                      "Direct interviews surfaced features we'd never have designed"]):
    txt(s,0.85,2.75+i*0.9,5.4,0.85,[[("•  ",13,TEAL,True),(t,13,TEXT,False)]],line_sp=1.0)
box(s,6.75,1.9,6.0,4.7,fill=WHITE,line=BORDER,round=True)
box(s,6.75,1.9,6.0,0.7,fill=GOLD)
txt(s,7.0,1.9,5.5,0.7,[[("⟳  Adaptations made",16,NAVY,True)]],anchor=MSO_ANCHOR.MIDDLE)
ad=[("Manual Google-Form entry","LMS auto-import (Blackboard .ics)"),
    ("No anti-cheat mechanism","Verified Focus Monitor — now built"),
    ("Web-only prototype","Mobile-first redesign next sprint"),
    ("Individual-only tasks","Group sprint / team-challenge mode")]
for i,(b,a) in enumerate(ad):
    by=2.75+i*0.9
    txt(s,7.0,by,5.5,0.85,[[(b+"  →  ",12,GREY,False),(a,12.5,NAVY,True)]],line_sp=1.0)

# ════════════════════ SLIDE 16 — ROADMAP ════════════════════
s=slide()
header(s,"ROADMAP","Shipped the MVP — here's how we scale")
phases=[("Phase 1 — NOW","Q3 2026",["Functional web MVP (built ✓)","Verified Focus Monitor (built ✓)","Blackboard .ics import","Pomodoro focus timer"],GOLD,True),
        ("Phase 2 — Short term","Q4 2026",["Full Blackboard API integration","Native mobile app (iOS + Android)","Streak-freeze feature","Instructor approval dashboard"],TEAL,False),
        ("Phase 3 — Medium term","Q1–Q2 2027",["AI adaptive task-duration model","Group sprints / team challenges","University B2B licensing","Instructor analytics dashboard"],NAVY2,False)]
for i,(t,q,items,col,here) in enumerate(phases):
    cx=0.55+i*4.12
    box(s,cx,2.1,3.95,4.4,fill=WHITE,line=BORDER,round=True)
    box(s,cx,2.1,3.95,0.95,fill=col)
    txt(s,cx+0.25,2.2,3.5,0.45,[[(t,15.5,WHITE if col!=GOLD else NAVY,True)]])
    txt(s,cx+0.25,2.65,3.5,0.35,[[(q,12,WHITE if col!=GOLD else NAVY,False)]])
    for j,it in enumerate(items):
        txt(s,cx+0.25,3.3+j*0.72,3.5,0.7,[[("•  ",12,col,True),(it,12.5,TEXT,False)]],line_sp=1.0)
    if here:
        box(s,cx+1.1,1.7,1.75,0.42,fill=NAVY,round=True)
        txt(s,cx+1.1,1.7,1.75,0.42,[[("◀ YOU ARE HERE",9.5,GOLDL,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)

# ════════════════════ SLIDE 17 — CLOSE ════════════════════
s=slide()
box(s,0,0,13.333,7.5,fill=NAVY)
box(s,0,4.6,13.333,2.9,fill=RGBColor(0x0A,0x1E,0x3C))
box(s,5.9,0.95,1.5,1.5,fill=GOLD,round=True)
txt(s,5.9,0.97,1.5,1.5,[[("SS",34,NAVY,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
txt(s,1.0,2.5,11.3,1.2,[[("Every deadline met is a student who proved they could.",30,WHITE,True)],
                        [("We just give them the reason to start.",30,GOLDL,True)]],align=PP_ALIGN.CENTER,line_sp=1.05)
txt(s,1.0,3.95,11.3,0.5,[[("Thank you  ·  Questions & Answers welcome",17,RGBColor(0xC5,0xDA,0xF0),True)]],align=PP_ALIGN.CENTER)
for i,(v,l) in enumerate([("6","Interviews"),("4","Key Insights"),("5","Pilot Users"),("100%","Positive Feedback")]):
    bx=1.7+i*2.6
    txt(s,bx,4.85,2.3,0.7,[[(v,40,GOLDL,True)]],align=PP_ALIGN.CENTER)
    txt(s,bx,5.7,2.3,0.4,[[(l,14,WHITE,False)]],align=PP_ALIGN.CENTER)
txt(s,1.0,6.5,11.3,0.5,[[("StudyStrike — Compete. Excel. Succeed.   |   FWS310, Spring 2025–2026   |   Instructor: Abdelrahman El Adly",12,RGBColor(0x9F,0xC3,0xE8),False)]],align=PP_ALIGN.CENTER)

# ════════════════════ NEW: EXISTING SOLUTIONS & DRAWBACKS ════════════════════
s=slide()
header(s,"WHY CURRENT TOOLS FAIL","Plenty of tools exist — none convert academic intent into action")
rows=[("Existing solution","Its drawback","Who it fails"),
      ("Planner & list apps  (Todoist, Notion)","High manual upkeep — abandoned within days","Busy commuters & working students"),
      ("Focus apps  (Forest, Pomodoro timers)","Track time, but no link to grades or deadlines","Students who need real stakes"),
      ("LMS portals  (Blackboard, MyADU)","Show deadlines, offer zero motivation or guidance","Chronic procrastinators"),
      ("Gamified habit apps  (Habitica, Duolingo)","Fun, but disconnected from real academic work","Course-focused students"),
      ("Reminder / notification apps","Notify — but never prompt the next action","Anxiety-driven avoiders")]
cols=[0.55,5.3,9.35]; widths=[4.65,3.95,3.43]
for ri,row in enumerate(rows):
    by=1.85+ri*0.78; hdr=ri==0
    for ci,cell in enumerate(row):
        fill=NAVY if hdr else WHITE
        box(s,cols[ci],by,widths[ci],0.72,fill=fill,line=BORDER)
        col=WHITE if hdr else (TEXT if ci==0 else (RED if ci==1 else GREY))
        bold=hdr or ci==0
        txt(s,cols[ci]+0.15,by,widths[ci]-0.3,0.72,[[(cell,12.5,col,bold)]],anchor=MSO_ANCHOR.MIDDLE,line_sp=1.0)
box(s,0.55,6.6,12.2,0.6,fill=TEALBG,line=BORDER,round=True)
txt(s,0.55,6.6,12.2,0.6,[[("Every competitor fails on one of three fronts: ",13,TEXT,False),("maintenance, stakes, or motivation",13,TEAL,True),(".  StudyStrike fixes all three.",13,TEXT,False)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)

# ════════════════════ NEW: MVP ════════════════════
s=slide()
header(s,"OUR MVP","A working web platform — built, running, and pilot-tested")
box(s,0.55,1.9,6.0,4.7,fill=NAVY,round=True)
txt(s,0.9,2.3,5.35,2.6,[[("StudyStrike is a functional web app today —",22,WHITE,True)],
    [("",8,WHITE,False)],
    [("not a mock-up. Students log in, study under verified focus, earn points, and climb a live per-course leaderboard.",18,GOLDL,True)]],line_sp=1.1)
box(s,0.9,5.5,5.3,0.85,fill=RGBColor(0x14,0x3E,0x78),round=True)
txt(s,0.9,5.5,5.3,0.85,[[("✓  Validated with a 5-student, 1-week pilot",13.5,WHITE,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
txt(s,6.85,1.95,6.0,0.4,[[("What's in the MVP",15,TEXT,True)]])
comp=[("🔒","Verified Focus Monitor","webcam + screen presence confirm real focus"),
      ("🏆","Grade-linked Leaderboard","live weekly rankings, up to +2% grade bonus"),
      ("📋","Smart Task Prioritiser","auto-sorted by urgency, with progress bars"),
      ("🧑‍🏫","Instructor Dashboard","progress, focus %, and at-risk flags")]
for i,(ic,t,d) in enumerate(comp):
    by=2.4+i*0.78
    box(s,6.85,by,6.0,0.68,fill=WHITE,line=BORDER,round=True)
    txt(s,7.0,by,0.6,0.68,[[(ic,18,NAVY,True)]],align=PP_ALIGN.CENTER,anchor=MSO_ANCHOR.MIDDLE)
    txt(s,7.6,by+0.05,5.1,0.6,[[(t+"  ",13,NAVY,True),("— "+d,11.5,GREY,False)]],anchor=MSO_ANCHOR.MIDDLE,line_sp=0.95)
txt(s,6.85,5.6,6.0,0.4,[[("Intentionally out of scope (next phases):",12,GREY,True)]])
txt(s,6.85,5.95,6.0,0.6,[[("native mobile app · full LMS API · AI task-duration model",12,GREY,False)]])

# ════════════════════ NEW: BUSINESS MODEL OVERVIEW ════════════════════
s=slide()
header(s,"BUSINESS MODEL","How we create and capture value")
# Left: who + how we reach
box(s,0.55,1.95,5.0,4.6,fill=WHITE,line=BORDER,round=True)
txt(s,0.8,2.15,4.5,0.4,[[("Who we serve",15,NAVY,True)]])
for i,(t,d) in enumerate([("B2C — UAE university students","Freemium app; premium upgrade for power users"),
                          ("B2B — Universities","Institutional licence per enrolled student")]):
    by=2.65+i*1.0
    box(s,0.8,by,4.5,0.85,fill=BG,line=BORDER,round=True)
    txt(s,0.95,by+0.1,4.2,0.7,[[(t,13,NAVY,True)],[(d,11.5,GREY,False)]],line_sp=1.0)
txt(s,0.8,4.85,4.5,0.4,[[("How we reach them",15,NAVY,True)]])
txt(s,0.8,5.25,4.6,1.2,[[("•  University partnerships & pilots",12.5,TEXT,False)],
                        [("•  Web platform (self-serve sign-up)",12.5,TEXT,False)],
                        [("•  Social — TikTok / Instagram student communities",12.5,TEXT,False)]],line_sp=1.15)
# Right: revenue tiers
txt(s,5.85,1.95,7.0,0.4,[[("Revenue streams",15,NAVY,True)]])
tiers=[("Free","Core tasks + streaks","AED 0",GREY),
       ("Premium","Predictions, focus mode, sync","AED 29 / mo",TEAL),
       ("Institutional","Full platform per university","AED 15 / student / yr",NAVY2)]
for i,(t,d,p,col) in enumerate(tiers):
    by=2.4+i*1.05
    box(s,5.85,by,7.0,0.92,fill=WHITE,line=BORDER,round=True)
    box(s,5.85,by,0.12,0.92,fill=col)
    txt(s,6.15,by+0.12,3.0,0.7,[[(t,15,NAVY,True)],[(d,11.5,GREY,False)]],line_sp=1.0)
    txt(s,9.2,by,3.5,0.92,[[(p,17,col,True)]],align=PP_ALIGN.RIGHT,anchor=MSO_ANCHOR.MIDDLE)
box(s,5.85,5.65,7.0,0.85,fill=TEALBG,line=BORDER,round=True)
txt(s,6.05,5.65,6.7,0.85,[[("Unit economics: ",12.5,TEXT,True),("low marginal cost per user (cloud-hosted SaaS) → freemium funnel converts to premium & institutional revenue.",12.5,GREY,False)]],anchor=MSO_ANCHOR.MIDDLE,line_sp=1.0)

# ════════════════════ NEW: BUSINESS MODEL CANVAS ════════════════════
s=slide()
header(s,"BUSINESS MODEL CANVAS","The full picture on one page")
def bmc(x,y,w,h,title,items,accent=NAVY2):
    box(s,x,y,w,h,fill=WHITE,line=BORDER)
    box(s,x,y,0.07,h,fill=accent)
    txt(s,x+0.16,y+0.08,w-0.22,0.32,[[(title,10.5,NAVY,True)]])
    rows=[[("•  "+it,9.3,TEXT,False)] for it in items]
    txt(s,x+0.16,y+0.42,w-0.26,h-0.46,rows,line_sp=1.0,sp_after=2)
TY=1.7; TH=3.45; BY=5.25; BH=1.5
c=[0.55,3.0,5.45,7.9,10.35]; cw=2.38
# top row 5 columns
bmc(c[0],TY,cw,TH,"KEY PARTNERS",["Universities (ADU etc.)","LMS providers (Blackboard)","Cloud / IT infrastructure"],NAVY2)
bmc(c[1],TY,cw,TH/2-0.05,"KEY ACTIVITIES",["Platform dev & maintenance","LMS integration","Student onboarding"],TEAL)
bmc(c[1],TY+TH/2+0.05,cw,TH/2-0.05,"KEY RESOURCES",["Engineering team","Verified-focus technology","Student community & data"],TEAL)
bmc(c[2],TY,cw,TH,"VALUE PROPOSITIONS",["Verified effort → real grade bonuses","One zero-maintenance deadline view","Competition that builds study habit"],GOLD)
bmc(c[3],TY,cw,TH/2-0.05,"CUSTOMER RELATIONSHIPS",["Self-serve app","In-app support","Community leaderboards"],TEAL)
bmc(c[3],TY+TH/2+0.05,cw,TH/2-0.05,"CHANNELS",["University partnerships","Web platform","Social (TikTok / IG)"],TEAL)
bmc(c[4],TY,cw,TH,"CUSTOMER SEGMENTS",["UAE university students (B2C)","Universities (B2B licensing)","Procrastination-prone learners"],NAVY2)
# bottom row 2 blocks
bmc(0.55,BY,6.0,BH,"COST STRUCTURE",["Development & hosting","Marketing & user acquisition","Customer support"],RED)
bmc(6.73,BY,6.05,BH,"REVENUE STREAMS",["Premium subscription — AED 29/mo","Institutional licence — AED 15/student/yr","Free tier (top of funnel)"],GOLD)

# ════════════════════ FINALISE: reorder to the requested narrative flow ════════════════════
# Creation order indices (0-based):
#  0 Title 1 Problem 2 Insights 3 GoldenCircle 4 Introducing 5 CoreFeatures
#  6 Workflow 7 Proto1 8 Proto2 9 Pilot 10 ValueProp 11 Market 12 Positioning
#  13 CustomerDev 14 Learn&Adapt 15 Roadmap 16 Close
#  17 ExistingSolutions 18 MVP 19 BizModelOverview 20 BizModelCanvas
# Desired flow (Problem → why tools fail → why → MVP → how → proof → value → validation →
#  market → customers → positioning → business model → canvas → learning → roadmap → close).
order=[0,1,17,3,18,6,5,7,8,10,9,11,13,12,19,20,14,15,16]   # drops 2 (Insights) & 4 (Introducing)
sldIdLst=prs.slides._sldIdLst
ids=list(sldIdLst)
# Drop the two unused slides cleanly (remove their relationship + element).
for drop_idx in (2,4):
    prs.part.drop_rel(ids[drop_idx].rId)
keep=[ids[i] for i in order]
for el in list(sldIdLst):
    sldIdLst.remove(el)
for el in keep:
    sldIdLst.append(el)

out=os.path.join(HERE,"StudyStrike_Redesigned.pptx")
prs.save(out)
print("Saved:",out,"·",len(prs.slides._sldIdLst),"slides in new order")
