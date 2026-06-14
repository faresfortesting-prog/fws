#!/usr/bin/env python3
"""Build the corrected StudyStrike Report (2) as an editable .docx."""
import os
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

HERE = os.path.dirname(os.path.abspath(__file__))
NAVY = RGBColor(0x0F, 0x34, 0x60)
doc = Document()

# Base style
st = doc.styles['Normal']
st.font.name = 'Calibri'; st.font.size = Pt(11)
for s in ['Heading 1', 'Heading 2']:
    doc.styles[s].font.color.rgb = NAVY

def h1(t):
    p = doc.add_heading(t, level=1); return p
def h2(t):
    p = doc.add_heading(t, level=2); return p
def para(t, italic=False, bold=False, align=None, size=11):
    p = doc.add_paragraph(); r = p.add_run(t); r.italic = italic; r.bold = bold
    r.font.size = Pt(size)
    if align: p.alignment = align
    return p
def bullet(t):
    p = doc.add_paragraph(style='List Bullet'); p.add_run(t); return p
def caption(t):
    p = doc.add_paragraph(); r = p.add_run(t); r.italic = True; r.font.size = Pt(9.5)
    r.font.color.rgb = RGBColor(0x55,0x55,0x55); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
def add_img(path, width=5.8):
    if os.path.exists(path):
        doc.add_picture(path, width=Inches(width))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

# ── TITLE PAGE ──
for t,b,sz in [("College of Business",True,16),
               ("FWS310 – Fundamentals of Innovation and Entrepreneurship",False,13),
               ("Spring Semester 2025–2026",False,12),
               ("Dr. Abdelrahman El Adly",False,12)]:
    para(t,bold=b,align=WD_ALIGN_PARAGRAPH.CENTER,size=sz)
doc.add_paragraph()
para("Time Management: StudyStrike Website Report (2)",bold=True,align=WD_ALIGN_PARAGRAPH.CENTER,size=18)
doc.add_paragraph()
tbl = doc.add_table(rows=1, cols=2); tbl.style = 'Light Grid Accent 1'; tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
hdr = tbl.rows[0].cells; hdr[0].paragraphs[0].add_run('Student Name').bold = True
hdr[1].paragraphs[0].add_run('Student ID').bold = True
team = [("Mohamed Fares","1093012"),("Ayman Hanoun","1094846"),("Faisal Ahmed","1093410"),
        ("Ahmed Nabil","1094694"),("Omar Mahmoud","109030"),("Mohamed Ali","1093937")]
for n,i in team:
    c = tbl.add_row().cells; c[0].text = n; c[1].text = i
doc.add_page_break()

# ── TABLE OF CONTENTS (corrected) ──
h1("Table of Contents")
toc = [
 "1. Introduction",
 "   Figure 1. Golden Circle framework (What, How, Why) of StudyStrike",
 "   Intellectual Property Considerations",
 "   Previous Attempts and Market Comparison",
 "2. Market Analysis",
 "   Figure 2. Global EdTech Market Size by Region, 2023–2030",
 "3. Customer Development",
 "   3.1 Interview 1: Fatima",
 "   3.2 Interview 2: Khalid",
 "   3.3 Interview 3: Maryam",
 "   3.4 Interview 4: Hamdan",
 "   3.5 Interview 5: Yousef",
 "   Table 1. Summary of customer interviews and key insights",
 "4. Competition and Positioning",
 "   4.1 Positioning Statement",
 "   4.2 Differentiation Statement",
 "   4.3 Competitors",
 "   4.4 Positioning Map",
 "   Figure 3. Positioning Map of StudyStrike vs. competitors",
 "5. Business Model",
 "   5.1 Key Hypotheses to Test",
 "   Figure 4. Business Model Canvas of StudyStrike",
 "6. Learning and Adaptation",
 "7. Conclusion",
 "References",
]
for line in toc:
    p = doc.add_paragraph(); r = p.add_run(line); r.font.size = Pt(11)
doc.add_page_break()

