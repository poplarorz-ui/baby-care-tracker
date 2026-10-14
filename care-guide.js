/*
 * 成长指南：按宝宝出生天数给出阶段特点、喂养/睡眠/大小便/护理/训练/健康提醒，
 * 并结合已有记录做只读分析。本文件不写入任何照护记录，也不改变导出/同步的数据结构。
 * 必须在 app.js 之前加载；渲染时才会用到 app.js 中的 records、babyProfile、$ 等全局对象。
 */

const GUIDE_UI_KEY = "baby-care-tracker-guide-ui-v1";
const DAY_MS = 86400000;

const GUIDE_TABS = [
  { key: "traits", label: "宝宝特点", icon: "🌱" },
  { key: "feeding", label: "喂养", icon: "🍼" },
  { key: "sleep", label: "睡眠", icon: "🌙" },
  { key: "output", label: "大小便", icon: "💧" },
  { key: "care", label: "日常护理", icon: "🛁" },
  { key: "play", label: "发育训练", icon: "🧸" },
  { key: "health", label: "健康就医", icon: "🩺" },
];

/*
 * ref 为参考范围，用于结合记录做对比：
 * perFeed 每顿奶量(ml)、feeds 每天顿数、daily 全天奶量(ml，缺省时 6 月内按体重 150ml/kg 估算)、
 * sleep 全天睡眠(小时)、gain 每天体重增长(g)。
 */