# ── 1. INTRODUCTION ──
h1("1. Introduction")
para("Students need a clear strategy to organise their academic tasks. They struggle with procrastination, "
"missed deadlines, and inconsistent study habits. What they require is an interactive time-management "
"platform that helps them track their tasks, stay on schedule, and build productive habits. Current "
"alternatives are either too general, demand too much manual work, or lack the motivational features needed "
"to keep students engaged. StudyStrike is accessible, user-friendly, and grounded in research — helping "
"students compete, excel, and succeed.")
para("StudyStrike was created as a continuation of our previous report, which set out to tackle procrastination "
"and poor time-management among university students. The idea came from real experience: UAE university "
"students — especially those who commute daily, have family obligations, work part-time, and carry heavy "
"workloads — rarely start their assignments on time and often fall behind by the fourth or fifth week of the "
"semester (Macan, 1994; Steel, 2007). Through several empathy interviews and brainstorming sessions we "
"realised the problem is not a lack of awareness of deadlines, but a lack of timely action. StudyStrike "
"offers a practical, motivational (Britton & Tesser, 1991), data-driven set of tools that turn deadlines into "
"daily plans, encourage productive competition through course-specific leaderboards, and provide meaningful "
"feedback for persistence by linking study effort to real grades — improving academic outcomes and reducing "
"stress.")
para("To ensure StudyStrike relied on real user experience, we conducted both primary and secondary research:")
bullet("Primary research: face-to-face interviews and a one-week pilot of our Minimum Viable Product (MVP), "
"recording the study time of five participants, posting their points on a hand-built leaderboard, and sending "
"daily progress updates via WhatsApp. This gave us direct input on motivation, usability, and the impact of "
"the achievement and leaderboard system.")
bullet("Secondary research: a literature review on procrastination, an analysis of current productivity and "
"competition tools, and a review of gamification in education. This helped us understand the current landscape, "
"identify gaps in existing tools, and quantify the StudyStrike opportunity (Claessens et al., 2007; NSSE, 2021).")
para("StudyStrike originated in real student experience, not theory. Many of our classmates knew when their work "
"was due yet still waited until the last minute, felt stressed, and had no reliable way to stay accountable "
"(Nonis & Hudson, 2010). This led us to build a platform that delivers tangible, visible results: a leaderboard "
"showing your rank within your class, a list of meaningful achievement points, and grade rewards tied directly "
"to your effort and persistence.")
para("The Golden Circle model (Figure 1) captures the aim, process, and outcome of StudyStrike. At the heart of "
"our concept is the WHY — no student should fail a course they were capable of passing simply because they "
"could not start on time; procrastination is a psychological problem, not a knowledge gap. The HOW is real "
"grades, verified focus (where points are earned), and direct competition between students in the same course "
"to create a daily incentive to study. The WHAT is the product itself: an interactive academic platform with a "
"leaderboard, progress tracking, an intelligent task-prioritisation system, 4-week grade forecasts, and an "
"instructor dashboard.")
add_img(os.path.join(HERE,'golden_circle.png'))
caption("Figure 1. Golden Circle framework illustrating the What, How, and Why of the StudyStrike platform.")

h2("Intellectual Property Considerations")
para("Established mechanisms such as task management, achievement tracking, point systems, and leaderboard "
"rankings are widely used in productivity and education applications and require no special licences. Our "
"distinctive features are intellectually defensible: a verified focus mechanism, where task completion is linked "
"to actual activity on the Learning Management System (LMS) rather than self-reporting, and course-specific "
"grade rewards approved by instructors. While interactive learning platforms such as Duolingo and Forest exist, "
"StudyStrike is differentiated because it integrates with the university's grading system, runs competition per "
"course, and provides a predictive analytics dashboard.")

h2("Previous Attempts and Market Comparison")
para("Several companies have tried to address student productivity but fallen short due to high maintenance "
"burden, a lack of genuine academic motivation, and failure to meet individual student needs. Manual tools such "
"as Todoist and Notion require sustained effort before students eventually abandon them. Focus tools such as "
"Forest and Be Focused tackle distraction but never connect effort to academic outcomes. StudyStrike closes "
"these gaps: it reduces manual work through LMS integration, ties rewards to real, instructor-approved grade "
"improvements, and adds a competitive social layer driven by peers. In the UAE and globally, StudyStrike stands "
"apart by combining gamification, academic integration, and behavioural accountability in a single platform.")

# ── 2. MARKET ANALYSIS ──
h1("2. Market Analysis")
para("StudyStrike sits within the global EdTech market of digital tools and platforms for education, which has "
"expanded rapidly, driven by the wider adoption of online education following the COVID-19 pandemic. The global "
"EdTech market was estimated at USD 187 billion in 2023 and is projected to reach USD 437 billion by 2033, an "
"annual growth rate of roughly 10.8% (Grand View Research, 2024). StudyStrike targets a specific slice of this "
"market: gamification in education — incorporating game elements such as points, leaderboards, streaks, and "
"badges into non-game tasks to make learning more engaging and to build study habits. The gamification-in-"
"education market was valued at about USD 1.2 billion in 2022 and is projected to grow 22.4% annually to "
"USD 5.8 billion by 2030 (Grand View Research, 2024). This reflects users wanting more than reminders and "
"to-do lists — they want engaging experiences and visible evidence of progress.")
para("In the UAE, the government strongly supports digital education and many universities have adopted platforms "
"such as Blackboard and MyADU. In 2023 the UAE EdTech market was estimated at roughly USD 685 million and is "
"projected to expand about 15.6% annually through 2028 (HolonIQ, 2023). These platforms are already used at Abu "
"Dhabi University, where StudyStrike was developed and piloted, allowing seamless integration with the systems "
"students and teachers already use daily.")
para("We sized the opportunity across three levels. The Total Addressable Market (TAM) is all university students "
"worldwide who use digital academic tools — over 235 million. The Serviceable Addressable Market (SAM) is "
"students at UAE and regional universities with English-language LMS platforms — approximately 400,000 students. "
"The Serviceable Obtainable Market (SOM), within the first two years, is an estimated 15,000–25,000 active users, "
"starting with Abu Dhabi University and nearby partner universities. StudyStrike becomes profitable if only 10% "
"of those users subscribe, covering development and early marketing costs.")
para("This opportunity exists because procrastination is widespread: research indicates that 70–95% of college "
"students postpone work at some point, and nearly half report doing so often (Steel, 2007). Existing tools — "
"Notion, Todoist, Forest — are too cumbersome, too generic, or not tied to real grades. Students know their "
"deadlines but fail to act on them. No current product combines the three elements that make StudyStrike "
"different: rewards tied to actual grades, competition between students in the same course, and a 4-week "
"performance prediction. StudyStrike is therefore not a task manager — it is the first platform to connect daily "
"study habits to academic outcomes.")
caption("Figure 2. Global EdTech Market Size by Region, 2023–2030. [Insert your market-growth chart here.]")

# ── 3. CUSTOMER DEVELOPMENT ──
h1("3. Customer Development")
para("To develop and test StudyStrike we conducted in-person interviews with university students, drawing on the "
"empathy interviews from Report 1. In each meeting we presented the StudyStrike concept or a prototype, gathered "
"feedback, and adapted the platform accordingly. These conversations showed us what was working, what was not, "
"and what mattered most to our users.")