const CARE_STAGES = [
  {
    from: 0, to: 7, name: "新生儿第一周", theme: "适应子宫外的世界",
    summary: "宝宝在学习呼吸、吃奶和排便，体重先降后升、出现黄疸都很常见，重点是吃够、尿够、保暖。",
    ref: { perFeed: [10, 60], feeds: [8, 12], sleep: [16, 20] },
    traits: [
      ["生理性体重下降", "出生后 3–5 天体重会下降，一般不超过出生体重的 7%–10%，7–10 天左右回升。"],
      ["生理性黄疸", "足月儿多在出生后 2–3 天出现，4–6 天最明显，之后逐渐消退。"],
      ["原始反射", "惊跳（拥抱）反射、觅食反射、吸吮和抓握反射都很明显，是正常的神经表现。"],
      ["视力与听觉", "只能看清 20–30cm 内的东西，最喜欢看人脸；对声音敏感，熟悉妈妈的声音。"],
      ["常见小状况", "马牙、粟粒疹、新生儿红斑、乳房肿大、女宝宝少量阴道出血（假月经）多为生理性，不要挤、不要挑。"],
    ],
    feeding: [
      ["按需喂养", "每 2–3 小时一次，全天 8–12 次；出现觅食、吮手、咂嘴就是饿了，不必等到大哭。"],
      ["奶量逐日增加", "胃容量很小：第 1 天每顿约 5–15ml，第 3 天约 20–30ml，第 7 天约 45–60ml。"],
      ["睡太久要叫醒", "这一周白天单次睡超过 3–4 小时可以轻柔唤醒喂奶，避免低血糖和黄疸加重。"],
      ["拍嗝", "每次喂完竖抱拍嗝 5–10 分钟，少量溢奶正常；喷射状呕吐需要就医。"],
    ],
    sleep: [
      ["全天 16–20 小时", "睡眠以 1–3 小时为一段，昼夜还没有分开，这是正常的。"],
      ["安全睡眠", "仰卧睡、睡在自己的婴儿床上，床面硬实，不放枕头、毛绒玩具和厚被子。"],
      ["惊跳反射", "容易被自己吓醒，可以用襁褓包裹（髋部留出活动空间），或手轻按宝宝胸口安抚。"],
    ],
    output: [
      ["胎便到过渡便", "1–2 天排墨绿色黏稠胎便，3–4 天变成黄绿色过渡便，之后变成黄色软便。"],
      ["小便看够不够吃", "大致“第几天尿几次”：第 1 天 1 次、第 3 天 3 次……第 6 天起每天 6 次以上。"],
      ["尿布上的砖红色", "头几天尿布上出现砖红色结晶（尿酸盐）通常提示需要多喂；持续存在请咨询医生。"],
    ],
    care: [
      ["脐带护理", "保持脐部清洁干燥，尿布折到脐下；一般 1–2 周脱落，不要强行拉扯。"],
      ["先擦浴", "脐带脱落前以擦浴为主，室温 24–26℃，水温 38–40℃（用手肘内侧试温）。"],
      ["保暖不过热", "摸后颈温热、不出汗即可；手脚稍凉是正常的，不要捂太多。"],
      ["臀部护理", "勤换尿布，大便后温水冲洗、晾干，再薄涂护臀膏。"],
    ],
    play: [
      ["多抱多说话", "肌肤接触、轻声说话和对视就是最好的早期互动。"],
      ["黑白卡", "在 20–30cm 处放黑白对比图案，每次看几分钟即可。"],
    ],
    health: [
      ["新生儿筛查", "出院前一般会完成足跟血、听力筛查，记得领取结果；出生时已接种乙肝第 1 针和卡介苗。"],
      ["维生素 D", "出生后数天开始每天补充维生素 D 400IU（具体遵医嘱）。"],
    ],
    redFlags: ["黄疸蔓延到手脚心、24 小时内出现黄疸", "体温 ≥37.5℃ 或 <36℃", "吃奶差、反应弱、一直嗜睡", "呼吸急促、口唇发紫", "脐部红肿、有脓性分泌物或异味"],
  },
  {
    from: 7, to: 28, name: "新生儿期", theme: "体重回升，开始第一次猛长",
    summary: "体重应在 2 周左右回到出生体重，吃奶越来越熟练；2–3 周常有一次猛长期，傍晚可能开始变闹。",
    ref: { perFeed: [60, 90], feeds: [8, 12], sleep: [16, 18], gain: [20, 35] },
    traits: [
      ["体重回升", "10–14 天左右回到出生体重，之后每周大约增长 150–250g。"],
      ["猛长期", "7–10 天、2–3 周常出现：突然频繁要奶、睡不踏实，一般 2–3 天到一周过去。"],
      ["黄疸消退", "足月儿生理性黄疸多在 2 周内消退；母乳喂养的宝宝可能延续更久，需要医生评估。"],
      ["会表达不舒服", "哭声开始有区别：饿、困、尿湿、胀气，多观察就能分辨。"],
    ],
    feeding: [
      ["每顿约 60–90ml", "全天 8–12 次，大约每 2–3 小时一次；母乳宝宝按需亲喂，不必拘泥奶量。"],
      ["猛长期多喂", "猛长期多给宝宝吸，母乳会跟着增加，不必一开始就急着加奶粉。"],
      ["预防胀气", "奶瓶喂养时让奶嘴充满奶液，喂到一半和结束后都要拍嗝。"],
      ["溢奶", "喂奶后保持竖抱或斜躺 20–30 分钟，减少溢奶。"],
    ],
    sleep: [
      ["全天约 16–18 小时", "每段 2–4 小时，还不会区分昼夜。"],
      ["建立昼夜感", "白天拉开窗帘、正常说话；夜里喂奶保持昏暗安静，少逗玩。"],
      ["安全睡眠", "继续仰卧睡、同房不同床，避免和大人同床、避免趴睡。"],
    ],
    output: [
      ["大便次数多", "母乳宝宝每天 3–8 次稀软黄便都可能是正常的，有奶瓣、泡沫也常见。"],
      ["小便每天 6 次以上", "尿色清淡、尿布够沉，说明奶量基本够。"],
      ["奶粉宝宝", "大便通常偏稠、颜色偏黄褐，每天 1–3 次。"],
    ],
    care: [
      ["脐带脱落后可盆浴", "每天或隔天洗一次，5–10 分钟即可，先洗脸后洗头再洗身体。"],
      ["清洁褶皱", "颈部、腋下、腹股沟、耳后容易积奶渍和汗，洗后擦干。"],
      ["指甲", "宝宝睡着时用婴儿指甲剪修剪，避免抓伤脸。"],
      ["鼻屎耳屎", "只清理看得见的部分，不要用棉签伸进鼻孔或耳道深处。"],
    ],
    play: [
      ["趴卧练习", "清醒且有大人看护时，每天趴几次，每次 1–3 分钟，帮助颈背部力量和防止扁头。"],
      ["追视", "用红球或黑白卡在眼前 20–30cm 慢慢移动，引导宝宝追视。"],
      ["抚触", "洗澡后做 5–10 分钟抚触，促进亲子关系和睡眠。"],
    ],
    health: [
      ["满月体检", "多数地方在满月或 42 天左右做体检，记录身长、体重、头围。"],
      ["乙肝第 2 针", "1 月龄接种乙肝疫苗第 2 剂，以当地接种门诊通知为准。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["黄疸 2 周后仍明显或退了又出现", "白陶土色（灰白色）大便", "发热 ≥37.5℃", "精神差、吃奶明显减少", "呕吐频繁或呈喷射状"],
  },
  {
    from: 28, to: 60, name: "1–2 个月", theme: "猛长期 · 黄昏闹 · 攒肚",
    summary: "这是最“磨人”的一段：6 周左右常同时遇到猛长期和哭闹高峰，母乳宝宝还可能开始攒肚；也会第一次对你笑。",
    ref: { perFeed: [90, 150], feeds: [6, 8], sleep: [14, 17], gain: [20, 35] },
    traits: [
      ["社交性微笑", "6 周左右会对着人笑，开始发出“啊、哦”的声音。"],
      ["黄昏闹 / 肠绞痛", "常在傍晚到夜里莫名大哭、蹬腿、难哄，6 周左右最明显，3–4 个月大多会好转。"],
      ["6 周猛长期", "突然频繁要奶、吃完不久又饿，夜里醒得多，通常持续几天。"],
      ["头部控制", "趴着时能短暂抬头，竖抱时头还需要托住。"],
      ["还不到厌奶期", "生理性厌奶多在 3–4 个月才出现；这个阶段奶量突然变少，更应该先排查是否生病、鼻塞、口腔问题或喂养方式。"],
    ],
    feeding: [
      ["每顿约 90–150ml", "全天 6–8 次，间隔 3 小时左右；全天总量大致按体重 × 150ml 估算，通常不超过 1000ml。"],
      ["猛长期按需加量", "宝宝明显没吃饱时每顿可加 10–20ml，猛长期过去后会回落。"],
      ["吃饱的信号", "吐出奶嘴、转头、手放松、睡得踏实，比奶瓶刻度更可靠。"],
      ["别把哭都当饿", "黄昏闹时刚吃过又哭，先试试拍嗝、抱着走动、白噪音，避免过度喂养。"],
    ],
    sleep: [
      ["全天约 14–17 小时", "夜里可能开始有一段 3–5 小时的长觉。"],
      ["清醒时间短", "每次醒着 45–90 分钟就会累，打哈欠、揉眼、盯着发呆就该哄睡。"],
      ["黄昏闹应对", "固定傍晚的安抚流程：调暗灯光、襁褓、白噪音、轻摇、飞机抱；家长轮流休息。"],
      ["奶睡要适度", "开始尝试在宝宝犯困但还醒着时放到床上。"],
    ],
    output: [
      ["攒肚", "6 周后部分母乳宝宝会 2–7 天才排一次便。只要精神好、吃奶好、肚子软、排出来是软便、小便正常，通常不用处理。"],
      ["奶粉宝宝", "一般 1–2 天至少 1 次；3 天以上没大便且大便干硬、排便费力，才考虑便秘。"],
      ["排便用力", "憋得脸红、哼哼、大便却是软的，是“婴儿排便困难”，属于正常发育过程。"],
      ["小便", "每天 6 次以上湿尿布，是吃够的重要指标。"],
    ],
    care: [
      ["洗澡", "每天或隔天一次，水温 38–40℃，5–10 分钟，洗完立刻包裹保暖，涂保湿霜。"],
      ["奶痂 / 头垢", "洗澡前用婴儿油软化 10–15 分钟，再轻轻洗掉，不要硬抠。"],
      ["湿疹", "勤保湿、穿纯棉衣物、不要过热；面积大、渗液或影响睡眠请就医。"],
      ["口腔", "喂奶后可用湿纱布轻擦牙龈；注意舌头和颊部有没有擦不掉的白膜（鹅口疮）。"],
      ["防扁头", "睡觉时左右交替头的朝向，清醒时多趴、多竖抱。"],
    ],
    play: [
      ["趴卧练习", "每天累计 15–30 分钟，分成多次，每次 3–5 分钟，宝宝不耐烦就停。"],
      ["追视追听", "用色彩鲜艳的玩具左右、上下移动，在宝宝一侧摇铃让他转头找声音。"],
      ["面对面交流", "模仿宝宝的“啊、哦”，等他回应，这是最早的对话练习。"],
      ["被动操", "洗澡后做简单的手臂伸展、蹬腿运动，动作轻柔。"],
    ],
    health: [
      ["42 天体检", "检查生长发育、髋关节、黄疸消退情况，带上这份记录给医生看奶量和大小便。"],
      ["2 月龄疫苗", "脊灰疫苗第 1 剂、百白破第 1 剂（国家免疫规划），自费的肺炎、五联、轮状病毒等常从这时开始，以接种本为准。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["3 个月内体温 ≥38℃，需要立刻就医", "哭声尖直、无法安抚超过 3 小时并伴随呕吐或发热", "大便带血、黑便或白陶土色", "攒肚期间腹胀明显、拒奶、呕吐", "6–8 周后仍完全不会对人笑、不追视"],
  },
  {
    from: 60, to: 90, name: "2–3 个月", theme: "会笑会“聊天”，作息初现",
    summary: "宝宝越来越爱互动，抬头更稳，开始有规律的作息；哭闹高峰在慢慢过去。",
    ref: { perFeed: [120, 180], feeds: [6, 7], sleep: [14, 17], gain: [20, 30] },
    traits: [
      ["咿呀发音", "会发出更多元音，被逗时会咯咯笑。"],
      ["抬头", "趴着能抬头 45°，竖抱时头能短时间立稳。"],
      ["发现小手", "会盯着自己的手看、吃手，这是自我认知的开始，不必阻止。"],
      ["视觉进步", "能追视 180°，开始分辨颜色。"],
    ],
    feeding: [
      ["每顿约 120–180ml", "全天 6–7 次，间隔 3–4 小时，夜奶可能减少到 1–2 次。"],
      ["吃奶容易分心", "宝宝开始对周围感兴趣，喂奶时选安静、光线暗一点的环境。"],
      ["吃手 ≠ 饿", "到了口欲期，吃手很常见，结合时间间隔判断是否该喂。"],
    ],
    sleep: [
      ["全天约 14–17 小时", "白天 3–4 次小睡，夜里能睡 4–6 小时的长觉。"],
      ["培养睡前程序", "洗澡 → 抚触 → 换睡衣 → 喂奶 → 关灯，每天顺序固定。"],
      ["清醒时间", "每次 1–1.5 小时左右。"],
    ],
    output: [
      ["攒肚可能持续", "母乳宝宝几天一次仍可能正常，判断标准同上：软便、不哭闹、肚子不胀。"],
      ["大便颜色", "黄色、绿色、褐色都可能正常；红色、黑色、灰白色需要就医。"],
    ],
    care: [
      ["洗澡", "可以加入玩水时间，但总时长控制在 10 分钟内；注意防滑和全程不离手。"],
      ["口水增多", "口水开始多起来，及时擦干下巴和脖子，防止口水疹。"],
      ["衣物", "比大人多一件即可，摸后背判断冷热。"],
    ],
    play: [
      ["趴卧加量", "每天累计 30 分钟以上，可在胸下垫小毛巾卷帮助抬头。"],
      ["抓握练习", "把摇铃放到宝宝手里，让他练习握住和挥动。"],
      ["镜子游戏", "在安全镜子前和宝宝说话，观察他的表情。"],
      ["多说多唱", "描述你正在做的事情，给宝宝唱儿歌。"],
    ],
    health: [
      ["3 月龄疫苗", "脊灰疫苗第 2 剂，以当地安排为准。"],
      ["3 月龄体检", "1 岁内一般在 3、6、8、12 月龄各体检一次。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["3 个月内体温 ≥38℃", "趴着完全不能抬头", "不追视、不对声音有反应", "体重增长明显停滞"],
  },
  {
    from: 90, to: 120, name: "3–4 个月", theme: "百天 · 厌奶期 · 翻身预备",
    summary: "宝宝对世界充满好奇，可能出现生理性厌奶；4 个月前后睡眠也可能变差，这是大脑发育的信号。",
    ref: { perFeed: [150, 200], feeds: [5, 6], sleep: [14, 16], gain: [15, 25] },
    traits: [
      ["生理性厌奶", "3–4 个月开始，吃几口就扭头、东张西望、奶量下降，但精神好、体重仍在长，一般持续几周。"],
      ["抬头稳", "竖抱时头已经很稳，趴着能用前臂撑起上身。"],
      ["笑出声", "会大声笑、尖叫，会认出熟悉的人。"],
      ["准备翻身", "侧身、拱腰，有的宝宝已经能从趴翻到仰。"],
    ],
    feeding: [
      ["每顿约 150–200ml", "全天 5–6 次，全天大约 800–1000ml。"],
      ["厌奶期不要追喂", "不强迫、不在睡着时偷喂；选安静环境，饿了再喂，看全天总量和体重。"],
      ["奶粉冲泡", "严格按说明比例冲调，不要私自加浓。"],
      ["还不加辅食", "推荐满 6 个月再添加辅食；最早也不早于 4 个月，需在医生评估下进行。"],
    ],
    sleep: [
      ["全天约 14–16 小时", "白天 3 次小睡左右。"],
      ["4 个月睡眠倒退", "夜醒变多、小睡变短，常持续 2–6 周；保持固定作息，不要每次醒来都立刻喂奶。"],
      ["学会自己入睡", "犯困时放床上，轻拍安抚，让宝宝练习接觉。"],
    ],
    output: [
      ["大便规律化", "排便次数可能变少、更规律；奶粉宝宝大便偏成形。"],
      ["小便", "全天湿尿布 6 次以上。"],
    ],
    care: [
      ["防坠床", "宝宝随时可能翻身，换尿布和睡觉时不要离开，床边加护栏。"],
      ["口水与湿疹", "勤擦口水、戴口水巾，持续保湿。"],
      ["玩具清洁", "宝宝什么都往嘴里放，玩具要定期清洗，避免小零件。"],
    ],
    play: [
      ["翻身练习", "用玩具引导宝宝侧身，大人可以轻推臀部帮助完成。"],
      ["够取练习", "把玩具放在宝宝能够到的地方，鼓励伸手抓。"],
      ["感官游戏", "不同材质的布书、响纸，让宝宝摸一摸、听一听。"],
    ],
    health: [
      ["百天", "可以拍照记录，也适合复盘一下身高体重曲线。"],
      ["4 月龄疫苗", "脊灰疫苗第 3 剂、百白破第 2 剂，以接种本为准。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["厌奶同时体重不增或下降、精神差、尿量减少", "4 个月仍不能抬头", "听到声音不转头、不笑"],
  },
  {
    from: 120, to: 180, name: "4–6 个月", theme: "翻身 · 出牙 · 辅食准备",
    summary: "宝宝会翻身、靠坐，开始对大人吃饭感兴趣；为满 6 个月添加辅食做准备。",
    ref: { perFeed: [150, 220], feeds: [5, 6], daily: [800, 1000], sleep: [12, 16], gain: [12, 20] },
    traits: [
      ["翻身", "能熟练翻身，开始靠坐、扶着能坐一会儿。"],
      ["手眼协调", "会准确抓东西，两只手传递玩具。"],
      ["开始认生", "能分辨生人熟人，看到陌生人可能会哭。"],
      ["出牙信号", "流口水、啃咬东西、牙龈痒，部分宝宝 6 个月前后萌出第一颗牙。"],
    ],
    feeding: [
      ["奶仍是主食", "每顿约 150–220ml，全天 5–6 次，约 800–1000ml。"],
      ["辅食准备信号", "能靠坐、头稳、对食物感兴趣、挺舌反射消失。满 6 个月开始添加。"],
      ["第一口辅食", "从强化铁米粉或肉泥等富铁食物开始，一次只加一种新食物，观察 2–3 天。"],
    ],
    sleep: [
      ["全天约 12–16 小时", "白天 2–3 次小睡，夜里可连续睡 6–8 小时。"],
      ["夜奶", "部分宝宝可减少到 0–1 次，宝宝真饿才喂。"],
    ],
    output: [
      ["大便", "加辅食后颜色和气味会变化，看到食物残渣也正常。"],
      ["便秘", "大便干硬、排便困难才是便秘，次数少本身不是。"],
    ],
    care: [
      ["牙齿清洁", "长牙后用指套牙刷或纱布每天清洁 2 次。"],
      ["安全", "床、沙发上随时有人看护；收好小物件、电线、药品。"],
      ["洗澡", "可以盆坐浴，大人始终一手扶住宝宝。"],
    ],
    play: [
      ["坐的练习", "靠坐时在身边围好枕头，逐步减少支撑。"],
      ["爬的预备", "趴着时把玩具放在稍远处，鼓励向前够。"],
      ["躲猫猫", "帮助理解“物体恒存”，也能缓解分离焦虑。"],
      ["亲子阅读", "每天读 5–10 分钟布书或硬板书。"],
    ],
    health: [
      ["6 月龄疫苗", "乙肝第 3 剂、百白破第 3 剂、A 群流脑第 1 剂；满 6 个月也可接种流感疫苗，以接种本为准。"],
      ["6 月龄体检", "常规会查血常规，关注是否贫血。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["5–6 个月仍不会翻身、不会主动抓东西", "对声音和人脸都缺少反应", "持续高热、精神萎靡"],
  },
  {
    from: 180, to: 270, name: "6–9 个月", theme: "辅食 · 坐稳 · 爬行",
    summary: "辅食开始成为重要营养来源，宝宝会坐稳、学爬，分离焦虑也随之而来。",
    ref: { perFeed: [180, 240], feeds: [3, 5], daily: [600, 800], sleep: [12, 16], gain: [8, 15] },
    traits: [
      ["坐稳、学爬", "6–7 个月独坐，8–9 个月开始爬。"],
      ["分离焦虑", "看不到妈妈会哭，离开时好好告别，不要偷偷溜走。"],
      ["发音", "会发出“ba-ba、ma-ma”等重复音节。"],
      ["出牙", "多数宝宝在这个阶段长出下门牙。"],
    ],
    feeding: [
      ["奶量", "每天约 600–800ml，奶仍是主要营养来源。"],
      ["辅食", "从每天 1 次逐步到 2 次；质地从泥糊状过渡到碎末、软块。"],
      ["富含铁", "每天都要有红肉、肝泥或强化铁米粉。"],
      ["不加盐糖", "1 岁内辅食不加盐、糖和蜂蜜。"],
    ],
    sleep: [
      ["全天约 12–16 小时", "白天 2 次小睡。"],
      ["8–10 月睡眠倒退", "学爬、学站和分离焦虑会让夜醒增多，保持固定睡前程序。"],
    ],
    output: [
      ["大便变化", "加辅食后大便变稠、次数可能减少。"],
      ["便秘预防", "适量增加西梅泥、梨泥等含膳食纤维的食物，并适量喝水。"],
    ],
    care: [
      ["刷牙", "长牙后每天早晚用米粒大小的含氟牙膏刷牙。"],
      ["居家防护", "插座、桌角、楼梯、柜门都要做好防护。"],
      ["防噎", "不给整颗坚果、葡萄、果冻等食物；进食时必须坐着、有人看护。"],
    ],
    play: [
      ["爬行", "在地垫上用玩具引导爬行，不要跳过爬直接学走。"],
      ["精细动作", "抓软的食物条、捏米饼，练习拇指和食指配合。"],
      ["语言", "给物品命名，多回应宝宝的发音。"],
    ],
    health: [
      ["8 月龄疫苗", "麻腮风第 1 剂、乙脑第 1 剂；9 月龄 A 群流脑第 2 剂，以接种本为准。"],
      ["8 月龄体检", "关注运动发育和贫血情况。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["9 个月仍不能独坐", "对名字没有反应", "辅食后反复呕吐、皮疹、腹泻（警惕过敏）"],
  },
  {
    from: 270, to: 365, name: "9–12 个月", theme: "站立 · 学步 · 叫爸妈",
    summary: "宝宝从爬到扶站、扶走，开始听懂简单指令，有意识地叫爸爸妈妈。",
    ref: { perFeed: [180, 240], feeds: [3, 4], daily: [550, 700], sleep: [12, 15], gain: [6, 12] },
    traits: [
      ["扶站扶走", "能扶着家具站起来，部分宝宝 1 岁前会独走几步。"],
      ["有意识叫人", "开始有意义地叫爸爸、妈妈，会挥手再见。"],
      ["听懂指令", "能听懂“不”“给我”等简单的话。"],
      ["钳形抓握", "会用拇指和食指捏起小东西。"],
    ],
    feeding: [
      ["奶量", "每天约 600ml，辅食 2–3 顿加 1–2 次点心。"],
      ["手指食物", "提供软烂的条状、块状食物，鼓励自己吃。"],
      ["学用杯子", "开始练习用杯子喝水，为戒奶瓶做准备。"],
    ],
    sleep: [
      ["全天约 12–15 小时", "白天 1–2 次小睡。"],
      ["夜奶", "多数宝宝已经可以睡整夜。"],
    ],
    output: [
      ["大便", "接近成人性状，每天 1–2 次或隔天一次都正常。"],
      ["多喝水", "辅食增加后要适量喝白开水。"],
    ],
    care: [
      ["学步安全", "光脚或穿防滑袜在家走，不建议长时间使用学步车。"],
      ["防烫防跌", "热水、热汤远离桌边；窗户安装限位器。"],
      ["刷牙", "早晚刷牙，避免含着奶瓶睡觉。"],
    ],
    play: [
      ["扶走游戏", "推小推车、扶着沙发移动。"],
      ["指认游戏", "指着图画书说名称，让宝宝指认。"],
      ["模仿游戏", "拍手、再见、打电话，培养模仿能力。"],
    ],
    health: [
      ["1 岁体检", "全面评估生长发育、牙齿、视力和贫血。"],
      ["1 岁后自费疫苗", "水痘疫苗等可在 1 岁后接种，以接种本和医生建议为准。"],
      ["维生素 D", "继续每天 400IU。"],
    ],
    redFlags: ["12 个月不会扶站", "不会用手指指东西、不会挥手", "叫名字长期没有反应", "原本会的能力倒退"],
  },
  {
    from: 365, to: 548, name: "1 岁–1 岁半", theme: "独走 · 说词 · 自主进食",
    summary: "宝宝会独立走路，词汇开始增加，饮食逐渐过渡到家庭食物。",
    ref: { daily: [400, 600], sleep: [11, 14] },
    traits: [
      ["独立行走", "大多数宝宝 12–15 个月独走。"],
      ["词汇", "会说几个到十几个有意义的词。"],
      ["自我意识", "开始说“不”，有自己的想法和小脾气。"],
    ],
    feeding: [
      ["奶量", "每天约 400–600ml。"],
      ["三餐两点", "逐步和家人同桌吃饭，食物软烂、少盐少糖。"],
      ["自主进食", "允许宝宝自己用勺子，弄脏也没关系。"],
      ["戒奶瓶", "1 岁半前逐步改用杯子。"],
    ],
    sleep: [
      ["全天约 11–14 小时", "白天 1–2 次小睡，逐步过渡到 1 次午睡。"],
    ],
    output: [
      ["如厕准备", "多数宝宝 18 个月后才有如厕意识，不急于训练。"],
    ],
    care: [
      ["口腔", "早晚刷牙，每半年看一次牙医。"],
      ["安全", "药品、洗涤剂、尖锐物品锁好；乘车使用安全座椅。"],
    ],
    play: [
      ["大运动", "爬楼梯（有人保护）、踢球、推拉玩具。"],
      ["语言", "多描述、多提问，扩展宝宝说的短语。"],
      ["精细动作", "搭积木、涂鸦、翻书。"],
    ],
    health: [
      ["18 月龄疫苗", "百白破第 4 剂、麻腮风第 2 剂、甲肝疫苗，以接种本为准。"],
      ["体检", "1–3 岁每半年体检一次。"],
    ],
    redFlags: ["18 个月还不会独走", "18 个月不会说任何有意义的词", "不会用手指指东西表达需求"],
  },
  {
    from: 548, to: 730, name: "1 岁半–2 岁", theme: "语言爆发 · 小脾气",
    summary: "词汇快速增长，开始说两个词的短句；情绪起伏大，需要耐心引导。",
    ref: { daily: [400, 600], sleep: [11, 14] },
    traits: [
      ["语言爆发", "词汇快速增加，开始说“妈妈抱”“喝水”等短句。"],
      ["情绪", "会发脾气，这是表达能力跟不上需求的表现。"],
      ["跑跳", "会跑、会蹲下捡东西。"],
    ],
    feeding: [
      ["奶量", "每天约 400–600ml。"],
      ["饮食多样", "每天谷薯、蔬果、肉蛋鱼、奶豆都要有。"],
    ],
    sleep: [
      ["全天约 11–14 小时", "1 次午睡 1.5–3 小时。"],
      ["18 月睡眠倒退", "可能出现入睡困难、夜醒，保持规律作息。"],
    ],
    output: [
      ["如厕训练", "能表达便意、能保持尿布干燥 2 小时以上时，可以开始尝试。"],
    ],
    care: [
      ["刷牙", "使用米粒大小的含氟牙膏，家长帮忙刷。"],
      ["屏幕时间", "2 岁前尽量避免电子屏幕（视频通话除外）。"],
    ],
    play: [
      ["假想游戏", "过家家、喂娃娃吃饭。"],
      ["绘本", "每天亲子阅读，鼓励宝宝说出图里的内容。"],
    ],
    health: [
      ["2 岁疫苗", "乙脑第 2 剂，以接种本为准。"],
    ],
    redFlags: ["2 岁还不会说两个词的短语", "不理解简单指令", "已掌握的语言或社交能力倒退"],
  },
  {
    from: 730, to: Infinity, name: "2–3 岁", theme: "独立 · 社交 · 如厕",
    summary: "宝宝越来越独立，开始和小朋友一起玩，大多数孩子在这个阶段学会自己上厕所。",
    ref: { daily: [350, 500], sleep: [10, 13] },
    traits: [
      ["语言", "能说完整的简单句子，喜欢问“为什么”。"],
      ["社交", "开始和小朋友一起玩，学习轮流和分享。"],
      ["运动", "会双脚跳、上下楼梯。"],
    ],
    feeding: [
      ["奶量", "每天约 350–500ml。"],
      ["规律进餐", "定时定量，少吃零食和含糖饮料。"],
    ],
    sleep: [
      ["全天约 10–13 小时", "保留午睡。"],
    ],
    output: [
      ["如厕", "鼓励为主，不批评尿裤子；夜间控制排尿通常更晚。"],
    ],
    care: [
      ["牙齿", "每半年看一次牙医，可以考虑涂氟。"],
      ["安全教育", "教宝宝认识危险：不碰热水、不跟陌生人走。"],
    ],
    play: [
      ["户外", "每天户外活动 2 小时左右。"],
      ["精细动作", "穿珠子、剪纸（儿童剪刀）、画圆圈。"],
    ],
    health: [
      ["3 岁疫苗", "A 群 C 群流脑疫苗，以接种本为准。"],
      ["入园体检", "准备入园前完成体检。"],
    ],
    redFlags: ["3 岁说话别人仍很难听懂", "不和人对视、不与人互动", "经常摔倒或无法上下楼梯"],
  },
];

/* 与具体日龄相关的时间窗口事件：猛长期、哭闹高峰、厌奶、睡眠倒退、体检、疫苗等。 */
const CARE_EVENTS = [
  { from: 0, to: 15, tag: "护理", icon: "🩹", title: "脐带护理期", text: "保持脐部干燥，尿布别盖住脐带，一般 1–2 周脱落。" },
  { from: 2, to: 14, tag: "观察", icon: "🟡", title: "生理性黄疸期", text: "注意黄疸范围和吃奶、精神状态，可在页面记录黄疸数值。" },
  { from: 6, to: 11, tag: "猛长期", icon: "📈", title: "第一次猛长期（约 7–10 天）", text: "频繁要奶、睡不安稳，按需喂养，几天后就会过去。" },
  { from: 14, to: 22, tag: "猛长期", icon: "📈", title: "2–3 周猛长期", text: "宝宝可能频繁要奶，母乳妈妈多让宝宝吸，奶量会跟上。" },
  { from: 14, to: 35, tag: "哭闹", icon: "🌇", title: "黄昏闹开始出现", text: "傍晚莫名哭闹在 2–3 周开始出现，固定安抚流程会有帮助。" },
  { from: 28, to: 33, tag: "里程碑", icon: "🎉", title: "满月", text: "可以复盘一下体重增长和吃奶节奏。" },
  { from: 28, to: 42, tag: "疫苗", icon: "💉", title: "1 月龄：乙肝疫苗第 2 剂", text: "以当地接种门诊通知为准，接种后留观 30 分钟。" },
  { from: 35, to: 46, tag: "猛长期", icon: "📈", title: "6 周猛长期", text: "吃完不久又饿、夜醒增多，按需加量即可，通常持续几天。" },
  { from: 35, to: 63, tag: "哭闹", icon: "🌇", title: "黄昏闹 / 肠绞痛高峰", text: "6 周左右最明显，之后逐渐减轻；排除饥饿、尿湿、发热后，用襁褓、白噪音、轻摇、飞机抱安抚。" },
  { from: 38, to: 48, tag: "体检", icon: "🩺", title: "42 天体检", text: "宝宝做生长发育检查，妈妈同时做产后复查。" },
  { from: 42, to: 120, tag: "攒肚", icon: "🫧", title: "可能出现攒肚", text: "母乳宝宝几天不大便，只要精神好、肚子软、大便软，通常不用干预。", feeding: "breast" },
  { from: 56, to: 75, tag: "疫苗", icon: "💉", title: "2 月龄：脊灰第 1 剂、百白破第 1 剂", text: "自费的肺炎、五联、轮状病毒疫苗也常从这时开始，提前和接种门诊确认。" },
  { from: 63, to: 105, tag: "哭闹", icon: "🌤", title: "哭闹逐渐减少", text: "多数宝宝的肠绞痛在 3–4 个月好转，晚上会更好哄。" },
  { from: 80, to: 96, tag: "猛长期", icon: "📈", title: "3 个月猛长期", text: "奶量需求短暂上升，按需喂养。" },
  { from: 86, to: 100, tag: "疫苗", icon: "💉", title: "3 月龄：脊灰第 2 剂", text: "同时安排 3 月龄体检。" },
  { from: 85, to: 160, tag: "厌奶期", icon: "🙅", title: "生理性厌奶期", text: "吃几口就玩、奶量下降，但精神好、体重在长就不用担心；安静环境里喂，不强迫。" },
  { from: 97, to: 103, tag: "里程碑", icon: "💯", title: "百天", text: "宝宝百天啦，可以拍张纪念照。" },
  { from: 100, to: 145, tag: "睡眠", icon: "🌙", title: "4 个月睡眠倒退", text: "夜醒变多、小睡变短，坚持固定作息，大约 2–6 周后改善。" },
  { from: 116, to: 130, tag: "疫苗", icon: "💉", title: "4 月龄：脊灰第 3 剂、百白破第 2 剂", text: "以接种本为准。" },
  { from: 150, to: 300, tag: "出牙", icon: "🦷", title: "出牙信号期", text: "流口水、啃咬、烦躁，可以用冷藏牙胶；长牙后开始刷牙。" },
  { from: 165, to: 182, tag: "辅食", icon: "🥣", title: "辅食准备", text: "满 6 个月开始添加，从富铁的强化米粉或肉泥开始，一次只加一种。" },
  { from: 170, to: 190, tag: "猛长期", icon: "📈", title: "6 个月猛长期", text: "胃口变大，正好赶上辅食添加。" },
  { from: 178, to: 192, tag: "疫苗", icon: "💉", title: "6 月龄：乙肝第 3 剂、百白破第 3 剂、A 群流脑第 1 剂", text: "满 6 个月也可接种流感疫苗；同时安排 6 月龄体检。" },
  { from: 240, to: 255, tag: "疫苗", icon: "💉", title: "8 月龄：麻腮风第 1 剂、乙脑第 1 剂", text: "同时安排 8 月龄体检。" },
  { from: 240, to: 300, tag: "睡眠", icon: "🌙", title: "分离焦虑与睡眠倒退", text: "看不到家人就哭，夜醒增多；多陪伴，离开前好好告别。" },
  { from: 270, to: 285, tag: "疫苗", icon: "💉", title: "9 月龄：A 群流脑第 2 剂", text: "以接种本为准。" },
  { from: 358, to: 375, tag: "里程碑", icon: "🎂", title: "1 岁生日", text: "安排 1 岁体检，复盘一年的成长曲线。" },
  { from: 540, to: 560, tag: "疫苗", icon: "💉", title: "18 月龄：百白破第 4 剂、麻腮风第 2 剂、甲肝", text: "以接种本为准。" },
  { from: 730, to: 745, tag: "疫苗", icon: "💉", title: "2 岁：乙脑第 2 剂", text: "以接种本为准。" },
];

const GUIDE_TAG_TONES = { 猛长期: "peach", 厌奶期: "peach", 哭闹: "violet", 睡眠: "violet", 攒肚: "yellow", 观察: "yellow", 里程碑: "yellow", 疫苗: "blue", 出牙: "blue", 体检: "green", 护理: "green", 辅食: "green" };

/* 亲喂和瓶喂母乳交替时的提示，近 7 天有母乳记录时显示在“喂养”分类里。 */
const BREAST_MIX_TIPS = [
  ["先把亲喂建立好", "如果条件允许，最好等亲喂比较顺利（约 3–4 周）后再经常用奶瓶；宝宝出现只认奶瓶、含乳变浅时，多肌肤接触，在宝宝半睡半醒、不太饿时试着亲喂。", 0, 60],
  ["瓶喂一次，就吸一次奶", "用瓶喂代替一次亲喂时，妈妈在差不多的时间吸一次奶，乳房才会收到“需要这么多奶”的信号，奶量不容易下降。", 0, 365],
  ["节律瓶喂", "让宝宝半坐起来，奶瓶尽量放平，只让奶嘴前端充满奶；每吸二三十口停一停，一顿喂 10–20 分钟，接近亲喂的节奏，避免吃太快、吃过量。", 0, 365],
  ["瓶喂母乳不必一直加量", "1–6 个月母乳宝宝全天总量变化不大（常见约 750–800ml），瓶喂母乳每顿常见 90–120ml，不需要像奶粉那样随月龄一直加量；看宝宝吃饱的信号即可。", 28, 180],
  ["母乳储存", "室温（25℃以下）4 小时内，冷藏（4℃左右）4 天内，冷冻 6 个月内最佳；解冻后的奶冷藏 24 小时内用完，不要再次冷冻。", 0, 365],
  ["复温与剩奶", "放在温水里或用暖奶器加热，不要用微波炉（受热不均易烫伤）；宝宝喝过的剩奶 1–2 小时内用完，不要留到下一顿。", 0, 365],
  ["亲喂时看什么", "一侧吸到乳房变软再换另一侧，下次从另一侧开始；能听到吞咽声、宝宝自己松开、表情放松，说明是有效吸吮。可以记一下亲喂时长，方便发现规律。", 0, 365],
];

function recentBreastMix(referenceTime) {
  const start = referenceTime - 7 * DAY_MS;
  const mix = { direct: 0, bottle: 0, other: 0 };
  getTypeRecords("feeding").forEach((record) => {
    const time = Number(record.time);
    if (time < start || time > referenceTime || record.feedingType !== "breast") return;
    if (record.breastMethod === "direct") mix.direct += 1;
    else if (record.breastMethod === "bottle") mix.bottle += 1;
    else mix.other += 1;
  });
  return mix;
}

function breastMixHtml(ageDays, referenceTime) {
  if (ageDays >= 365) return "";
  const mix = recentBreastMix(referenceTime);
  if (!mix.direct && !mix.bottle && !mix.other) return "";
  const items = BREAST_MIX_TIPS.filter(([, , from, to]) => ageDays >= from && ageDays < to);
  const counts = [mix.direct && `亲喂 ${mix.direct} 次`, mix.bottle && `瓶喂母乳 ${mix.bottle} 次`, mix.other && `未区分方式 ${mix.other} 次`].filter(Boolean).join("、");
  return `<div class="guide-mix"><strong>🤱 亲喂 + 瓶喂</strong><small>近 7 天母乳：${escapeHtml(counts)}</small><ul class="guide-list">${guideItemsHtml(items)}</ul></div>`;
}

let guidePreviewStageIndex = null;
let guideUiState = loadGuideUiState();
let guideEventsBound = false;
// 默认收起，只在本次打开页面期间记住展开状态，避免占用首页空间
let guideExpanded = false;

function loadGuideUiState() {
  try {
    const value = JSON.parse(localStorage.getItem(GUIDE_UI_KEY));
    return { tab: GUIDE_TABS.some((tab) => tab.key === value?.tab) ? value.tab : "traits" };
  } catch {
    return { tab: "traits" };
  }
}

function saveGuideUiState() {
  try {
    localStorage.setItem(GUIDE_UI_KEY, JSON.stringify(guideUiState));
  } catch {
    // 界面偏好保存失败不影响使用
  }
}

function guideStageIndex(ageDays) {
  const index = CARE_STAGES.findIndex((stage) => ageDays >= stage.from && ageDays < stage.to);
  return index === -1 ? CARE_STAGES.length - 1 : index;
}

/* 查看今天时用当前时刻，查看历史日期时用当天结束时刻，与“宝宝在那天多大”保持一致。 */
function guideReferenceTime() {
  const today = dateKey(new Date());
  if (selectedDate === today) return Date.now();
  return new Date(`${selectedDate}T23:59:59`).getTime();
}

function guideAgeDays(referenceTime) {
  return Math.floor((referenceTime - babyProfile.birthAt) / DAY_MS);
}

function guideAgeLabel(ageDays) {
  if (ageDays < 30) return `出生 ${ageDays} 天`;
  const months = Math.floor(ageDays / 30.44);
  const restDays = Math.floor(ageDays - months * 30.44);
  if (months < 12) return `${ageDays} 天 · ${months} 个月${restDays ? ` ${restDays} 天` : ""}`;
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return `${years} 岁${restMonths ? ` ${restMonths} 个月` : ""}`;
}

function guideStageRangeLabel(stage) {
  if (stage.to === Infinity) return `${stage.from} 天以后`;
  return `${stage.from}–${stage.to - 1} 天`;
}

function recentFeedingPreference(referenceTime) {
  const start = referenceTime - 7 * DAY_MS;
  let breast = 0;
  let formula = 0;
  getTypeRecords("feeding").forEach((record) => {
    const time = Number(record.time);
    if (time < start || time > referenceTime) return;
    if (record.feedingType === "breast") breast += 1;
    else formula += 1;
  });
  if (!breast && !formula) return null;
  if (breast >= formula * 2) return "breast";
  if (formula >= breast * 2) return "formula";
  return "mixed";
}

function guideEventsFor(ageDays, feedingPreference) {
  const matchesFeeding = (event) => !event.feeding || !feedingPreference || feedingPreference === "mixed" || event.feeding === feedingPreference;
  const current = CARE_EVENTS.filter((event) => ageDays >= event.from && ageDays < event.to && matchesFeeding(event));
  const upcoming = CARE_EVENTS
    .filter((event) => event.from > ageDays && event.from <= ageDays + 30 && matchesFeeding(event))
    .sort((a, b) => a.from - b.from)
    .slice(0, 4);
  return { current, upcoming };
}

function dayRecordsOf(key) {
  return getRecordIndex().byDay.get(key) || EMPTY_RECORDS;
}

function shiftDateKey(key, delta) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return dateKey(date);
}

function latestWeightKg(referenceTime) {
  const items = getTypeRecords("growth");
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const record = items[index];
    if (Number(record.time) <= referenceTime && Number(record.weight) > 0) return { kg: Number(record.weight), time: Number(record.time) };
  }
  return null;
}

function dailyMilkRange(stage, ageDays, weight) {
  if (ageDays < 7) return null;
  if (ageDays < 180 && weight) {
    return [Math.round(weight.kg * 120 / 10) * 10, Math.round(Math.min(weight.kg * 180, 1000) / 10) * 10];
  }
  if (stage.ref.daily) return stage.ref.daily;
  if (stage.ref.perFeed && stage.ref.feeds) return [stage.ref.perFeed[0] * stage.ref.feeds[0], Math.min(stage.ref.perFeed[1] * stage.ref.feeds[1], 1000)];
  return null;
}

function feedingBreakdown(dayRecords) {
  const feedings = dayRecords.filter((record) => record.type === "feeding");
  let formula = 0;
  let bottle = 0;
  let direct = 0;
  let breast = 0;
  let minutes = 0;
  let ml = 0;
  let unmeasured = 0;
  feedings.forEach((record) => {
    const amount = Number(record.amount);
    if (amount > 0) ml += amount;
    else unmeasured += 1;
    if (record.feedingType !== "breast") formula += 1;
    else if (record.breastMethod === "direct") {
      direct += 1;
      minutes += Number(record.nurseMinutes) || 0;
    } else if (record.breastMethod === "bottle") bottle += 1;
    else breast += 1;
  });
  const parts = [
    direct && `亲喂 ${direct} 次${minutes ? `共 ${minutes} 分钟` : ""}`,
    bottle && `瓶喂母乳 ${bottle} 次`,
    breast && `母乳 ${breast} 次`,
    formula && `奶粉 ${formula} 次`,
  ].filter(Boolean).join("、");
  return { total: feedings.length, ml, unmeasured, direct, bottle, formula, parts };
}

/* 只读分析：结合已有记录给出个性化提醒，status 取值 good / info / watch。 */
function analyzeCareRecords(stage, ageDays, referenceTime, feedingPreference) {
  const insights = [];
  const isToday = selectedDate === dateKey(new Date());
  const weight = latestWeightKg(referenceTime);

  // 奶量：查看今天时用昨天（完整一天）做对比，同时显示今天进度。亲喂未填奶量时无法比较总量，改看顿数、小便和体重。
  const compareKey = isToday ? shiftDateKey(selectedDate, -1) : selectedDate;
  const compareLabel = isToday ? "昨天" : "当天";
  const compare = feedingBreakdown(dayRecordsOf(compareKey));
  const milkRange = dailyMilkRange(stage, ageDays, weight);
  const feedsRef = stage.ref.feeds;
  if (compare.total && milkRange && ageDays < 365) {
    const basis = ageDays < 180 && weight ? `按体重 ${weight.kg}kg 估算` : "本阶段参考";
    let status = "good";
    let text = `${compareLabel}共 ${compare.total} 顿（${compare.parts}）`;
    if (compare.unmeasured) {
      text += compare.ml ? `，已计量 ${compare.ml}ml。` : "。";
      if (compare.ml >= milkRange[0]) {
        text += `仅计量部分就已达到${basis}的全天 ${milkRange[0]}–${milkRange[1]}ml。`;
        if (compare.ml > milkRange[1] * 1.1) {
          status = "watch";
          text += "加上亲喂可能偏多，注意溢奶、腹胀，别把哭闹都当成饿。";
        }
      } else if (feedsRef && compare.total < feedsRef[0]) {
        status = "watch";
        text += `亲喂量无法计量，但总顿数少于本阶段参考的 ${feedsRef[0]}–${feedsRef[1]} 次，可以多让宝宝吸，并留意小便次数和体重。`;
      } else {
        status = "info";
        text += "亲喂量无法计量，是否吃够主要看每天 6 次以上湿尿布、体重稳步增长、吃完放松满足。";
      }
    } else if (compare.ml > 0) {
      text += `，共 ${compare.ml}ml，平均每顿 ${Math.round(compare.ml / compare.total)}ml；${basis}全天约 ${milkRange[0]}–${milkRange[1]}ml。`;
      if (compare.ml < milkRange[0] * 0.85) {
        status = "watch";
        text += "偏少，留意宝宝精神、小便次数和体重增长。";
      } else if (compare.ml > milkRange[1] * 1.1) {
        status = "watch";
        text += "偏多，注意是否把哭闹都当成了饿，以及溢奶、腹胀情况。";
      } else {
        text += "在参考范围内。";
      }
    }
    insights.push({ status, icon: "🍼", title: "奶量", text });
  }
  if (isToday && milkRange && ageDays < 365) {
    const today = feedingBreakdown(dayRecordsOf(selectedDate));
    if (today.total) {
      const progress = today.unmeasured
        ? (today.ml ? `，已计量 ${today.ml}ml` : "")
        : `、${today.ml}ml，约为全天参考下限的 ${Math.round(today.ml / milkRange[0] * 100)}%`;
      insights.push({ status: "info", icon: "⏳", title: "今日进度", text: `今天已吃 ${today.total} 顿（${today.parts}）${progress}。` });
    }
  }

  // 小便：用最近一个完整且有记录的日子
  if (ageDays >= 6 && ageDays < 730) {
    const peeKey = isToday ? shiftDateKey(selectedDate, -1) : selectedDate;
    const peeDay = dayRecordsOf(peeKey);
    const pees = peeDay.filter((record) => record.type === "pee").length;
    if (peeDay.length) {
      insights.push(pees >= 6
        ? { status: "good", icon: "💧", title: "小便", text: `${compareLabel}记录小便 ${pees} 次，达到每天 6 次以上的参考，说明进食量基本充足。` }
        : { status: pees ? "watch" : "info", icon: "💧", title: "小便", text: pees ? `${compareLabel}只记录到 ${pees} 次小便（参考每天 6 次以上）。如果是漏记可以忽略；若尿布确实偏少、尿色深，要增加喂奶并观察。` : `${compareLabel}没有小便记录，记得在排泄里记一下，方便判断是否吃够。` });
    }
  }

  // 大便间隔：按日龄和喂养方式解读
  const lastPoop = getTypeRecords("poop").filter((record) => Number(record.time) <= referenceTime).pop();
  if (lastPoop) {
    const days = (referenceTime - Number(lastPoop.time)) / DAY_MS;
    const daysLabel = days < 1 ? `${Math.max(1, Math.round(days * 24))} 小时` : `${days.toFixed(1)} 天`;
    let status = "good";
    let text = `距离上次大便 ${daysLabel}。`;
    if (days >= 1.5) {
      if (ageDays < 42) {
        status = "watch";
        text += "6 周内的宝宝通常每天都会排便，母乳宝宝排便减少可能提示吃得不够，请留意小便和体重，必要时咨询医生。";
      } else if (ageDays < 180 && feedingPreference === "breast") {
        status = days > 7 ? "watch" : "info";
        text += days > 7
          ? "已超过 7 天。攒肚期间如出现腹胀、拒奶、呕吐或排出干硬大便，请就医。"
          : "可能是攒肚：只要精神好、吃奶好、肚子软、小便正常，可以先观察，顺时针按摩腹部、做做蹬腿操。";
      } else if (days >= 3) {
        status = "watch";
        text += "奶粉 / 混合喂养的宝宝 3 天以上没大便，注意大便是否干硬、排便是否费力；奶粉按比例冲调，不要加浓。";
      } else {
        status = "info";
        text += "在常见范围内，继续观察。";
      }
    }
    insights.push({ status, icon: "💩", title: "大便", text });
  }

  // 体重增长速度
  const weights = getTypeRecords("growth").filter((record) => Number(record.weight) > 0 && Number(record.time) <= referenceTime);
  const latest = weights[weights.length - 1];
  if (latest && stage.ref.gain) {
    const earlier = [...weights].reverse().find((record) => Number(latest.time) - Number(record.time) >= 7 * DAY_MS);
    if (earlier) {
      const spanDays = (Number(latest.time) - Number(earlier.time)) / DAY_MS;
      const gain = Math.round((Number(latest.weight) - Number(earlier.weight)) * 1000 / spanDays);
      const [low, high] = stage.ref.gain;
      const status = gain < low * 0.7 ? "watch" : "good";
      insights.push({
        status,
        icon: "⚖️",
        title: "体重增长",
        text: `近 ${Math.round(spanDays)} 天平均每天 ${gain >= 0 ? "+" : ""}${gain}g，本阶段参考约 ${low}–${high}g/天。${status === "watch" ? "偏慢，建议体检时和医生一起看生长曲线。" : gain > high * 1.4 ? "增长较快，注意不要过度喂养。" : ""}`,
      });
    }
  }
  if (ageDays < 365) {
    const daysSinceWeight = latest ? (referenceTime - Number(latest.time)) / DAY_MS : Infinity;
    const interval = ageDays < 90 ? 14 : 30;
    if (daysSinceWeight > interval) {
      insights.push({ status: "info", icon: "📏", title: "测量提醒", text: latest ? `已有 ${Math.floor(daysSinceWeight)} 天没记录体重，建议每 ${interval === 14 ? "1–2 周" : "月"}量一次，方便追踪生长曲线。` : "还没有体重记录，点上方“身高 / 体重”记一次，就能分析增长速度。" });
    }
  }

  return insights;
}

function guideItemsHtml(items) {
  return items.map(([title, text]) => `<li><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></li>`).join("");
}

function renderCareGuide() {
  const container = $("#careGuide");
  if (!container) return;
  bindCareGuideEvents(container);

  if (!babyProfile?.birthAt) {
    container.innerHTML = `
      <div class="guide-empty">
        <span aria-hidden="true">🌱</span>
        <div><strong>成长指南</strong><p>填写出生时间后，按日龄提示阶段重点</p></div>
        <button type="button" data-guide-action="profile">设置出生时间</button>
      </div>`;
    return;
  }

  const referenceTime = guideReferenceTime();
  const ageDays = guideAgeDays(referenceTime);
  if (ageDays < 0) {
    container.innerHTML = `<div class="guide-empty"><span aria-hidden="true">🌱</span><div><strong>成长指南</strong><p>这一天宝宝还没有出生。</p></div></div>`;
    return;
  }

  const currentIndex = guideStageIndex(ageDays);
  const stageIndex = guidePreviewStageIndex ?? currentIndex;
  const stage = CARE_STAGES[stageIndex];
  const previewing = stageIndex !== currentIndex;
  const feedingPreference = recentFeedingPreference(referenceTime);
  const { current, upcoming } = guideEventsFor(ageDays, feedingPreference);
  const insights = previewing ? [] : analyzeCareRecords(stage, ageDays, referenceTime, feedingPreference);
  const tab = guideUiState.tab;
  container.classList.toggle("expanded", guideExpanded);

  if (!guideExpanded) {
    const currentStage = CARE_STAGES[currentIndex];
    const tags = [...new Set(current.map((event) => event.tag))].slice(0, 3);
    const watchCount = insights.filter((item) => item.status === "watch").length;
    container.innerHTML = `
      <button class="guide-bar" type="button" data-guide-action="toggle" aria-expanded="false" aria-label="展开成长指南">
        <span class="guide-bar-icon" aria-hidden="true">🌱</span>
        <span class="guide-bar-text">
          <strong>成长指南<em>${escapeHtml(guideAgeLabel(ageDays))}</em></strong>
          <small>${escapeHtml(currentStage.name)} · ${escapeHtml(tags.length ? tags.join(" · ") : currentStage.theme)}</small>
        </span>
        ${watchCount ? `<span class="guide-bar-badge">${watchCount} 条留意</span>` : ""}
        <span class="guide-bar-open">查看<i aria-hidden="true">›</i></span>
      </button>`;
    return;
  }
  const stageProgress = stage.to === Infinity ? 100 : Math.min(100, Math.max(0, ((ageDays - stage.from) / (stage.to - stage.from)) * 100));
  const daysLeft = stage.to === Infinity ? null : stage.to - ageDays;
  const ref = stage.ref;
  const refChips = [
    ref.perFeed && `<span><small>每顿奶量</small><b>${ref.perFeed[0]}–${ref.perFeed[1]}ml</b></span>`,
    ref.feeds && `<span><small>每天顿数</small><b>${ref.feeds[0]}–${ref.feeds[1]} 次</b></span>`,
    ref.daily && !ref.perFeed && `<span><small>每天奶量</small><b>${ref.daily[0]}–${ref.daily[1]}ml</b></span>`,
    ref.sleep && `<span><small>全天睡眠</small><b>${ref.sleep[0]}–${ref.sleep[1]} 小时</b></span>`,
    ref.gain && `<span><small>体重增长</small><b>${ref.gain[0]}–${ref.gain[1]}g/天</b></span>`,
  ].filter(Boolean).join("");

  const focusHtml = !previewing && current.length
    ? `<div class="guide-focus" aria-label="这几天的重点">${current.map((event) => `
        <article class="guide-focus-card" data-tone="${GUIDE_TAG_TONES[event.tag] || "green"}">
          <span aria-hidden="true">${event.icon}</span>
          <div><em>${escapeHtml(event.tag)}</em><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.text)}</p></div>
        </article>`).join("")}</div>`
    : "";

  const insightsHtml = insights.length
    ? `<div class="guide-block"><h4>根据你的记录</h4><ul class="guide-insights">${insights.map((item) => `
        <li class="${item.status}"><span aria-hidden="true">${item.icon}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.text)}</p></div></li>`).join("")}</ul></div>`
    : "";

  const upcomingHtml = !previewing && upcoming.length
    ? `<div class="guide-block"><h4>接下来 30 天</h4><ul class="guide-upcoming">${upcoming.map((event) => {
        const inDays = event.from - ageDays;
        const date = new Date(babyProfile.birthAt + event.from * DAY_MS);
        return `<li><time>${inDays} 天后<small>${date.getMonth() + 1}月${date.getDate()}日</small></time><span aria-hidden="true">${event.icon}</span><div><b>${escapeHtml(event.title)}</b><p>${escapeHtml(event.text)}</p></div></li>`;
      }).join("")}</ul></div>`
    : "";

  container.innerHTML = `
    <header class="guide-header">
      <div class="guide-title">
        <p class="eyebrow">成长指南 · ${escapeHtml(guideAgeLabel(ageDays))}</p>
        <h2>${escapeHtml(stage.name)}<span>${escapeHtml(stage.theme)}</span></h2>
      </div>
      <div class="guide-nav">
        <button type="button" data-guide-stage="-1" aria-label="上一个阶段" ${stageIndex === 0 ? "disabled" : ""}>‹</button>
        <button type="button" data-guide-stage="1" aria-label="下一个阶段" ${stageIndex === CARE_STAGES.length - 1 ? "disabled" : ""}>›</button>
        <button class="guide-toggle" type="button" data-guide-action="toggle" aria-expanded="true">收起</button>
      </div>
    </header>
    ${previewing
      ? `<div class="guide-preview-bar"><span>正在预览 ${escapeHtml(guideStageRangeLabel(stage))} 的内容</span><button type="button" data-guide-action="current">回到当前阶段</button></div>`
      : `<div class="guide-progress" aria-label="当前阶段进度"><i style="width:${stageProgress.toFixed(1)}%"></i><span>${escapeHtml(guideStageRangeLabel(stage))}${daysLeft !== null ? ` · 还有 ${daysLeft} 天进入下一阶段` : ""}</span></div>`}
    <p class="guide-summary">${escapeHtml(stage.summary)}</p>
    ${focusHtml}
    <div class="guide-body">
      ${refChips ? `<div class="guide-ref">${refChips}</div>` : ""}
      ${insightsHtml}
      <div class="guide-tabs" role="tablist" aria-label="成长指南分类">
        ${GUIDE_TABS.map((item) => `<button type="button" role="tab" data-guide-tab="${item.key}" aria-selected="${item.key === tab}" class="${item.key === tab ? "active" : ""}"><span aria-hidden="true">${item.icon}</span>${item.label}</button>`).join("")}
      </div>
      <ul class="guide-list" role="tabpanel">${guideItemsHtml(stage[tab] || [])}</ul>
      ${tab === "feeding" && !previewing ? breastMixHtml(ageDays, referenceTime) : ""}
      ${tab === "health" && stage.redFlags?.length ? `<div class="guide-redflags"><strong>⚠️ 出现以下情况请及时就医</strong><ul>${stage.redFlags.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul></div>` : ""}
      ${upcomingHtml}
      <p class="guide-disclaimer">内容整理自常见儿童保健建议，按足月宝宝日龄估算；早产宝宝请按矫正月龄参考。具体喂养、疫苗和就医安排以医生和当地接种门诊为准。</p>
      <button class="guide-collapse-bottom" type="button" data-guide-action="toggle">收起成长指南</button>
    </div>`;
}

function bindCareGuideEvents(container) {
  if (guideEventsBound) return;
  guideEventsBound = true;
  container.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-guide-tab]");
    if (tabButton) {
      guideUiState.tab = tabButton.dataset.guideTab;
      saveGuideUiState();
      return renderCareGuide();
    }
    const stageButton = event.target.closest("[data-guide-stage]");
    if (stageButton) {
      const ageDays = guideAgeDays(guideReferenceTime());
      const currentIndex = guideStageIndex(ageDays);
      const next = Math.min(CARE_STAGES.length - 1, Math.max(0, (guidePreviewStageIndex ?? currentIndex) + Number(stageButton.dataset.guideStage)));
      guidePreviewStageIndex = next === currentIndex ? null : next;
      return renderCareGuide();
    }
    const actionButton = event.target.closest("[data-guide-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.guideAction;
    if (action === "toggle") {
      guideExpanded = !guideExpanded;
      if (!guideExpanded) guidePreviewStageIndex = null;
      renderCareGuide();
      // 从底部收起后，把视线带回指南条，避免停在页面中间找不到位置
      if (!guideExpanded && container.getBoundingClientRect().top < 0) container.scrollIntoView({ block: "start", behavior: "smooth" });
    } else if (action === "current") {
      guidePreviewStageIndex = null;
      renderCareGuide();
    } else if (action === "profile") {
      openProfileModal();
    }
  });
}