interviews = [
("3.1 Interview 1: Fatima",
"Fatima is a 19-year-old first-year student who commutes two hours a day. She does not forget her deadlines — "
"she knows them; her problem is knowing when to actually start. In her first semester she had three assessments "
"(Management, Mathematics, English) due within 48 hours. She had written them in different places but never "
"compiled them into a plan, realised how close they were too late, missed one deadline, and scored only 80% on "
"another. She currently uses a phone notes app but rarely reopens it. We walked Fatima through the Task Progress "
"view, which labels tasks 'Due Soon' and 'Urgent.' She reacted immediately: “This is what I need — not the "
"reminder of the deadline, but the reminder that I should start today.” Her only concern was manual data "
"entry; she asked whether StudyStrike could pull assignments from the university portal. We explained that "
"Blackboard integration is planned and that she could upload her schedule as a file until then. Following this, "
"we prioritised LMS integration and a daily 'Start Now' push notification for mobile. Fatima showed us that "
"students do not lack information — they lack the urgency to act on it."),
("3.2 Interview 2: Khalid",
"Khalid is a 22-year-old third-year business student who also works 20 hours a week in retail. Over two years he "
"tried several planning apps but abandoned them within days because of the manual entry. He missed an assignment "
"worth 10% of his grade — he started it but had to work an extra night shift and could not finish. He wants "
"“something automatic that already knows my schedule and just tells me what to do.” We showed him the "
"Predictions & Stats tab, which gives a 4-week performance outlook. His response was clear: “If it's "
"connected to my university portal so I wouldn't have to type anything, I'd use it all day long.” He also "
"reviewed the leaderboard and said seeing his class rank would push him to work harder. He would pay for premium "
"if it auto-imported tasks and sent notifications — but not if he still had to enter tasks manually. This "
"confirmed LMS integration as our top build priority."),
("3.3 Interview 3: Maryam",
"Maryam is a 21-year-old second-year student with heavy family responsibilities — caring for younger siblings and "
"helping with family duties. Last semester a family commitment and a group project fell on the same day; she chose "
"the family event, submitted a partial project, and received a low grade. She is not lazy — her day is simply "
"rarely her own. She uses no productivity tool, relying on memory and WhatsApp messages. We introduced her to the "
"Focus Dashboard; the feature she liked most was the streak system: “If I have 10 days of that, I'll feel "
"like I did something.” She also valued breaking work into small steps. Her feedback led directly to the "
"streak-freeze feature — one-day protection so a student does not lose their streak on a day they cannot study. "
"Maryam reminded us that not every student has a quiet desk and a free evening; StudyStrike must reward small, "
"consistent effort, not just long sessions."),
("3.4 Interview 4: Hamdan",
"Hamdan is a 24-year-old fourth-year engineering student with a strong GPA but a habit of leaving things until the "
"last minute. He recently let his team down by starting late on a project — the grade that bothered him most. He "
"has tried time-blocking and structured planners but never stuck with them: “If I don't study today, nothing "
"bad happens — it's not due yet.” The leaderboard drew the strongest reaction of anyone we interviewed: "
"“This is the one thing that will make me change my behaviour — I don't want to drop my rank below someone I "
"know.” His favourite feature was the grade bonus, which he called the first “real reward” that "
"would appear on his transcript rather than a badge. He asked whether the leaderboard updated daily and said he "
"would register the day the site launched. Hamdan showed us that the social-competition layer is StudyStrike's "
"strongest feature for students who know the material but struggle to act."),
("3.5 Interview 5: Yousef",
"Yousef is a 23-year-old third-year IT student and president of one of the university's largest student clubs. He "
"described his life as “running two full-time jobs at the same time,” juggling coursework with club "
"events, volunteering, and meetings. He keeps his club schedule in Google Calendar and his coursework in a paper "
"notebook — and they never connect. Earlier this year a club event, a midterm, and a group project landed in the "
"same week; he had known about each for weeks but never saw them together until it was too late, losing sleep for "
"days and letting people down. Shown the 4-week performance outlook, he said: “This is what I always wanted "
"— a warning three weeks ahead, not the night before.” He asked whether students could add non-academic "
"events (club meetings, work shifts) so the platform could factor them into recommendations. We explained this is "
"not in the current version but is on the roadmap as the Personal Schedule Overlay feature. Yousef showed us that "
"some students struggle not with motivation but with tracking too much in too many places."),
]
for title, body in interviews:
    h2(title); para(body)

h2("Table 1. Summary of customer interviews and key insights")
t = doc.add_table(rows=1, cols=4); t.style = 'Light Grid Accent 1'
hc = t.rows[0].cells
for i,head in enumerate(["Interview","Student profile","Key feedback","Product change"]):
    hc[i].paragraphs[0].add_run(head).bold = True
rows = [
 ("1 – Fatima","First-year commuter, 2 hr daily travel","Wants to be told when to start, not just when it's due","LMS integration top priority; daily 'Start Now' alert added"),
 ("2 – Khalid","Part-time worker, 20 hrs/week","Won't use it if tasks must be entered manually","Automation confirmed as the core reason students would pay"),
 ("3 – Maryam","Heavy family duties","Liked streaks; needs protection on days she can't study","Streak-freeze feature added to the platform"),
 ("4 – Hamdan","Strong GPA but leaves work to the last night","Leaderboard and grade bonus are what change his behaviour","Competitive layer confirmed as the main motivation driver"),
 ("5 – Yousef","Club president, two busy schedules","Needs warnings weeks ahead, not the night before","Personal Schedule Overlay added to future roadmap"),
]
for r in rows:
    c = t.add_row().cells
    for i,v in enumerate(r): c[i].text = v

# ── 4. COMPETITION AND POSITIONING ──
h1("4. Competition and Positioning")
h2("4.1 Positioning Statement")
para("StudyStrike is a productivity app for UAE university students who struggle to meet deadlines and need real "
"incentives to engage with their studies. While many apps help people organise tasks and maintain focus, none "
"provide real academic incentives for doing so. StudyStrike rewards users for genuine productivity and helps them "
"earn real grades.")
h2("4.2 Differentiation Statement")
para("Unlike productivity tools such as Todoist, Notion, Forest, or Habitica, StudyStrike does three things they "
"cannot:")
bullet("It verifies real study effort using webcam and screen presence monitoring.")
bullet("It links points to actual grade bonuses (up to +2%) approved by instructors.")
bullet("It auto-imports deadlines from Blackboard and MyADU, so students do zero manual entry.")
para("No other tool combines verified focus, grade-linked rewards, and automatic LMS integration in one platform.")
h2("4.3 Competitors")
para("We examined five categories of existing tools. Each fails in at least one key area — maintenance, stakes, "
"or motivation:")
ct = doc.add_table(rows=1, cols=3); ct.style = 'Light Grid Accent 1'
ch = ct.rows[0].cells
for i,head in enumerate(["Existing solution","Its drawback","Who it fails"]):
    ch[i].paragraphs[0].add_run(head).bold = True
comp = [
 ("Planner & list apps (Todoist, Notion)","High manual upkeep — abandoned within days","Busy commuters & working students"),
 ("Focus apps (Forest, Pomodoro timers)","Track time but no link to grades or deadlines","Students who need real stakes"),
 ("LMS portals (Blackboard, MyADU)","Show deadlines, offer zero motivation or guidance","Chronic procrastinators"),
 ("Gamified habit apps (Habitica, Duolingo)","Fun, but disconnected from real academic work","Course-focused students"),
 ("Reminder / notification apps","Notify — but never prompt the next action","Anxiety-driven avoiders"),
]
for r in comp:
    c = ct.add_row().cells
    for i,v in enumerate(r): c[i].text = v
para("Why we win: a leaderboard can be copied; a verified link between daily effort and real grades cannot.",
     italic=True)
h2("4.4 Positioning Map")
add_img(os.path.join(HERE,'positioning_map.png'))
caption("Figure 3. Positioning Map of StudyStrike vs. competitors in the student-productivity market.")

# ── 5. BUSINESS MODEL ──
h1("5. Business Model")
para("StudyStrike's business model centres on a freemium productivity platform for university students, combining "
"verified focus monitoring, grade-linked leaderboards, and automatic LMS task import. It targets students who "
"struggle with procrastination and missed deadlines. Because the platform is cloud-hosted SaaS, the marginal cost "
"of adding one more user is very low, creating strong margins at scale.")
para("Revenue comes from three streams: a free tier that serves as the top of the funnel, premium subscriptions "
"at AED 29 per month, and institutional licences at AED 15 per student per year. Growth is supported by a large "
"and expanding market — the UAE EdTech market (~USD 685 million in 2023, growing ~15.6% annually) and the "
"fast-growing education-gamification segment (USD 1.2 billion in 2022, projected to reach USD 5.8 billion by 2030 "
"at 22.4% annually) (Grand View Research, 2024; HolonIQ, 2023). We expect StudyStrike to begin generating profit "
"within the first 12–18 months of full launch, driven by university partnerships and premium conversions, with "
"break-even within the first two years of active marketing and user acquisition.")
para("The main risk factors are the technical reliability of the verified Focus Monitor (webcam + screen "
"presence), LMS-integration stability, and student-data privacy, since verified-focus and academic-integrity "
"tools raise trust concerns. Accordingly, the first hypothesis to validate is whether the privacy and accuracy of "
"the Focus Monitor meet student and instructor expectations while still providing a competitive advantage over "
"generic productivity tools (NSSE, 2021; Steel, 2007).")
h2("5.1 Key Hypotheses to Test")
bullet("Customer validation: university students will pay for a productivity tool if it offers real grade bonuses "
"(not just badges) and automatic LMS syncing.")
bullet("Technical: the verified Focus Monitor (webcam + screen presence) can run smoothly on student laptops "
"without slowing the device or producing false cheating flags.")
bullet("Economic: we can acquire users through university partnerships and social media cheaply enough that "
"premium conversions (AED 29/month) and institutional licences (AED 15/student/year) make the business profitable.")
caption("Figure 4. Business Model Canvas of StudyStrike – 9 key elements. [Insert your BMC diagram here.]")

# ── 6. LEARNING AND ADAPTATION ──
h1("6. Learning and Adaptation")
para("Our learning came from continuous feedback through interviews with students and instructors. Rather than "
"adding features speculatively, we made specific, evidence-driven changes based on what users told us:")
bullet("Manual task entry was the top complaint (Fatima, Khalid) — so we prioritised Blackboard/MyADU "
"auto-import to remove manual data entry entirely.")
bullet("Khalid would only pay for an automatic tool — confirming automation as the core paid value, not a "
"nice-to-have.")
bullet("Maryam's unpredictable schedule led us to add the streak-freeze, protecting consistency on days a "
"student genuinely cannot study.")
bullet("Hamdan and Yousef valued real stakes and foresight — so we kept the grade-linked leaderboard and added a "
"4-week performance forecast, with a Personal Schedule Overlay planned next.")
bullet("Pilot feedback raised the risk of point-cheating — so we built the verified Focus Monitor (webcam + "
"screen presence) so points are earned, not self-reported.")
para("These iterations taught us the value of flexible, user-centred design: every change responded to a real, "
"observed student need rather than an assumption. Interviewing students with different abilities and lifestyles — "
"from exam-focused learners to club presidents — broadened our understanding of the problem and kept the roadmap "
"grounded in evidence (Growth in demand for personalised, engaging learning continues to shape the EdTech market; "
"Grand View Research, 2024). This feedback loop continues to guide StudyStrike's UI/UX, study tracking, and "
"notification design, positioning it to grow alongside its users' academic needs.")

# ── 7. CONCLUSION ──
h1("7. Conclusion")
para("StudyStrike is a strong example of an idea developed from the students' perspective, validated with users, "
"and refined across several iterations. Our five interviews revealed a clear, consistent need: students know "
"their deadlines but feel an emotional disconnect between knowing and acting. StudyStrike closes that gap through "
"authentic academic rewards, peer-to-peer competition, and a system that makes consistent studying the norm.")
para("Initial pilot results were promising: all five participants completed more tasks than the previous week and "
"said they would value the real grade bonuses (+2% for first place, +0.5% for the top 10) far more than a generic "
"digital reward (NSSE, 2021). This aligns with evidence that academic, real-world rewards drive stronger "
"engagement than generic game mechanics (Grand View Research, 2024).")
para("User-centred innovation defined our learning journey: test results shaped the roadmap, prioritising LMS "
"integration as a prerequisite and adding the streak-freeze to handle unpredictable schedules. These improvements "
"were built into the prototype, turning it into a solution that fits into students' real lives (Steel, 2007).")
para("Next, the team will complete a working web and mobile prototype with Blackboard/MyADU integration, expand "
"testing to more courses, and work with instructors to formalise the grade-incentive system. By continuing "
"empathetic design and constant iteration, StudyStrike can become a trusted academic platform for students at "
"Abu Dhabi University and beyond (Britton & Tesser, 1991; Macan, 1994).")

# ── REFERENCES ──
h1("References")
refs = [
"Britton, B. K., & Tesser, A. (1991). Effects of time-management practices on college grades. Journal of "
"Educational Psychology, 83(3), 405–410. https://doi.org/10.1037/0022-0663.83.3.405",
"Claessens, B. J. C., van Eerde, W., Rutte, C. G., & Roe, R. A. (2007). A review of the time management "
"literature. Personnel Review, 36(2), 255–276. https://doi.org/10.1108/00483480710726136",
"Grand View Research. (2024). Education technology market size, share & trends analysis report. "
"https://www.grandviewresearch.com  [verify exact figures/year]",
"HolonIQ. (2023). Global EdTech market sizing and Middle East EdTech outlook. https://www.holoniq.com  "
"[verify exact figures/year]",
"Macan, T. H. (1994). Time management: Test of a process model. Journal of Applied Psychology, 79(3), 381–391. "
"https://doi.org/10.1037/0021-9010.79.3.381",
"National Survey of Student Engagement (NSSE). (2021). Engagement insights: Survey findings on student academic "
"behaviors and success. https://nsse.indiana.edu",
"Nonis, S. A., & Hudson, G. I. (2010). Performance of college students: Impact of study time and study habits. "
"Journal of Education for Business, 85(4), 229–238. https://doi.org/10.1080/08832320903449550",
"Steel, P. (2007). The nature of procrastination: A meta-analytic and theoretical review of quintessential "
"self-regulatory failure. Psychological Bulletin, 133(1), 65–94. https://doi.org/10.1037/0033-2909.133.1.65",
]
for r in refs:
    p = doc.add_paragraph(); p.paragraph_format.left_indent = Inches(0.5)
    p.paragraph_format.first_line_indent = Inches(-0.5); p.add_run(r).font.size = Pt(10.5)

out = os.path.join(HERE, 'StudyStrike_Report2_CORRECTED.docx')
doc.save(out)
print('Saved:', out)
